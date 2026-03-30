
import base64
import logging
import re
from io import BytesIO
from datetime import datetime, timedelta
from typing import Any
import fitz

from django.conf import settings

logger = logging.getLogger(__name__)
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from .models import Tenant, LeaseTemplate, LegalDocument


def _property_city_state_zip(tenant: Tenant) -> str:
    """Derive property city/state/zip from tenant.property_unit or settings."""
    pu = (tenant.property_unit or '').strip()
    if pu:
        parts = [p.strip() for p in pu.split(',') if p.strip()]
        if len(parts) >= 2:
            return ', '.join(parts[-2:])  # e.g. "Houston, TX 77001"
        if len(parts) >= 3:
            return ', '.join(parts[-3:])   # e.g. "Houston, Texas, 77011"
    return getattr(settings, 'PROPERTY_DEFAULT_CITY_STATE_ZIP', None) or '[Property City, State ZIP]'


def _last_day_of_month(d):
    """Return the last day of the month for date d."""
    next_first = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
    return next_first - timedelta(days=1)


def fill_lease_template(template_content: str, tenant: Tenant) -> str:
    """
    Fill lease template with tenant data.
    
    Args:
        template_content: Template string with placeholders
        tenant: Tenant instance
        
    Returns:
        Filled template string
    """
    # Extract name parts
    name_parts = tenant.name.split(' ', 1)
    first_name = name_parts[0] if len(name_parts) > 0 else tenant.name
    last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    # Calculate lease dates (default to 1 year from today)
    lease_start = tenant.lease_start or datetime.now().date()
    if not tenant.lease_end:
        lease_end = lease_start + timedelta(days=365)
    else:
        lease_end = tenant.lease_end
    
    # Get employment info from application data
    employment = tenant.application_data.get('employment', {}) if tenant.application_data else {}
    application_data = tenant.application_data or {}

    # Parse emergency contact (stored as "Name, Relationship, Phone")
    ec_full = application_data.get('emergencyContact', '')
    ec_parts = [p.strip() for p in ec_full.split(',')] if ec_full else []
    ec_name = ec_parts[0] if len(ec_parts) >= 1 else ''
    ec_phone = ec_parts[2] if len(ec_parts) >= 3 else ''

    # Get other occupants
    other_occupants = application_data.get('otherOccupants', 'None')
    if not other_occupants and application_data.get('hasOtherAdults'):
         # specific handling if needed
         pass

    # Extract bedrooms/bathrooms from application data
    # We use the first desired option as the default for the lease if specific unit details aren't available
    bedrooms_list = application_data.get('bedroomsDesired')
    bedrooms_val = str(bedrooms_list[0]) if isinstance(bedrooms_list, list) and bedrooms_list else '[_Beds_]'
    
    bathrooms_list = application_data.get('bathroomsDesired')
    bathrooms_val = str(bathrooms_list[0]) if isinstance(bathrooms_list, list) and bathrooms_list else '[_Baths_]'

    # Template variables
    replacements = {
        '{{tenant_name}}': tenant.name,
        '{{tenant_first_name}}': first_name,
        '{{tenant_last_name}}': last_name,
        '{{tenant_email}}': tenant.email,
        '{{tenant_phone}}': tenant.phone,
        '{{property_unit}}': tenant.property_unit,
        '{{rent_amount}}': f"${tenant.rent_amount:,.2f}",
        '{{deposit_amount}}': f"${tenant.deposit:,.2f}",
        # Backward-compatible aliases used by some legal/compliance templates
        '{{deposit}}': f"{tenant.deposit:,.2f}",
        '{{lease_start_date}}': lease_start.strftime('%m/%d/%Y'),
        '{{lease_end_date}}': lease_end.strftime('%m/%d/%Y'),
        '{{lease_start}}': lease_start.strftime('%m/%d/%Y'),
        '{{lease_end}}': lease_end.strftime('%m/%d/%Y'),
        '{{employer}}': (
            application_data.get('currentEmployer') or
            employment.get('employer') or
            '__________'
        ),
        '{{job_title}}': employment.get('jobTitle') or application_data.get('jobTitle') or '__________',
        '{{monthly_income}}': (
            f"${float(employment.get('monthlyIncome')):,.2f}"
            if employment.get('monthlyIncome') not in (None, '')
            else (
                f"${float(application_data.get('monthlyIncome')):,.2f}"
                if application_data.get('monthlyIncome') not in (None, '')
                else '__________'
            )
        ),
        '{{current_date}}': datetime.now().strftime('%m/%d/%Y'),
        '{{property_manager}}': getattr(settings, 'PROPERTY_MANAGER_NAME', None) or 'Neela Capital Investment',
        
        # Landlord/company from settings only (no hardcoded defaults)
        '{{landlord_name}}': getattr(settings, 'LANDLORD_NAME', None) or '[Landlord Name]',
        '{{landlord_address}}': getattr(settings, 'LANDLORD_ADDRESS', None) or '[Landlord Address]',
        '{{landlord_phone}}': getattr(settings, 'LANDLORD_PHONE', None) or '[Landlord Phone]',
        '{{landlord_email}}': getattr(settings, 'LANDLORD_EMAIL', None) or '[Landlord Email]',
        
        # Property city/state/zip: derive from tenant.property_unit when it contains commas, else settings or placeholder
        '{{property_city_state_zip}}': _property_city_state_zip(tenant),
        # Aliases used in some templates (e.g. Settings UI)
        '{{company_name}}': getattr(settings, 'PROPERTY_MANAGER_NAME', None) or getattr(settings, 'LANDLORD_NAME', None) or 'Neela Capital Investment',
        '{{property_address}}': tenant.property_unit or '[Property Address]',
        
        # Date helpers for Notices
        '{{period_start_date}}': lease_start.replace(day=1).strftime('%m/%d/%Y'),
        '{{period_end_date}}': (_last_day_of_month(lease_start)).strftime('%m/%d/%Y'),
        
        # Termination Helper (Default to 30 days from now)
        '{{move_out_deadline}}': (datetime.now() + timedelta(days=30)).strftime('%B %d, %Y'),
        
        # New helpers for Application Packet
        '{{tenant_current_address}}': application_data.get('currentAddress', ''),
        '{{move_in_date}}': application_data.get('desiredMoveInDate', ''),
        
        '{{occupants}}': other_occupants,
        
        # --- APPLICATION DATA MAPPING ---
        # This maps fields from the frontend Application Form directly to the Lease/Notice
        
        # Property Preferences
        '{{bedrooms_desired}}': bedrooms_val,
        '{{bathrooms_desired}}': bathrooms_val,
        
        # Personal Info (Extended)
        '{{date_of_birth}}': application_data.get('dateOfBirth') or application_data.get('dob') or '__________',
        '{{driver_license}}': application_data.get('driverLicense') or '__________',
        '{{dl_state}}': application_data.get('driverLicenseState') or '__________',
        '{{ssn}}': application_data.get('ssn') or application_data.get('ssnLast4') or '__________',
        '{{marital_status}}': application_data.get('maritalStatus') or '__________',
        '{{citizenship}}': application_data.get('citizenship') or '__________',
        '{{height}}': application_data.get('height') or '__________',
        '{{weight}}': application_data.get('weight') or '__________',
        '{{hair_color}}': application_data.get('hairColor') or '__________',
        '{{eye_color}}': application_data.get('eyeColor') or '__________',

        # Emergency Contact (parsed from combined "Name, Relationship, Phone" string)
        '{{emergency_contact_name}}': ec_name or '__________',
        '{{emergency_contact_phone}}': ec_phone or '__________',
        '{{emergency_contact_address}}': application_data.get('emergencyContactAddress') or '__________',
        '{{emergency_contact_email}}': application_data.get('emergencyContactEmail') or '__________',
        
        # Vehicles
        # If we have a list, we might need to join it or just take the first few
        '{{vehicles_list}}': ', '.join([f"{v.get('year')} {v.get('make')} {v.get('model')}" for v in application_data.get('vehicles', [])]) if application_data.get('vehicles') else 'None',
        
        # Pets
        '{{pets_description}}': ', '.join([f"{p.get('type')} ({p.get('name')})" for p in application_data.get('pets', [])]) if application_data.get('pets') else 'No Pets',
        '{{has_pets_check}}': '[x]' if application_data.get('pets') else '[_PetY_]',
        '{{no_pets_check}}': '[ ]' if application_data.get('pets') else '[_PetN_]',
        
        # Employment (Extended)
        '{{supervisor_name}}': employment.get('supervisorName') or '__________',
        '{{supervisor_phone}}': employment.get('supervisorPhone') or '__________',
        '{{employment_start_date}}': employment.get('startDate') or '__________',
        '{{employment_duration}}': employment.get('duration') or '__________',
        
        # Rental History
        '{{previous_address}}': application_data.get('previousAddress') or '__________',
        '{{previous_landlord}}': application_data.get('previousLandlordInfo') or '__________',
        '{{previous_landlord_phone}}': application_data.get('previousLandlordPhone') or '__________',
        '{{previous_landlord_email}}': application_data.get('previousLandlordEmail') or '__________',
        '{{previous_rent}}': application_data.get('previousRent') or '__________',
        '{{reason_for_leaving}}': application_data.get('reasonForLeaving') or '__________',
        '{{move_in_date_prev}}': application_data.get('prevMoveInDate') or '__________',
        '{{move_out_date_prev}}': application_data.get('prevMoveOutDate') or '__________',
        
        # Standard Placeholders (if not mapped above)
        '{{bedrooms}}': bedrooms_val,
        '{{bathrooms}}': bathrooms_val,
        '{{late_fee_amount}}': '$50.00',
        '{{late_fee_day}}': '3rd',
        '{{returned_check_fee}}': '$55.00',
    }
    
    # Replace all placeholders
    filled_content = template_content
    for placeholder, value in replacements.items():
        filled_content = filled_content.replace(placeholder, str(value))
    
    return filled_content


