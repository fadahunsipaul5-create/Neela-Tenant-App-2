from rest_framework import viewsets, parsers, status
from rest_framework.decorators import action, api_view, permission_classes
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
import cloudinary
import cloudinary.api
import requests
logger = logging.getLogger(__name__)

def download_cloudinary_file(resource_path):
    """
    Download a file from Cloudinary using API authentication.
    Handles authenticated delivery and returns file bytes.
    
    Args:
        resource_path: The path/public_id of the file in Cloudinary
    
    Returns:
        bytes: The file content, or None if failed
    """
    try:
        # Remove leading slash and get clean path
        clean_path = resource_path.lstrip('/').replace('\\', '/')
        
        # Remove extension if present (Cloudinary public_ids usually don't include extension)
        if clean_path.lower().endswith('.pdf'):
            public_id = clean_path[:-4]
        else:
            public_id = clean_path
        
        logger.info(f"Attempting to download Cloudinary file: {public_id}")
        
        # Try different delivery types and methods
        delivery_types = ['upload', 'authenticated', 'private']
        
        for delivery_type in delivery_types:
            try:
                # Method 1: Use Cloudinary's private_download_url with API key signing
                if hasattr(cloudinary.utils, 'private_download_url'):
                    download_url = cloudinary.utils.private_download_url(
                        public_id,
                        format='pdf',
                        resource_type='raw',
                        type=delivery_type,
                        attachment=False
                    )
                    
                    logger.info(f"Trying private download URL ({delivery_type}): {download_url[:100]}...")
                    response = requests.get(download_url, timeout=30)
                    
                    if response.status_code == 200:
                        logger.info(f"Successfully downloaded file using {delivery_type} delivery")
                        return response.content
                    else:
                        logger.warning(f"Failed with {delivery_type}: HTTP {response.status_code}")
                        
            except Exception as e:
                logger.warning(f"Error with {delivery_type} delivery: {e}")
                continue
        
        # Method 2: Try using Cloudinary Admin API to get resource details
        try:
            logger.info("Attempting to fetch resource details via Admin API")
            resource_info = cloudinary.api.resource(
                public_id,
                resource_type='raw',
                type='upload'
            )
            
            if 'secure_url' in resource_info:
                secure_url = resource_info['secure_url']
                logger.info(f"Got secure_url from Admin API: {secure_url[:100]}...")
                response = requests.get(secure_url, timeout=30)
                
                if response.status_code == 200:
                    logger.info("Successfully downloaded file using Admin API secure_url")
                    return response.content
                else:
                    logger.warning(f"Admin API secure_url failed: HTTP {response.status_code}")
        except Exception as e:
            logger.warning(f"Admin API method failed: {e}")
        
        logger.error(f"All download methods failed for: {public_id}")
        return None
        
    except Exception as e:
        logger.error(f"Error in download_cloudinary_file: {e}")
        import traceback
        traceback.print_exc()
        return None

# ==================== Contact Manager (Email-only) ====================

