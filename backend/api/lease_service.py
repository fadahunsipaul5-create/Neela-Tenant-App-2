"""
Lease generation and PDF creation service.
"""
import logging
from io import BytesIO
from datetime import datetime, timedelta
from django.conf import settings

logger = logging.getLogger(__name__)
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from .models import Tenant, LeaseTemplate, LegalDocument


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
        '{{lease_start_date}}': lease_start.strftime('%m/%d/%Y'),
        '{{lease_end_date}}': lease_end.strftime('%m/%d/%Y'),
        '{{employer}}': employment.get('employer', '[_Employer_]'),
        '{{job_title}}': employment.get('jobTitle', '[_JobTitle_]'),
        '{{monthly_income}}': f"${employment.get('monthlyIncome', 0):,.2f}" if employment.get('monthlyIncome') else '[_Income_]',
        '{{current_date}}': datetime.now().strftime('%m/%d/%Y'),
        '{{property_manager}}': getattr(settings, 'PROPERTY_MANAGER_NAME', 'PropGuard Management'),
        
        # Extended fields for Texas Lease
        '{{landlord_name}}': getattr(settings, 'LANDLORD_NAME', 'Rosa Martinez'), # Defaulting to client sample for now
        '{{landlord_address}}': getattr(settings, 'LANDLORD_ADDRESS', '6838 Avenue R, Houston, Texas, 77011'),
        '{{landlord_phone}}': getattr(settings, 'LANDLORD_PHONE', '(346) 255-6143'),
        '{{landlord_email}}': getattr(settings, 'LANDLORD_EMAIL', 'N/A'),
        
        # Address split helpers (assuming property_unit contains city/state or we default)
        '{{property_city_state_zip}}': 'Houston, Texas, 77011', # Ideally parsed from property model if available
        
        # Date helpers for Notices
        '{{period_start_date}}': lease_start.replace(day=1).strftime('%m/%d/%Y'), # Default to 1st of start month
        '{{period_end_date}}': (lease_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1), # End of that month
        
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
        '{{date_of_birth}}': application_data.get('dateOfBirth') or application_data.get('dob') or '[_DOB_]',
        '{{driver_license}}': application_data.get('driverLicense') or '[_DL_]',
        '{{dl_state}}': application_data.get('driverLicenseState') or '[_DLState_]',
        '{{ssn}}': application_data.get('ssn') or application_data.get('ssnLast4') or '[_SSN_]',
        '{{marital_status}}': application_data.get('maritalStatus') or '[_Marital_]',
        '{{citizenship}}': application_data.get('citizenship') or '[_Citizen_]',
        '{{height}}': application_data.get('height') or '[_Height_]',
        '{{weight}}': application_data.get('weight') or '[_Weight_]',
        '{{hair_color}}': application_data.get('hairColor') or '[_Hair_]',
        '{{eye_color}}': application_data.get('eyeColor') or '[_Eye_]',
        
        # Emergency Contact
        '{{emergency_contact_name}}': application_data.get('emergencyContact') or '[_EmergName_]',
        '{{emergency_contact_phone}}': application_data.get('emergencyContactPhone') or '[_EmergPhone_]',
        '{{emergency_contact_address}}': application_data.get('emergencyContactAddress') or '[_EmergAddr_]',
        '{{emergency_contact_email}}': application_data.get('emergencyContactEmail') or '[_EmergEmail_]',
        
        # Vehicles
        # If we have a list, we might need to join it or just take the first few
        '{{vehicles_list}}': ', '.join([f"{v.get('year')} {v.get('make')} {v.get('model')}" for v in application_data.get('vehicles', [])]) if application_data.get('vehicles') else 'None',
        
        # Pets
        '{{pets_description}}': ', '.join([f"{p.get('type')} ({p.get('name')})" for p in application_data.get('pets', [])]) if application_data.get('pets') else 'No Pets',
        '{{has_pets_check}}': '[x]' if application_data.get('pets') else '[_PetY_]',
        '{{no_pets_check}}': '[ ]' if application_data.get('pets') else '[_PetN_]',
        
        # Employment (Extended)
        '{{supervisor_name}}': employment.get('supervisorName') or '[_SupName_]',
        '{{supervisor_phone}}': employment.get('supervisorPhone') or '[_SupPhone_]',
        '{{employment_start_date}}': employment.get('startDate') or '[_EmpStart_]',
        '{{employment_duration}}': employment.get('duration') or '[_EmpDur_]',
        
        # Rental History
        '{{previous_address}}': application_data.get('previousAddress') or '[_PrevAddr_]',
        '{{previous_landlord}}': application_data.get('previousLandlordInfo') or '[_PrevLandlord_]',
        '{{previous_rent}}': application_data.get('previousRent') or '[_PrevRent_]',
        '{{reason_for_leaving}}': application_data.get('reasonForLeaving') or '[_LeaveReason_]',
        
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

Landlord's Signature: _________________________
{{landlord_name}}
Date: _________________________