def generate_lease_pdf(tenant: Tenant, template: LeaseTemplate = None):
    """
    Generate PDF lease document from template.
    
    Args:
        tenant: Tenant instance
        template: LeaseTemplate instance (optional, uses default if not provided)
        
    Returns:
        tuple: (PDF BytesIO object, filled content string)
    """
    # Get template
    if not template:
        template = LeaseTemplate.objects.filter(is_active=True).first()
        if not template:
            # Create default template if none exists
            template = LeaseTemplate.objects.create(
                name='Standard Residential Lease',
                content=get_default_lease_template(),
                is_active=True
            )
    
    # Fill template with tenant data
    filled_content = fill_lease_template(template.content, tenant)
    
    # Create PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                           rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=18)
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Define styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=30,
        alignment=1,  # Center
    )
    
    # Add title
    elements.append(Paragraph("RESIDENTIAL LEASE AGREEMENT", title_style))
    elements.append(Spacer(1, 0.2*inch))
    
    # Split content into paragraphs and add to PDF
    paragraphs = filled_content.split('\n\n')
    for para in paragraphs:
        if para.strip():
            # Clean up the paragraph
            para = para.strip().replace('\n', '<br/>')
            elements.append(Paragraph(para, styles['Normal']))
            elements.append(Spacer(1, 0.1*inch))
    
    # Build PDF
    doc.build(elements)
    
    # Reset buffer position
    buffer.seek(0)
    
    return buffer, filled_content


