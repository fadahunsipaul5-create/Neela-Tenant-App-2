"""
Import properties from properties.xlsx at project root and assign images from houses/ folder.
Run from backend: python manage.py import_properties

Paths (relative to project root, i.e. parent of backend/):
  - properties.xlsx
  - houses/  (image files: jpg, jpeg, png, webp, gif)

Excel: Tolerant parsing. If address contains "Unit A", "Unit B", etc., that is used in the property name and
stripped from the address. Duplicate base names without a unit in the address get "Unit 1", "Unit 2".
Address is stored as street only; city/state from columns are not repeated in the address field.
Images: Assigned sequentially from houses/, cycling if more properties than images. Uploaded to Cloudinary when configured.
"""
import re
import logging
from pathlib import Path
from decimal import Decimal, InvalidOperation

from django.core.management.base import BaseCommand
from django.conf import settings

logger = logging.getLogger(__name__)

# Project root = parent of backend (this file: api/management/commands/import_properties.py -> backend -> parent)
def get_project_root():
    backend_dir = Path(__file__).resolve().parent.parent.parent.parent
    return backend_dir.parent


def get_excel_path():
    return get_project_root() / "properties.xlsx"


def get_houses_dir():
    return get_project_root() / "houses"


def normalize_header(cell):
    if cell is None:
        return ""
    s = str(cell).strip().lower().replace(" ", "_").replace("-", "_")
    return s


def safe_int(val, default=0):
    if val is None or (isinstance(val, str) and not val.strip()):
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError, InvalidOperation):
        return default


def safe_decimal(val, default=None):
    if val is None or (isinstance(val, str) and not val.strip()):
        return default
    try:
        return Decimal(str(val).replace(",", "").strip())
    except (ValueError, TypeError, InvalidOperation):
        return default


def safe_str(val, default=""):
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default


def extract_unit_from_address(address):
    """
    If address contains ", Unit A" or ", Unit B" (or Unit 1, Unit 2, etc.), return
    (unit_label, address_without_unit). unit_label is e.g. "Unit A" or "Unit 1".
    Otherwise return (None, address).
    """
    if not address or not isinstance(address, str):
        return None, address or ""
    # Match ", Unit X" where X is letters (A, B, C...) or numbers (1, 2, 101...); may be followed by more text
    m = re.search(r",\s*Unit\s+([A-Za-z0-9]+)\s*", address, re.IGNORECASE)
    if not m:
        return None, address
    unit_val = m.group(1).strip()
    unit_label = f"Unit {unit_val}"
    # Remove this part from address (comma and spaces around it)
    addr_without = address[: m.start()].strip()
    # Remove trailing comma if any
    if addr_without.endswith(","):
        addr_without = addr_without[:-1].strip()
    return unit_label, addr_without


def strip_city_state_from_address(address, city, state):
    """
    Remove trailing city/state/zip from address so we don't repeat e.g. "Houston TX 77011, Houston, Texas".
    Keeps only the street part. city and state are from Excel columns.
    """
    if not address or not isinstance(address, str):
        return address or ""
    addr = address.strip()
    city_clean = (city or "").strip()
    state_clean = (state or "").strip()
    if not city_clean and not state_clean:
        return addr
    # Strip trailing ", City ST 12345" or ", City, State" (case insensitive)
    # Try longest match first: ", City, State" then ", City ST 12345" then ", City"
    for sep in [f", {city_clean}, {state_clean}", f", {city_clean} {state_clean}", f", {city_clean}"]:
        if sep and addr.lower().endswith(sep.lower()):
            addr = addr[: -len(sep)].strip().rstrip(",").strip()
            break
    # Also strip " City ST 12345" (space before city, state abbr + zip)
    state_abbrev = (state_clean[:2] if len(state_clean) >= 2 else "").upper()
    if state_abbrev and city_clean:
        suffix = f" {city_clean} {state_abbrev}"
        if addr.lower().endswith(suffix.lower()):
            rest = addr[: -len(suffix)].strip().rstrip(",").strip()
            # Remove trailing zip if present (5 or 9 digits)
            if re.search(r"\d{5}(?:-\d{4})?\s*$", rest):
                rest = re.sub(r"\s+\d{5}(?:-\d{4})?\s*$", "", rest).strip().rstrip(",").strip()
            addr = rest
    return addr


def collect_image_paths(houses_dir):
    exts = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    paths = []
    if not houses_dir.is_dir():
        return paths
    for p in sorted(houses_dir.iterdir()):
        if p.is_file() and p.suffix.lower() in exts:
            paths.append(p)
    return paths


def find_column_index(headers, *candidates):
    """Return first column index whose normalized header matches any candidate."""
    for cand in candidates:
        c = cand.lower().replace(" ", "_").replace("-", "_")
        for i, h in enumerate(headers):
            if h == c or c in h or h in c:
                return i
    return None


