from rest_framework import viewsets, parsers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import *
from .serializers import *
from .lease_service import generate_lease_pdf, save_lease_document
from .docusign_service import *
try:
    from docusign_esign.client.api_exception import ApiException as DocusignApiException
except Exception:
    DocusignApiException = Exception
from .email_service import *
from accounts.user_service import *
from django.utils import timezone
import time
from django.conf import settings
import logging
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib import colors
from django.core.files.base import ContentFile
from django.http import HttpResponse
logger = logging.getLogger(__name__)

# Note: OAuth callback and token refresh functions removed - using JWT authentication instead
# JWT authentication is handled automatically by get_docusign_api_client() in docusign_service.py

class DocuSignViewSet(viewsets.ViewSet):
    @action(detail=False, methods=['get'])
    def callback(self, request):
        code = request.GET.get('code')
        return Response({"message": "Consent granted", "code": code})

class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [AllowAny]  # Require auth for most operations
        
    def perform_create(self, serializer):
        tenant = serializer.save()
        
        if tenant.status == 'Applicant':
            try:
                # Try async with Celery
                task = send_application_notification_to_admin.delay(tenant.id)
                logger.info(f"Email task submitted to Celery: {task.id}")
            except Exception as e:
                # Fallback to threading if Celery connection fails (non-blocking)
                logger.warning(f"Celery connection failed, using threading fallback: {e}")
                send_application_notification_to_admin(tenant.id)  # Will use threading internally
    
    def perform_update(self, serializer):
        """Override to handle status changes and send acceptance email."""
        old_instance = self.get_object()
        old_status = old_instance.status
        
        tenant = serializer.save()
        new_status = tenant.status
        
        # If status changed from 'Applicant' to 'Approved', send acceptance email
        if old_status == 'Applicant' and new_status == 'Approved':
            # Create user account if it doesn't exist
            user, created = create_user_from_tenant(tenant)
            
            # Auto-generate lease document
            try:
                # Check if lease already exists to prevent duplicates
                if not LegalDocument.objects.filter(tenant=tenant, type='Lease Agreement').exists():
                    pdf_buffer, filled_content = generate_lease_pdf(tenant)
                    save_lease_document(tenant, pdf_buffer, filled_content)
                    logger.info(f"Lease automatically generated for tenant {tenant.id}")
            except Exception as e:
                logger.error(f"Failed to auto-generate lease for tenant {tenant.id}: {e}")

            # Generate password reset token
            token, uidb64 = generate_password_reset_token(user)
            
            # Get frontend URL from settings
            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
            reset_url = get_password_reset_url(uidb64, token, frontend_url)
            
            # Send acceptance email with password reset link
            try:
                # Try async with Celery
                task = send_acceptance_email_to_user.delay(tenant.id, token, reset_url)
                logger.info(f"Email task submitted to Celery: {task.id}")
            except Exception as e:
                # Fallback to threading if Celery connection fails (non-blocking)
                logger.warning(f"Celery connection failed, using threading fallback: {e}")
                send_acceptance_email_to_user(tenant.id, token, reset_url)  # Will use threading internally
        
        # If status changed to 'Declined' or similar rejection status, send declined email
        if old_status == 'Applicant' and new_status in ['Declined', 'Rejected', 'Denied']:
            try:
                task = send_application_declined_email_to_user.delay(tenant.id)
                logger.info(f"Application declined email task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for declined email: {e}")
                send_application_declined_email_to_user(tenant.id)
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated], url_path='me', url_name='me')
    def me(self, request):
        """
        Get the current authenticated user's tenant data.
        GET /api/tenants/me/
        """
        user = request.user
        try:
            tenant = Tenant.objects.filter(email=user.email).first()
            if not tenant:
                return Response(
                    {'error': 'No tenant found for this user'},
                    status=status.HTTP_404_NOT_FOUND
                )
            serializer = self.get_serializer(tenant)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching tenant for user {user.email}: {e}")
            return Response(
                {'error': 'Failed to fetch tenant data'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]  # Require authentication for payments
    
    def perform_create(self, serializer):
        """Override to send invoice email when payment is created."""
        payment = serializer.save()
        
        # Send invoice email to tenant
        try:
            task = send_payment_invoice_to_tenant.delay(payment.id)
            logger.info(f"Payment invoice task submitted to Celery: {task.id}")
        except Exception as e:
            logger.warning(f"Celery connection failed, using threading fallback for payment invoice: {e}")
            send_payment_invoice_to_tenant(payment.id)
        
        # Send confirmation email if payment method is provided
        if payment.method:
            try:
                task = send_payment_confirmation_to_tenant.delay(payment.id)
                logger.info(f"Payment confirmation task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for payment confirmation: {e}")
                send_payment_confirmation_to_tenant(payment.id)
    
    def perform_update(self, serializer):
        """Override to send receipt email when payment status changes to 'Paid'."""
        old_instance = self.get_object()
        old_status = old_instance.status
        
        payment = serializer.save()
        new_status = payment.status
        
        # If status changed to 'Paid', send receipt email
        if old_status != 'Paid' and new_status == 'Paid':
            try:
                task = send_payment_receipt_to_tenant.delay(payment.id)
                logger.info(f"Payment receipt task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for payment receipt: {e}")
                send_payment_receipt_to_tenant(payment.id)

class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRequest.objects.all()
    serializer_class = MaintenanceRequestSerializer
    
    def get_permissions(self):
        """
        Allow public access for create (tenants can submit maintenance requests),
        but require authentication for list, retrieve, update, delete.
        """
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def perform_create(self, serializer):
        """Override to send email notifications when maintenance request is created."""
        maintenance_request = serializer.save()
        
        # Send email notification to 
        try:
            task = send_maintenance_ticket_notification_to_manager.delay(maintenance_request.id)
            logger.info(f"Maintenance ticket notification task submitted to Celery: {task.id}")
        except Exception as e:
            logger.warning(f"Celery connection failed, using threading fallback for maintenance notification: {e}")
            send_maintenance_ticket_notification_to_manager(maintenance_request.id)
        
        # Send confirmation email to tenant
        try:
            task = send_maintenance_ticket_confirmation_to_tenant.delay(maintenance_request.id)
            logger.info(f"Maintenance ticket confirmation task submitted to Celery: {task.id}")
        except Exception as e:
            logger.warning(f"Celery connection failed, using threading fallback for maintenance confirmation: {e}")
            send_maintenance_ticket_confirmation_to_tenant(maintenance_request.id)
    
    def perform_update(self, serializer):
        """Override to handle status changes and comments, sending appropriate emails."""
        old_instance = self.get_object()
        old_status = old_instance.status
        old_updates = old_instance.updates or []
        
        maintenance_request = serializer.save()
        new_status = maintenance_request.status
        new_updates = maintenance_request.updates or []
        
        # Detect status change and send email to tenant
        if old_status != new_status:
            update_message = None
            # Check if there's a status update message in the updates
            if new_updates:
                latest_update = new_updates[-1] if isinstance(new_updates, list) else None
                if latest_update and isinstance(latest_update, dict):
                    update_message = latest_update.get('message', '')
            
            try:
                task = send_maintenance_status_update_to_tenant.delay(
                    maintenance_request.id, old_status, new_status, update_message
                )
                logger.info(f"Maintenance status update task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for status update: {e}")
                send_maintenance_status_update_to_tenant(maintenance_request.id, old_status, new_status, update_message)
        
        # Detect new comments (new items in updates array)
        if len(new_updates) > len(old_updates):
            # Find the new comment(s)
            new_comments = new_updates[len(old_updates):]
            for comment in new_comments:
                if isinstance(comment, dict):
                    comment_author = comment.get('author', 'Property Management')
                    comment_message = comment.get('message', '')
                    comment_date = comment.get('date', '')
                    
                    if comment_message:  # Only send if there's actual message content
                        try:
                            task = send_maintenance_comment_notification_to_tenant.delay(
                                maintenance_request.id, comment_author, comment_message, comment_date
                            )
                            logger.info(f"Maintenance comment notification task submitted to Celery: {task.id}")
                        except Exception as e:
                            logger.warning(f"Celery connection failed, using threading fallback for comment notification: {e}")
                            send_maintenance_comment_notification_to_tenant(
                                maintenance_request.id, comment_author, comment_message, comment_date
                            )

class LeaseTemplateViewSet(viewsets.ModelViewSet):
    queryset = LeaseTemplate.objects.all()
    serializer_class = LeaseTemplateSerializer

class LegalDocumentViewSet(viewsets.ModelViewSet):
    queryset = LegalDocument.objects.all()
    serializer_class = LegalDocumentSerializer
    permission_classes = [IsAuthenticated]  # Require authentication for legal documents
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        queryset = LegalDocument.objects.all()
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        return queryset
    
    @action(detail=False, methods=['post'])
    def generate_lease(self, request):
        """Generate lease PDF for a tenant."""
        tenant_id = request.data.get('tenant_id')
        template_id = request.data.get('template_id')
        custom_content = request.data.get('custom_content')  # Optional custom content
        
        if not tenant_id:
            return Response(
                {'error': 'tenant_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response(
                {'error': 'Tenant not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        template = None
        if template_id:
            try:
                template = LeaseTemplate.objects.get(id=template_id)
            except LeaseTemplate.DoesNotExist:
                return Response(
                    {'error': 'Template not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        try:
            # Generate PDF - use custom content if provided, otherwise generate from template
            if custom_content:                
                buffer = BytesIO()
                doc = SimpleDocTemplate(buffer, pagesize=letter,
                                       rightMargin=72, leftMargin=72,
                                       topMargin=72, bottomMargin=18)
                elements = []
                styles = getSampleStyleSheet()
                title_style = ParagraphStyle(
                    'CustomTitle',
                    parent=styles['Heading1'],
                    fontSize=16,
                    textColor=colors.HexColor('#1e293b'),
                    spaceAfter=30,
                    alignment=1,
                )
                elements.append(Paragraph("RESIDENTIAL LEASE AGREEMENT", title_style))
                elements.append(Spacer(1, 0.2*inch))
                paragraphs = custom_content.split('\n\n')
                for para in paragraphs:
                    if para.strip():
                        para = para.strip().replace('\n', '<br/>')
                        elements.append(Paragraph(para, styles['Normal']))
                        elements.append(Spacer(1, 0.1*inch))
                doc.build(elements)
                buffer.seek(0)
                filled_content = custom_content
                pdf_buffer = buffer
            else:
                # Generate PDF from template
                pdf_buffer, filled_content = generate_lease_pdf(tenant, template)
            
            # Save document
            legal_doc = save_lease_document(tenant, pdf_buffer, filled_content)
            
            # Note: Email will be sent when DocuSign envelope is created (in send_docusign action)
            # Do not send email here - wait until envelope is successfully created
            
            # Serialize and return
            serializer = self.get_serializer(legal_doc)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error generating lease: {e}")
            return Response(
                {'error': f'Failed to generate lease: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # Usage in your LegalDocumentViewSet

    @action(detail=True, methods=['post'])
    def send_docusign(self, request, pk=None):
        """
        Send lease document via DocuSign for e-signature.
        Uses JWT authentication for server-to-server integration.
        """
        try:
            legal_doc = self.get_object()

            if not legal_doc.pdf_file:
                return Response(
                    {'error': 'No PDF file available. Please generate the lease first.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if DocuSign is configured
            from .docusign_service import is_docusign_configured, get_docusign_config_status
            if not is_docusign_configured():
                config_status = get_docusign_config_status()
                error_message = 'DocuSign is not configured. Missing required configuration keys: '
                error_message += ', '.join(config_status['missing_keys'])
                
                # In DEBUG mode, add more details
                if settings.DEBUG:
                    error_details = {
                        'error': error_message,
                        'missing_keys': config_status['missing_keys'],
                        'present_keys': config_status['present_keys'],
                    }
                    logger.error(f"DocuSign configuration check failed. Missing: {config_status['missing_keys']}")
                    return Response(error_details, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                else:
                    logger.error(f"DocuSign configuration check failed. Missing keys: {config_status['missing_keys']}")
                    return Response(
                        {'error': error_message},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )

            # Get PDF URL
            request_obj = request._request if hasattr(request, '_request') else request
            pdf_url = request_obj.build_absolute_uri(legal_doc.pdf_file.url) if legal_doc.pdf_file else None
            
            # Get PDF content directly to avoid download issues
            pdf_content = None
            try:
                if legal_doc.pdf_file:
                    try:
                        # First try standard Django storage read
                        legal_doc.pdf_file.open('rb')
                        pdf_content = legal_doc.pdf_file.read()
                        legal_doc.pdf_file.close()
                    except Exception as read_error:
                        logger.warning(f"Standard file read failed, attempting Cloudinary fallback: {read_error}")
                        # If that fails (e.g. 401 on Cloudinary URL), try using Cloudinary API or signed URL
                        if 'cloudinary' in str(legal_doc.pdf_file.storage.__class__).lower():
                            import cloudinary
                            import cloudinary.utils
                            
                            # Ensure global config is set (django-cloudinary-storage might not set the global cloudinary config object)
                            if not cloudinary.config().api_secret:
                                cloudinary.config(
                                    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
                                    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
                                    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
                                )
                            
                            # Debugging: Check if API secret is set
                            config = cloudinary.config()
                            if not config.api_secret:
                                logger.error("Cloudinary API Secret is MISSING in global config!")
                            else:
                                logger.info(f"Cloudinary API Secret is present (length: {len(config.api_secret)})")

                            # Generate a signed URL for the resource
                            # For 'raw' resources, Cloudinary stores them with the name we gave them.
                            # The public_id in save_lease_document was f"leases/{filename}".
                            # legal_doc.pdf_file.name should contain this public_id.
                            
                            resource_path = legal_doc.pdf_file.name
                            # Ensure resource_path doesn't have leading slashes or 'media/' prefix if it was already included in public_id
                            # Cloudinary public_ids are stored as is.
                            
                            logger.info(f"Generating signed URL for raw resource: {resource_path}")
                            
                            # Since we uploaded as 'raw', we MUST use resource_type='raw' first
                            signed_url, options = cloudinary.utils.cloudinary_url(
                                resource_path, 
                                resource_type="raw", 
                                sign_url=True
                            )
                            
                            import requests
                            logger.info(f"Attempting download from signed URL (raw): {signed_url}")
                            response = requests.get(signed_url)
                            
                            if response.status_code == 200:
                                pdf_content = response.content
                            else:
                                logger.warning(f"Failed to download from signed URL (raw): {response.status_code}. Body: {response.text[:200]} Trying 'image'...")
                                
                                # Fallback: Try WITHOUT signature (public)
                                unsigned_url, _ = cloudinary.utils.cloudinary_url(
                                    resource_path, 
                                    resource_type="raw", 
                                    sign_url=False
                                )
                                logger.info(f"Attempting download from UNsigned URL (raw): {unsigned_url}")
                                response_unsigned = requests.get(unsigned_url)
                                if response_unsigned.status_code == 200:
                                    pdf_content = response_unsigned.content
                                else:
                                    # Fallback to 'image' resource type (for older uploads or misidentified types)
                                    signed_url_img, _ = cloudinary.utils.cloudinary_url(
                                        resource_path, 
                                        resource_type="image", 
                                        sign_url=True
                                    )
                                    logger.info(f"Attempting download from signed URL (image): {signed_url_img}")
                                    response_img = requests.get(signed_url_img)
                                    if response_img.status_code == 200:
                                        pdf_content = response_img.content
                                    else:
                                        # Last ditch: ensure resource_path matches what was uploaded (e.g. stripping prefixes)
                                        # Sometimes 'leases/filename.pdf' needs to be just 'filename.pdf' depending on folder config
                                        # But public_id usually includes folder.
                                        
                                        # Try without extension if it has one
                                        if resource_path.lower().endswith('.pdf'):
                                            no_ext_path = resource_path[:-4]
                                            signed_url_no_ext, _ = cloudinary.utils.cloudinary_url(
                                                no_ext_path, 
                                                resource_type="raw", 
                                                sign_url=True
                                            )
                                            logger.info(f"Attempting download without extension: {signed_url_no_ext}")
                                            response_no_ext = requests.get(signed_url_no_ext)
                                            if response_no_ext.status_code == 200:
                                                pdf_content = response_no_ext.content
                                            else:
                                                raise Exception(f"Could not retrieve file from Cloudinary. Status: {response.status_code}")
                                        else:
                                            raise Exception(f"Could not retrieve file from Cloudinary. Status: {response.status_code}")

                        else:
                            raise read_error

            except Exception as e:
                logger.warning(f"Could not read PDF file directly: {e}")
            
            if not pdf_url and not pdf_content:
                return Response(
                    {'error': 'Could not generate PDF URL or read content.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Create DocuSign envelope (uses JWT authentication automatically)
            try:
                logger.info(f"Creating DocuSign envelope for legal document {legal_doc.id}")
                result = create_envelope(
                    legal_document_id=legal_doc.id,
                    tenant_email=legal_doc.tenant.email,
                    tenant_name=legal_doc.tenant.name,
                    pdf_url=pdf_url,
                    pdf_content=pdf_content
                )
                
                if not result:
                    return Response(
                        {'error': 'Failed to create DocuSign envelope. Check server logs for details.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            except DocusignApiException as e:
                logger.error(f"DocuSign API error while creating envelope: {e}", exc_info=True)
                # Map DocuSign API status codes to HTTP responses
                status_code = getattr(e, 'status', None)
                if status_code == 401:
                    return Response(
                        {'error': 'DocuSign authentication failed (401). Ensure consent is granted for the correct user and try again.'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                return Response(
                    {'error': 'DocuSign API error', 'details': str(getattr(e, 'body', e))},
                    status=status_code or status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                logger.error(f"Error creating DocuSign envelope: {e}", exc_info=True)
                error_message = str(e)
                # Provide more helpful error messages
                if '401' in error_message or 'Unauthorized' in error_message:
                    return Response(
                        {'error': 'DocuSign authentication failed. Please check your API credentials and ensure consent has been granted.'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
                return Response(
                    {'error': f'Failed to create DocuSign envelope: {error_message}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Update legal document with envelope info
            legal_doc.docusign_envelope_id = result.get('envelope_id')
            legal_doc.docusign_signing_url = result.get('signing_url')
            legal_doc.status = 'Sent'
            legal_doc.delivery_method = 'DocuSign'
            legal_doc.save()
            
            # Update tenant lease status
            legal_doc.tenant.lease_status = 'Sent'
            legal_doc.tenant.save()

            # Optionally send notification email
            try:
                from .email_service import send_lease_docusign_notification
                task = send_lease_docusign_notification.delay(legal_doc.id)
                logger.info(f"DocuSign notification email task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery failed, sending DocuSign notification synchronously: {e}")
                send_lease_docusign_notification(legal_doc.id)

            serializer = self.get_serializer(legal_doc)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Unexpected error sending lease via DocuSign: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to send lease via DocuSign: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get', 'post'])
    def check_status(self, request, pk=None):
        """
        Check DocuSign envelope status and update local status.
        """
        legal_doc = self.get_object()
        
        if not legal_doc.docusign_envelope_id:
             return Response({'status': legal_doc.status, 'message': 'No envelope ID found'})

        try:
            # Get status from DocuSign
            status_info = get_envelope_status(legal_doc.docusign_envelope_id)
            
            if not status_info:
                return Response({'status': legal_doc.status, 'message': 'Could not fetch status from DocuSign'})
                
            ds_status = status_info.get('status')
            
            # Map DocuSign status to our status
            # DocuSign statuses: created, sent, delivered, signed, completed, declined, voided, timedout
            
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
                        # Also set signed_pdf_url if you want to distinguish, but usually replacing the main file is fine
                        # or we can assume pdf_file now contains the signed version.
                        # If you have a separate field:
                        # legal_doc.signed_pdf_url = ... (requires upload to S3 or similar if URLField)
                        # For now, we've updated the file field.
                    
                    legal_doc.save()
                    
                    # Update tenant
                    tenant = legal_doc.tenant
                    tenant.lease_status = 'Signed'
                    tenant.save()
                    
                    # Send confirmation
                    try:
                        task = send_lease_signed_confirmation.delay(legal_doc.id)
                    except:
                        send_lease_signed_confirmation(legal_doc.id)

                    # CRITICAL: Check if user account exists, if not, create it and send setup email
                    # This handles manual tenant adds who bypassed the "Applicant -> Approved" flow
                    try:
                        user, created = create_user_from_tenant(tenant)
                        if created or not user.has_usable_password():
                            # Generate password reset token for account setup
                            token, uidb64 = generate_password_reset_token(user)
                            
                            # Get frontend URL from settings
                            frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
                            reset_url = get_password_reset_url(uidb64, token, frontend_url)
                            
                            # Send acceptance/welcome email with password setup link
                            try:
                                task = send_acceptance_email_to_user.delay(tenant.id, token, reset_url)
                                logger.info(f"Account setup email task submitted for tenant {tenant.id}")
                            except Exception as e:
                                logger.warning(f"Celery connection failed, using threading fallback for account setup: {e}")
                                send_acceptance_email_to_user(tenant.id, token, reset_url)
                    except Exception as e:
                         logger.error(f"Error ensuring user account exists after lease signing: {e}", exc_info=True)


            elif ds_status in ['declined', 'voided']:
                legal_doc.status = 'Declined' if ds_status == 'declined' else 'Voided'
                legal_doc.save()
                tenant = legal_doc.tenant
                tenant.lease_status = 'Declined' if ds_status == 'declined' else 'Voided'
                tenant.save()

            serializer = self.get_serializer(legal_doc)
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error checking DocuSign status: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to check status: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_docusign_signing_url = old_instance.docusign_signing_url
        old_signed_at = old_instance.signed_at
        
        legal_doc = serializer.save()
        new_docusign_signing_url = legal_doc.docusign_signing_url
        new_signed_at = legal_doc.signed_at
        
        # If DocuSign URL is added, send notification
        if not old_docusign_signing_url and new_docusign_signing_url:
            try:
                task = send_lease_docusign_notification.delay(legal_doc.id)
                logger.info(f"DocuSign notification task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for DocuSign notification: {e}")
                send_lease_docusign_notification(legal_doc.id)
        
        # If lease is signed (signed_at is set), send confirmation
        if not old_signed_at and new_signed_at:
            try:
                task = send_lease_signed_confirmation.delay(legal_doc.id)
                logger.info(f"Lease signed confirmation task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for lease signed confirmation: {e}")
                send_lease_signed_confirmation(legal_doc.id)


class ListingViewSet(viewsets.ModelViewSet):
    queryset = Listing.objects.all()
    serializer_class = ListingSerializer
    permission_classes = [AllowAny]  # Public access for listings

class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    permission_classes = [AllowAny]  # Public access for all property operations (listings are public)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class EmailTestViewSet(viewsets.ViewSet):
    """
    Test endpoint for email configuration verification.
    """
    permission_classes = [IsAuthenticated]  # Only authenticated users can test emails
    
    @action(detail=False, methods=['post'], url_path='test-email', url_name='test-email')
    def test_email(self, request):
        """
        Send a test email to verify email configuration.
        Requires 'recipient_email' in request data.
        """
        from django.core.mail import send_mail
        from django.conf import settings as django_settings
        from .email_service import validate_email_config
        
        recipient_email = request.data.get('recipient_email')
        if not recipient_email:
            return Response(
                {'error': 'recipient_email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate email configuration
        is_valid, error_msg = validate_email_config()
        if not is_valid:
            return Response(
                {
                    'success': False,
                    'error': error_msg,
                    'config': {
                        'email_backend': getattr(django_settings, 'EMAIL_BACKEND', 'not set'),
                        'default_from_email': getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'not set'),
                        'email_host_user': getattr(django_settings, 'EMAIL_HOST_USER', 'not set'),
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Send test email
        try:
            result = send_mail(
                subject='Test Email from Neela Tenant App',
                message='This is a test email to verify email configuration.',
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient_email],
                fail_silently=False,
            )
            
            return Response({
                'success': True,
                'message': f'Test email sent successfully to {recipient_email}',
                'emails_sent': result,
                'config': {
                    'email_backend': getattr(django_settings, 'EMAIL_BACKEND', 'unknown'),
                    'default_from_email': getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'unknown'),
                }
            })
        except Exception as e:
            logger.error(f"Error sending test email: {e}", exc_info=True)
            return Response(
                {
                    'success': False,
                    'error': str(e),
                    'config': {
                        'email_backend': getattr(django_settings, 'EMAIL_BACKEND', 'unknown'),
                        'default_from_email': getattr(django_settings, 'DEFAULT_FROM_EMAIL', 'unknown'),
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