def get_default_lease_template() -> str:
    """Return default lease template content."""
    return """RESIDENTIAL LEASE AGREEMENT

This Lease Agreement ("Lease") is entered into on {{current_date}} between {{property_manager}} ("Landlord") and {{tenant_name}} ("Tenant").

1. PROPERTY
Landlord leases to Tenant the property located at {{property_unit}} (the "Property").

2. TERM
The lease term begins on {{lease_start_date}} and ends on {{lease_end_date}}.

3. RENT
Tenant agrees to pay Landlord monthly rent of {{rent_amount}} per month, due on the first day of each month.

4. SECURITY DEPOSIT
Tenant has paid a security deposit of {{deposit_amount}} which will be held by Landlord as security for the performance of Tenant's obligations under this Lease.

5. TENANT INFORMATION
Tenant Name: {{tenant_name}}
Email: {{tenant_email}}
Phone: {{tenant_phone}}
Employer: {{employer}}
Job Title: {{job_title}}
Monthly Income: {{monthly_income}}

6. OBLIGATIONS
Tenant agrees to:
- Pay rent on time
- Keep the Property clean and in good condition
- Not disturb other tenants
- Comply with all applicable laws and regulations

7. DEFAULT
If Tenant fails to pay rent or breaches any term of this Lease, Landlord may terminate this Lease.

8. SIGNATURES
By signing below, both parties agree to the terms of this Lease.

Landlord's Signature: _________________________  Date: {{current_date}}
{{landlord_name}}


Tenant's Signature: _________________________  Date: {{current_date}}
{{tenant_name}}"""