def upload_image_to_cloudinary(file_path):
    """Upload a local image file to Cloudinary; return secure_url or None."""
    if not file_path or not Path(file_path).is_file():
        return None
    cloud_config = getattr(settings, "CLOUDINARY_STORAGE", None)
    if not cloud_config or not cloud_config.get("CLOUD_NAME"):
        return None
    try:
        import cloudinary.uploader
        if not cloudinary.config().api_secret:
            cloudinary.config(
                cloud_name=cloud_config["CLOUD_NAME"],
                api_key=cloud_config["API_KEY"],
                api_secret=cloud_config["API_SECRET"],
            )
        public_id = f"properties/import_{file_path.stem}_{file_path.suffix[1:]}"
        result = cloudinary.uploader.upload(
            str(file_path),
            resource_type="image",
            public_id=public_id,
            type="upload",
        )
        return result.get("secure_url")
    except Exception as e:
        logger.warning("Cloudinary upload failed for %s: %s", file_path, e)
        return None


class Command(BaseCommand):
    help = "Import properties from properties.xlsx and assign images from houses/"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only parse Excel and list what would be created, do not save.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        project_root = get_project_root()
        excel_path = get_excel_path()
        houses_dir = get_houses_dir()

        if not excel_path.is_file():
            self.stderr.write(self.style.ERROR(f"Excel file not found: {excel_path}"))
            return

        try:
            import openpyxl
        except ImportError:
            self.stderr.write(self.style.ERROR("Install openpyxl: pip install openpyxl"))
            return

        wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        if not rows:
            self.stdout.write("Excel file is empty.")
            return

        headers = [normalize_header(c) for c in rows[0]]
        name_col = find_column_index(headers, "name", "title", "property", "unit", "property_name")
        address_col = find_column_index(headers, "address", "street", "addr")
        city_col = find_column_index(headers, "city")
        state_col = find_column_index(headers, "state")
        price_col = find_column_index(headers, "price", "rent", "rent_amount", "monthly")
        beds_col = find_column_index(headers, "bed", "beds", "bedrooms", "br")
        baths_col = find_column_index(headers, "bath", "baths", "bathrooms")
        sqft_col = find_column_index(headers, "sqft", "square_feet", "square_footage", "sq_ft")
        status_col = find_column_index(headers, "status", "occupancy")

        if name_col is None:
            name_col = 0
        if address_col is None:
            address_col = 1 if len(headers) > 1 else 0
        if city_col is None:
            city_col = 2 if len(headers) > 2 else 0
        if state_col is None:
            state_col = 3 if len(headers) > 3 else 0

        image_paths = collect_image_paths(houses_dir)
        self.stdout.write(f"Found {len(image_paths)} images in houses/")

        from api.models import Property

        name_counts = {}
        created = 0
        updated = 0
        image_index = 0

        for row_idx, row in enumerate(rows[1:], start=2):
            if not row:
                continue
            cells = list(row)
            while len(cells) < len(headers):
                cells.append(None)

            name_raw = safe_str(cells[name_col] if name_col < len(cells) else None)
            if not name_raw:
                continue

            address_raw = safe_str(cells[address_col] if address_col < len(cells) else None) or "Address TBD"
            city = safe_str(cells[city_col] if city_col < len(cells) else None) or "City TBD"
            state = safe_str(cells[state_col] if state_col < len(cells) else None) or "State TBD"

            # Use unit from address (e.g. "Unit A", "Unit B") in the name and remove it from address
            unit_from_address, address_no_unit = extract_unit_from_address(address_raw)
            address = strip_city_state_from_address(address_no_unit, city, state) or "Address TBD"

            base_name = name_raw
            name_counts[base_name] = name_counts.get(base_name, 0) + 1
            count = name_counts[base_name]
            if unit_from_address:
                name = f"{base_name} - {unit_from_address}"
            elif count > 1:
                name = f"{base_name} - Unit {count}"
            else:
                name = base_name
            price = safe_decimal(cells[price_col] if price_col is not None and price_col < len(cells) else None)
            beds = safe_int(cells[beds_col] if beds_col is not None and beds_col < len(cells) else None, 2)
            baths_val = cells[baths_col] if baths_col is not None and baths_col < len(cells) else None
            try:
                baths = float(baths_val) if baths_val is not None and str(baths_val).strip() else 2.0
            except (ValueError, TypeError):
                baths = 2.0
            sqft = safe_int(cells[sqft_col] if sqft_col is not None and sqft_col < len(cells) else None, 1000)

            status_val = safe_str(cells[status_col] if status_col is not None and status_col < len(cells) else None).lower()
            status = "occupied" if status_val in ("occupied", "occ", "1", "yes", "y") else "vacant"

            image_url = None
            if image_paths:
                path = image_paths[image_index % len(image_paths)]
                image_index += 1
                if not dry_run:
                    image_url = upload_image_to_cloudinary(path)
                else:
                    image_url = f"(would use {path.name})"

            if dry_run:
                self.stdout.write(
                    f"  Would create/update: {name} | {address} | {city}, {state} | "
                    f"price={price} beds={beds} baths={baths} sqft={sqft} status={status} image={image_url}"
                )
                created += 1
                continue

            obj, was_created = Property.objects.update_or_create(
                name=name,
                defaults={
                    "address": address,
                    "city": city,
                    "state": state,
                    "price": price,
                    "bedrooms": beds,
                    "bathrooms": baths,
                    "square_footage": sqft,
                    "status": status,
                    "units": 1,
                },
            )
            if image_url and not str(image_url).startswith("(would"):
                obj.image_url = image_url
                obj.image = None
                obj.save(update_fields=["image_url", "image"])
            if was_created:
                created += 1
            else:
                updated += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"Dry run: would process {created} rows."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Done. Created: {created}, Updated: {updated}."))