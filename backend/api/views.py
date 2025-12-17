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
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
        
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
            
            # Send confirmation email to tenant
            try:
                task = send_application_received_email_to_tenant.delay(tenant.id)
                logger.info(f"Application received email task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed, using threading fallback for tenant email: {e}")
                send_application_received_email_to_tenant(tenant.id)

    
    def perform_update(self, serializer):
        """Override to handle status changes and send acceptance email."""
        old_instance = self.get_object()
        old_status = old_instance.status
        
        tenant = serializer.save()
        new_status = tenant.status
        
        # If status changed from 'Applicant' to 'Approved', send acceptance email
        if old_status == 'Applicant' and new_status == 'Approved':
            # Send notification to Admin about the approval
            try:
                task = send_application_approval_notification_to_admin.delay(tenant.id)
                logger.info(f"Admin approval notification task submitted to Celery: {task.id}")
            except Exception as e:
                logger.warning(f"Celery connection failed for admin approval notification: {e}")
                send_application_approval_notification_to_admin(tenant.id)

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

            # Generate password reset token if the user was just created or has no password
            if created or not user.has_usable_password():
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
    
    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def check_status(self, request):
        """Check application status by email and phone."""
        try:
            email = request.data.get('email')
            phone = request.data.get('phone')
            
            if not email or not phone:
                return Response(
                    {"error": "Email and phone are required"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Flexible phone matching (strip non-digits)
            clean_phone = ''.join(filter(str.isdigit, str(phone))) if phone else ''
            
            if not clean_phone:
                return Response(
                    {"error": "Invalid phone number provided"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Try to find tenant
            tenants = Tenant.objects.filter(email__iexact=email)
            
            matched_tenant = None
            for t in tenants:
                if not t.phone:
                    continue
                t_phone_clean = ''.join(filter(str.isdigit, str(t.phone)))
                if clean_phone in t_phone_clean or t_phone_clean in clean_phone:
                    matched_tenant = t
                    break
            
            if matched_tenant:
                serializer = self.get_serializer(matched_tenant)
                return Response({
                    "status": matched_tenant.status,
                    "tenant": serializer.data
                })
                
            return Response(
                {"error": "Application not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error checking application status: {e}", exc_info=True)
            return Response(
                {"error": f"Failed to check status: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
                            resource_path = legal_doc.pdf_file.name
                            
                            # CRITICAL FIX: Cloudinary storage backend might have stored the public_id WITHOUT the extension
                            # OR with the extension. But 'resource_type="raw"' requires exact match.
                            
                            # If upload used f"leases/{filename}" where filename has .pdf, then public_id is "leases/foo.pdf"
                            # But Cloudinary raw resources are tricky.
                            
                            # Try listing resources (if we could), but let's just try stripping 'media/' if present
                            # Django storage might prepend 'media/' but Cloudinary public_id might not have it if we uploaded manually
                            
                            logger.info(f"Original resource path from DB: {resource_path}")
                            
                            # Strategy: Try variations of the path
                            paths_to_try = [
                                resource_path,
                                resource_path.replace('media/', ''), # If media/ was prepended
                                f"media/{resource_path}" if not resource_path.startswith('media/') else resource_path,
                            ]
                            
                            # If it ends with .pdf, try without - but for RAW files, extension is usually part of ID
                            if resource_path.lower().endswith('.pdf'):
                                paths_to_try.append(resource_path[:-4])
                                paths_to_try.append(resource_path.replace('media/', '')[:-4])
                            
                            pdf_content = None
                            
                            for path in paths_to_try:
                                if pdf_content: break
                                
                                logger.info(f"Trying path variant: {path}")
                                
                                # Try RAW signed (most likely for PDF documents)
                                try:
                                    signed_url, _ = cloudinary.utils.cloudinary_url(path, resource_type="raw", sign_url=True)
                                    logger.info(f"Checking RAW URL: {signed_url}")
                                    resp = requests.get(signed_url)
                                    if resp.status_code == 200:
                                        pdf_content = resp.content
                                        logger.info(f"Success with RAW signed: {path}")
                                        break
                                    else:
                                        logger.warning(f"RAW URL failed: {resp.status_code}")
                                except Exception as e:
                                    logger.warning(f"Error generating/fetching RAW URL for {path}: {e}")
                                    
                                # Try IMAGE signed (fallback for older files or if uploaded as image/auto)
                                try:
                                    signed_url_img, _ = cloudinary.utils.cloudinary_url(path, resource_type="image", sign_url=True)
                                    logger.info(f"Checking IMAGE URL: {signed_url_img}")
                                    resp = requests.get(signed_url_img)
                                    if resp.status_code == 200:
                                        pdf_content = resp.content
                                        logger.info(f"Success with IMAGE signed: {path}")
                                        break
                                    else:
                                        logger.warning(f"IMAGE URL failed: {resp.status_code}")
                                except Exception as e:
                                    logger.warning(f"Error generating/fetching IMAGE URL for {path}: {e}")

                            if not pdf_content:
                                logger.error("All retrieval attempts failed for Cloudinary file.")
                                raise Exception("Could not retrieve file from Cloudinary after multiple attempts.")


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
                
                # Get landlord details from settings
                landlord_email = getattr(settings, 'LANDLORD_EMAIL', 'admin@example.com')
                landlord_name = getattr(settings, 'LANDLORD_NAME', 'Rosa Martinez')
                
                result = create_envelope(
                    legal_document_id=legal_doc.id,
                    tenant_email=legal_doc.tenant.email,
                    tenant_name=legal_doc.tenant.name,
                    landlord_email=landlord_email,
                    landlord_name=landlord_name,
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
        from .lease_service import process_docusign_status_update
        
        legal_doc = self.get_object()
        
        if not legal_doc.docusign_envelope_id:
             return Response({'status': legal_doc.status, 'message': 'No envelope ID found'})

        try:
            result = process_docusign_status_update(legal_doc)
            
            if 'errors' in result:
                logger.warning(f"Partial errors during status update: {result['errors']}")
                
            serializer = self.get_serializer(legal_doc)
            data = serializer.data
            data.update({
                'update_result': result
            })
            
            return Response(data)
            
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