def save_lease_document(tenant: Tenant, pdf_buffer: BytesIO, filled_content: str) -> LegalDocument:
    """
    Save lease document to database and storage.
    
    Args:
        tenant: Tenant instance
        pdf_buffer: PDF file buffer
        filled_content: Filled template content
        
    Returns:
        LegalDocument instance
    """
    # Always create a NEW legal document (each generation is a new version)
    # Don't reuse old leases - they serve as history
    legal_doc = LegalDocument.objects.create(
        tenant=tenant,
        type='Lease Agreement',
        generated_content=filled_content,
        status='Draft',
    )
    
    # Save PDF file
    filename = f"lease_{tenant.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    
    # Check if using Cloudinary storage
    if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
        try:
            import cloudinary.uploader
            # Reset buffer
            pdf_buffer.seek(0)
            
            # Configure Cloudinary explicitly if needed
            if not cloudinary.config().api_secret:
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
                    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
                    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
                )
            
            # Upload as raw file
            # Use f"media/leases/{filename}" to match what Django storage likely expects for retrieval
            # The Cloudinary storage backend typically prepends MEDIA_TAG or similar if configured.
            # Even if we upload manually, if we set the name to "media/leases/...", the backend will look there.
            
            # CRITICAL: Remove the .pdf extension from public_id because format="pdf" adds it?
            # Or keep it and remove format="pdf"?
            # Cloudinary raw resources with format often duplicate extensions.
            
            # IMPORTANT: For Cloudinary, keep public_id WITHOUT file extension.
            # Cloudinary stores the "format" separately, and admin signed download URLs
            # (private_download_url) expect a public_id without extension.
            public_id = f"media/leases/{filename}"
            if public_id.lower().endswith(".pdf"):
                public_id = public_id[:-4]
            # if public_id.endswith('.pdf'):
            #     public_id = public_id[:-4]

            logger.info(f"Uploading lease PDF to Cloudinary with public_id: {public_id}")
            
            # Check actual buffer size
            pdf_buffer.seek(0, 2)  # Seek to end
            actual_size = pdf_buffer.tell()  # Get size
            pdf_buffer.seek(0)  # CRITICAL: Reset to beginning for upload!
            
            logger.info(f"Buffer size: {actual_size} bytes")
            
            # OPTION A: Upload PDF as raw + public.
            # This does not guarantee CDN access (Cloudinary access control can still return 401),
            # but it ensures the asset exists as a raw resource and can be fetched via
            # Cloudinary admin-signed URLs for server-side retrieval.
            upload_result = cloudinary.uploader.upload(
                pdf_buffer, 
                resource_type="raw", 
                public_id=public_id,
                type="upload",  # public delivery type
                format="pdf",
            )
            
            logger.info(f"Cloudinary upload successful!")
            logger.info(f"Result public_id: {upload_result.get('public_id')}")
            logger.info(f"Result secure_url: {upload_result.get('secure_url')}")
            logger.info(f"Result format: {upload_result.get('format')}")
            
            # IMPORTANT: django-cloudinary-storage expects `name` to be the Cloudinary public_id
            # (WITHOUT the extension). If we store "foo.pdf" here, Cloudinary URLs can become "foo.pdf.pdf".
            uploaded_public_id = upload_result.get('public_id') or public_id
            legal_doc.pdf_file.name = uploaded_public_id
            legal_doc.save()
            
            logger.info(f"Saved legal_doc.pdf_file.name: {legal_doc.pdf_file.name}")
            
        except Exception as e:
            # Log the error properly
            logger.error(f"Cloudinary raw upload failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Fallback to standard save if Cloudinary manual upload fails
            try:
                pdf_buffer.seek(0)
                legal_doc.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)
                logger.info(f"Fallback save completed: {legal_doc.pdf_file.name}")
            except Exception as fallback_error:
                logger.error(f"Fallback save also failed: {fallback_error}")
                raise
    else:
        # Standard local storage
        legal_doc.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)
    
    return legal_doc


