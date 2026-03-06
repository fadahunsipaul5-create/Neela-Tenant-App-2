"""
Export all properties to properties_data.json in the backend root.
Run: python manage.py export_properties
"""
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.conf import settings

from api.models import Property


class Command(BaseCommand):
    help = "Export properties to properties_data.json"

    def handle(self, *args, **options):
        out_path = Path(settings.BASE_DIR) / "properties_data.json"
        qs = Property.objects.all().order_by("id")
        rows = []
        for p in qs:
            img = None
            if p.image:
                img = p.image.url
            else:
                img = p.image_url
            rows.append({
                "id": p.id,
                "name": p.name,
                "address": p.address,
                "city": p.city,
                "state": p.state,
                "units": p.units,
                "price": str(p.price) if p.price is not None else None,
                "bedrooms": p.bedrooms,
                "bathrooms": str(p.bathrooms),
                "square_footage": p.square_footage,
                "image_url": img,
                "furnishing_type": p.furnishing_type,
                "furnishings_breakdown": p.furnishings_breakdown or [],
                "status": p.status,
            })
        out_path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Exported {len(rows)} properties to {out_path}"))