Tenant's Signature: _________________________
{{tenant_name}}
Date: _________________________"""


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
    # Create or update legal document
    legal_doc, created = LegalDocument.objects.get_or_create(
        tenant=tenant,
        type='Lease Agreement',
        defaults={
            'generated_content': filled_content,
            'status': 'Draft',
        }
    )
    
    if not created:
        legal_doc.generated_content = filled_content
        legal_doc.status = 'Draft'
    
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
            
            public_id = f"media/leases/{filename}" 
            if public_id.endswith('.pdf'):
                public_id = public_id[:-4]

            logger.info(f"Uploading lease PDF to Cloudinary with public_id: {public_id}")
            
            # Try to upload WITHOUT format="pdf" to see if that helps avoid confusion
            upload_result = cloudinary.uploader.upload(
                pdf_buffer, 
                resource_type="raw", 
                public_id=public_id,
                # format="pdf"  # Removed format to avoid double extension or raw/image confusion
            )
            
            logger.info(f"Cloudinary upload successful. Result public_id: {upload_result.get('public_id')}")
            
            # Manually set the file name/path to what Cloudinary returned or the expected path
            # django-cloudinary-storage typically expects just the name if configured correctly, 
            # but storing the public_id ensures we can retrieve it.
            legal_doc.pdf_file.name = upload_result.get('public_id')
            legal_doc.save()
            
        except Exception as e:
            # Fallback to standard save if Cloudinary manual upload fails
            print(f"Cloudinary raw upload failed, falling back to standard storage: {e}")
            pdf_buffer.seek(0)
            legal_doc.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)
    else:
        # Standard local storage
        legal_doc.pdf_file.save(filename, ContentFile(pdf_buffer.read()), save=True)
    
    return legal_doc


def process_docusign_status_update(legal_doc: LegalDocument) -> dict:
    """
    Check status of a DocuSign envelope and update the legal document accordingly.
    Can be called by API views or background tasks.
    
    Args:
        legal_doc: LegalDocument instance
        
    Returns:
        Dictionary with status information and results of any actions taken
    """
    from .docusign_service import get_envelope_status, download_signed_document
    from .email_service import send_lease_signed_confirmation, send_acceptance_email_to_user
    from accounts.user_service import create_user_from_tenant, generate_password_reset_token, get_password_reset_url
    from django.utils import timezone
    from django.core.files.base import ContentFile
    
    if not legal_doc.docusign_envelope_id:
        return {'status': legal_doc.status, 'message': 'No envelope ID found'}

    try:
        # Get status from DocuSign
        status_info = get_envelope_status(legal_doc.docusign_envelope_id)
        
        if not status_info:
            return {'status': legal_doc.status, 'message': 'Could not fetch status from DocuSign'}
            
        ds_status = status_info.get('status')
        
        result = {
            'status': legal_doc.status,
            'docusign_status': ds_status,
            'updated': False,
            'actions': []
        }
        
        # Map DocuSign status to our status
        if ds_status == 'completed':
            if legal_doc.status != 'Signed':
                # Update status
                legal_doc.status = 'Signed'
                legal_doc.signed_at = timezone.now()
                
                # Download signed document
                signed_pdf_content = download_signed_document(legal_doc.docusign_envelope_id)
                if signed_pdf_content:
                    # Save as signed PDF
                    filename = f"signed_lease_{legal_doc.tenant.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
                    legal_doc.pdf_file.save(filename, ContentFile(signed_pdf_content), save=False)
                    result['actions'].append('downloaded_signed_pdf')
                
                legal_doc.save()
                
                # Update tenant
                tenant = legal_doc.tenant
                tenant.lease_status = 'Signed'
                tenant.save()
                result['updated'] = True
                
                # Send confirmation
                try:
                    send_lease_signed_confirmation.delay(legal_doc.id)
                    result['actions'].append('sent_confirmation_email')
                except:
                    send_lease_signed_confirmation(legal_doc.id)
                    result['actions'].append('sent_confirmation_email_sync')

                # CRITICAL: Check if user account exists, if not, create it and send setup email
                try:
                    user, created = create_user_from_tenant(tenant)
                    # We should send the welcome email if the user was JUST created
                    # OR if they don't have a usable password yet (pending setup)
                    if created or not user.has_usable_password():
                        logger.info(f"Preparing account setup email for tenant {tenant.id} (created={created})")
                        # Generate password reset token for account setup
                        token, uidb64 = generate_password_reset_token(user)
                        
                        # Get frontend URL from settings
                        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
                        reset_url = get_password_reset_url(uidb64, token, frontend_url)
                        
                        # Send acceptance/welcome email with password setup link
                        try:
                            send_acceptance_email_to_user.delay(tenant.id, token, reset_url)
                            logger.info(f"Account setup email task submitted for tenant {tenant.id}")
                            result['actions'].append('sent_account_setup_email')
                        except Exception as e:
                            logger.warning(f"Celery connection failed, using threading fallback for account setup: {e}")
                            send_acceptance_email_to_user(tenant.id, token, reset_url)
                            result['actions'].append('sent_account_setup_email_sync')
                    else:
                        logger.info(f"User {user.email} already has a password set. Skipping setup email.")
                        
                except Exception as e:
                     logger.error(f"Error ensuring user account exists after lease signing: {e}", exc_info=True)
                     result['errors'] = str(e)

        elif ds_status in ['declined', 'voided']:
            if legal_doc.status != 'Declined' and legal_doc.status != 'Voided':
                new_status = 'Declined' if ds_status == 'declined' else 'Voided'
                legal_doc.status = new_status
                legal_doc.save()
                
                tenant = legal_doc.tenant
                tenant.lease_status = new_status
                tenant.save()
                
                result['updated'] = True
                result['status'] = new_status

        return result
        
    except Exception as e:
        logger.error(f"Error processing DocuSign status update: {e}", exc_info=True)
        raise e