# Letter size in points (PyMuPDF / PDF coordinate system)
_PDF_PAGE_WIDTH = 612
_PDF_PAGE_HEIGHT = 792


def stamp_signed_pdf(pdf_bytes: bytes, fields: list[dict], values: dict[str, Any]) -> bytes:

    if not pdf_bytes or not isinstance(fields, list):
        raise ValueError("pdf_bytes and fields required")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    if len(doc) == 0:
        doc.close()
        raise ValueError("PDF has no pages")
    out = BytesIO()
    try:
        for field in fields:
            field_id = field.get("id")
            field_type = field.get("type")
            if not field_id or field_type not in ("checkbox", "text", "signature"):
                continue
            raw = values.get(field_id)
            if raw is None:
                continue
            page_index = max(0, int(field.get("page", 1)) - 1)
            if page_index >= len(doc):
                continue
            page = doc[page_index]
            x = float(field.get("x", 0))
            y = float(field.get("y", 0))
            w = float(field.get("width", 0.1))
            h = float(field.get("height", 0.05))
            left = x * _PDF_PAGE_WIDTH
            top = y * _PDF_PAGE_HEIGHT
            right = (x + w) * _PDF_PAGE_WIDTH
            bottom = (y + h) * _PDF_PAGE_HEIGHT
            rect = fitz.Rect(left, top, right, bottom)

            if field_type == "checkbox":
                checked = raw is True or (isinstance(raw, str) and str(raw).lower() in ("true", "1", "yes", "x"))
                if checked:
                    cx = (left + right) / 2
                    fontsize = min(14, rect.height * 0.8)
                    pt = fitz.Point(cx - fontsize * 0.3, rect.y1 - 2)
                    page.insert_text(pt, "✓", fontsize=fontsize, color=(0, 0, 0))
            elif field_type == "text":
                text = str(raw).strip() if raw else ""
                if text:
                    page.insert_textbox(rect, text, fontsize=10, fontname="helv", align=0)
            elif field_type == "signature":
                if isinstance(raw, str) and raw.startswith("data:image"):
                    try:
                        payload = raw.split(",", 1)[1]
                        image_bytes = base64.b64decode(payload)
                        if image_bytes:
                            page.insert_image(rect, stream=image_bytes)
                    except Exception as e:
                        logger.warning("Failed to stamp signature image for %s: %s", field_id, e)
    finally:
        doc.save(out, deflate=True, garbage=4)
        doc.close()
    return out.getvalue()