@api_view(['POST'])
@permission_classes([AllowAny])
def contact_manager(request):
    """
    Email-only contact form:
    - Accepts a message (required) and optional tenant_id / sender info
    - Sends an email to the landlord/manager inbox
    """
    message = (request.data.get('message') or '').strip()
    tenant_id = request.data.get('tenant_id')
    sender_name = (request.data.get('sender_name') or '').strip() or None
    sender_email = (request.data.get('sender_email') or '').strip() or None

    if not message:
        return Response({'error': 'message is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Email-only: send immediately (avoid Celery task registration issues in dev)
    try:
        send_contact_message_to_manager(
            tenant_id=tenant_id,
            sender_name=sender_name,
            sender_email=sender_email,
            message=message,
        )
        return Response({'status': 'sent'}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Failed to send contact manager message: {e}", exc_info=True)
        return Response({'error': 'Failed to send message'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
        
        # If status changed from 'Applicant' to 'Approved', OR from 'Approved'/'Signed' to 'Active' (Move-In)
        # Ensure user account exists and send setup email if they haven't set a password yet
        if (old_status == 'Applicant' and new_status == 'Approved') or \
           (old_status != 'Active' and new_status == 'Active'):
            
            # Send notification to Admin about the approval (only on first approval)
            if new_status == 'Approved':
                try:
                    task = send_application_approval_notification_to_admin.delay(tenant.id)
                    logger.info(f"Admin approval notification task submitted to Celery: {task.id}")
                except Exception as e:
                    logger.warning(f"Celery connection failed for admin approval notification: {e}")
                    send_application_approval_notification_to_admin(tenant.id)

            # Create user account if it doesn't exist
            user, created = create_user_from_tenant(tenant)
            
            # Auto-generate lease document (only on first approval)
            if new_status == 'Approved':
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
    
    def create(self, request, *args, **kwargs):
        """Override create to send invoice email after payment is created."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save()
        invoice_email_sent = False

        # Send invoice email to tenant (same pattern as Legal & Compliance)
        try:
            try:
                send_payment_invoice_to_tenant.delay(payment.id)
                logger.info(f"Queued invoice email to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
                invoice_email_sent = True
            except Exception:
                # Celery not available or misconfigured; run inline
                send_payment_invoice_to_tenant(payment.id)
                logger.info(f"Sent invoice email inline to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
                invoice_email_sent = True
        except Exception as e:
            logger.error(f"Failed to send invoice email: {e}")
            # Don't fail the whole request if email fails

        # Send confirmation email if payment method is provided
        if payment.method:
            try:
                try:
                    send_payment_confirmation_to_tenant.delay(payment.id)
                    logger.info(f"Queued confirmation email to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
                except Exception:
                    # Celery not available or misconfigured; run inline
                    send_payment_confirmation_to_tenant(payment.id)
                    logger.info(f"Sent confirmation email inline to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
            except Exception as e:
                logger.error(f"Failed to send confirmation email: {e}")
                # Don't fail the whole request if email fails

        response_data = dict(serializer.data)
        response_data['invoice_email_sent'] = invoice_email_sent
        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
    
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
    
    @action(detail=True, methods=['post'], url_path='send-receipt')
    def send_receipt(self, request, pk=None):
        """Send receipt email to tenant for a payment (same pattern as Legal & Compliance)."""
        payment = self.get_object()
        receipt_email_sent = False
        try:
            try:
                send_payment_receipt_to_tenant.delay(payment.id)
                logger.info(f"Queued receipt email to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
                receipt_email_sent = True
            except Exception:
                # Celery not available or misconfigured; run inline
                send_payment_receipt_to_tenant(payment.id)
                logger.info(f"Sent receipt email inline to tenant {payment.tenant.email if payment.tenant else 'unknown'} for payment {payment.id}")
                receipt_email_sent = True
        except Exception as e:
            logger.error(f"Failed to send receipt email: {e}")
        return Response({
            'status': 'success',
            'message': f'Receipt email sent to {payment.tenant.name}' if receipt_email_sent else 'Receipt email could not be sent.',
            'receipt_email_sent': receipt_email_sent,
        }, status=status.HTTP_200_OK)

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

def generate_notice_content(tenant, notice_type):
    """Generate notice content with tenant details auto-populated."""
    from datetime import datetime, timedelta
    
    today = datetime.now().strftime("%B %d, %Y")
    three_days_later = (datetime.now() + timedelta(days=3)).strftime("%B %d, %Y")
    
    if notice_type == "Notice of Late Rent":
        return f"""RENT PAYMENT BALANCE

Dear {tenant.name},

This is a friendly reminder that we have not received your outstanding rent balance for {tenant.property_unit}.

Account Details:
- Tenant Name: {tenant.name}
- Property Unit: {tenant.property_unit}
- Monthly Rent: ${tenant.rent_amount}
- Current Balance Due: ${tenant.balance}

Please remit payment as soon as possible to avoid late fees and potential legal action.

Payment can be made via:
- Online portal
- Check (payable to Property Management)
- Electronic transfer

If you have already made payment, please disregard this notice and contact our office with payment confirmation.

Best regards,
Neela Property Management Team
Date: {today}"""
    
    elif notice_type == "3-Day Notice to Vacate":
        return f"""THREE (3) DAY NOTICE TO VACATE
Pursuant to Texas Property Code Section 24.005

TO: {tenant.name}
PROPERTY ADDRESS: {tenant.property_unit}
DATE: {today}

YOU ARE HEREBY NOTIFIED that you are indebted to the undersigned in the sum of ${tenant.balance} for rent and/or other charges due for the above-described premises.

DEMAND IS HEREBY MADE that you pay said sum within THREE (3) DAYS (excluding Saturdays, Sundays, and legal holidays) from the date of delivery of this notice or vacate and deliver up possession of the above-described premises which you currently hold and occupy.

If you fail to pay the amount due or vacate the premises within the time specified, legal proceedings will be instituted against you to recover possession of the premises, declare the lease forfeited, and recover rents and damages for the period of unlawful detention.

Landlord: Neela Property Management
Date of Notice: {today}
Date Possession Required: {three_days_later}

This notice is given pursuant to Texas Property Code Section 24.005."""
    
    elif notice_type == "30-Day Lease Termination":
        return f"""THIRTY (30) DAY NOTICE OF LEASE TERMINATION

TO: {tenant.name}
PROPERTY ADDRESS: {tenant.property_unit}
DATE: {today}

This letter serves as official notice that your lease agreement for the above property will terminate thirty (30) days from the date of this notice.

Lease Details:
- Tenant: {tenant.name}
- Property: {tenant.property_unit}
- Lease Start Date: {tenant.lease_start}
- Lease End Date: {tenant.lease_end}
- Outstanding Balance: ${tenant.balance}

You are required to vacate the premises and return all keys by the termination date. Any outstanding balance must be paid in full before or at move-out.

Move-Out Requirements:
1. Clean the premises thoroughly
2. Repair any damages (normal wear and tear excepted)
3. Return all keys and access devices
4. Provide forwarding address for security deposit return
5. Schedule final walk-through inspection

Please contact our office to schedule your move-out inspection.

Neela Property Management Team
Date: {today}"""
    
    elif notice_type == "Lease Violation Notice":
        return f"""LEASE VIOLATION NOTICE

TO: {tenant.name}
PROPERTY ADDRESS: {tenant.property_unit}
DATE: {today}

This notice is to inform you that you are in violation of your lease agreement.

Tenant Information:
- Name: {tenant.name}
- Property: {tenant.property_unit}
- Current Balance: ${tenant.balance}

Please rectify this situation within five (5) business days from the date of this notice. Failure to comply may result in further action, including lease termination and eviction proceedings.

If you have questions or need clarification, please contact our office immediately.

Neela Property Management Team
Date: {today}"""
    
    else:
        # Default template
        return f"""LEGAL NOTICE

TO: {tenant.name}
PROPERTY ADDRESS: {tenant.property_unit}
DATE: {today}

Outstanding Balance: ${tenant.balance}

Please contact Neela Property Management immediately to resolve this matter.

Neela Property Management Team"""

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
    
    @action(detail=False, methods=['post'])
    def generate_notice(self, request):
        """Generate and send a legal notice to a tenant with auto-populated details."""
        from .email_service import send_notice_to_tenant
        import base64
        tenant_id = request.data.get('tenant_id')
        notice_type = request.data.get('notice_type', 'Notice of Late Rent')
        
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
        
        try:
            # Generate notice content with auto-populated tenant details
            notice_content = generate_notice_content(tenant, notice_type)
            
            # Create PDF
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter,
                                   rightMargin=72, leftMargin=72,
                                   topMargin=72, bottomMargin=18)
            elements = []
            styles = getSampleStyleSheet()
            
            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                textColor=colors.HexColor('#1e293b'),
                spaceAfter=30,
                alignment=1,
            )
            elements.append(Paragraph(notice_type.upper(), title_style))
            elements.append(Spacer(1, 0.3*inch))
            
            # Content - split by paragraphs
            paragraphs = notice_content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    para = para.strip().replace('\n', '<br/>')
                    elements.append(Paragraph(para, styles['Normal']))
                    elements.append(Spacer(1, 0.15*inch))
            
            doc.build(elements)
            buffer.seek(0)
            
            # Save legal document
            filename = f'notice_{tenant.id}_{timezone.now().strftime("%Y%m%d_%H%M%S")}.pdf'
            legal_doc = LegalDocument.objects.create(
                tenant=tenant,
                type=notice_type,
                generated_content=notice_content,
                status='Sent',
                delivery_method='Email'
            )
            legal_doc.pdf_file.save(filename, ContentFile(buffer.getvalue()))
            legal_doc.save()
            
            notice_email_sent = False
            # Send email notification to tenant
            try:
                # Pass PDF bytes directly to avoid fetching from remote storage (Cloudinary may require auth)
                pdf_bytes_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
                try:
                    send_notice_to_tenant.delay(legal_doc.id, pdf_bytes_b64=pdf_bytes_b64)
                    logger.info(f"Queued notice email to tenant {tenant.email} for document {legal_doc.id}")
                    notice_email_sent = True
                except Exception:
                    # Celery not available or misconfigured; run inline
                    send_notice_to_tenant(legal_doc.id, pdf_bytes_b64=pdf_bytes_b64)
                    logger.info(f"Sent notice email inline to tenant {tenant.email} for document {legal_doc.id}")
                    notice_email_sent = True
            except Exception as e:
                logger.error(f"Failed to send notice email: {e}")
            
            # Serialize and return
            serializer = self.get_serializer(legal_doc)
            response_data = dict(serializer.data)
            response_data['notice_email_sent'] = notice_email_sent
            return Response(response_data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error generating notice: {e}")
            return Response(
                {'error': f'Failed to generate notice: {str(e)}'},
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
                            
                            logger.info(f"Original resource path from DB: {resource_path}")
                            
                            # Clean up path - remove extension for ID logic if needed, but for raw/upload we usually want it
                            # If DB path is 'media/leases/foo.pdf', that is the public_id
                            
                            pdf_content = None
                            
                            # HELPER: Try to fetch content from a URL
                            # Use improved Cloudinary download helper
                            logger.info(f"Downloading file from Cloudinary: {resource_path}")
                            pdf_content = download_cloudinary_file(resource_path)
                            
                            if not pdf_content:
                                logger.error("All retrieval attempts failed for Cloudinary file.")
                                logger.error("Cloudinary retrieval failed; refusing to fall back to pdf_file.url for DocuSign.")
                            else:
                                logger.info(f"Successfully downloaded {len(pdf_content)} bytes from Cloudinary")
                        else:
                            raise read_error

            except Exception as e:
                logger.warning(f"Could not read PDF file directly: {e}")
            
            # If we failed to get content but have a URL, we can still try to let DocuSign download it
            # BUT: DocuSign needs a public URL. Cloudinary raw/private URLs might not work if they expire quickly or need auth headers not supported by DocuSign fetch.
            # AND: We prefer sending base64 content.
            
            if not pdf_content:
                return Response(
                    {'error': 'Could not retrieve PDF bytes from storage (Cloudinary access control).'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Create DocuSign envelope (uses JWT authentication automatically)
            try:
                logger.info(f"Creating DocuSign envelope for legal document {legal_doc.id}")
                
                # Get landlord details from settings
                landlord_email = getattr(settings, 'LANDLORD_EMAIL', None) or 'admin@example.com'
                landlord_name = getattr(settings, 'LANDLORD_NAME', None) or 'Rosa Martinez'
                
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

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[AllowAny])
    def pdf(self, request, pk=None):
        """
        Proxy the lease PDF through the backend.
        GET /api/legal-documents/{id}/pdf/
        Allows tenant access to their own documents.
        """
        try:
            legal_doc = LegalDocument.objects.get(pk=pk)
        except LegalDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Verify tenant ownership if user is authenticated
        if request.user.is_authenticated:
            # Check if user is a tenant and owns this document
            try:
                tenant = Tenant.objects.filter(email=request.user.email).first()
                if tenant and legal_doc.tenant_id != tenant.id:
                    # User is authenticated but doesn't own this document
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            except Exception as e:
                logger.warning(f"Error verifying tenant ownership for PDF access: {e}")
                # If verification fails, deny access for security
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        # For unauthenticated access, we allow it but this should ideally be secured with a signed URL or token
        # For now, allowing unauthenticated access to support direct link downloads
        
        if not legal_doc.pdf_file:
            return Response({'error': 'No PDF found'}, status=status.HTTP_404_NOT_FOUND)

        # Try reading from storage directly first
        pdf_bytes = None
        try:
            legal_doc.pdf_file.open('rb')
            pdf_bytes = legal_doc.pdf_file.read()
            legal_doc.pdf_file.close()
        except Exception as read_error:
            logger.warning(f"Standard file read failed for PDF proxy, attempting Cloudinary admin download: {read_error}")
            # Cloudinary admin-signed download fallback
            try:
                import cloudinary
                import cloudinary.utils

                if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
                    if not cloudinary.config().api_secret:
                        cloudinary.config(
                            cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
                            api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
                            api_secret=settings.CLOUDINARY_STORAGE['API_SECRET']
                        )

                public_id = (legal_doc.pdf_file.name or "").lstrip("/")
                if public_id.lower().endswith(".pdf"):
                    public_id = public_id[:-4]

                if hasattr(cloudinary.utils, "private_download_url"):
                    dl_url = cloudinary.utils.private_download_url(
                        public_id,
                        "pdf",
                        resource_type="raw",
                        type="upload",
                    )
                    resp = requests.get(dl_url, timeout=30)
                    if resp.status_code == 200:
                        pdf_bytes = resp.content
                    else:
                        logger.error(f"Cloudinary private download failed for PDF proxy: {resp.status_code}")
            except Exception as e:
                logger.error(f"Cloudinary fallback failed for PDF proxy: {e}", exc_info=True)

        if not pdf_bytes:
            return Response({'error': 'Could not retrieve PDF'}, status=status.HTTP_404_NOT_FOUND)

        return HttpResponse(pdf_bytes, content_type="application/pdf")

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
