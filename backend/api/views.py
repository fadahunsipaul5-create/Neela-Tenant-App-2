from rest_framework import viewsets, parsers, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import *
from .serializers import *
from .lease_service import generate_lease_pdf, save_lease_document, stamp_signed_pdf
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
from django.http import FileResponse
from django.core.files.storage import default_storage
from django.db.models import Sum, Q
from django.db.models.functions import ExtractMonth
import re
import cloudinary
import mimetypes
from decimal import Decimal
from collections import defaultdict

from api.management.commands.import_properties import (
    extract_unit_from_address,
    strip_city_state_from_address,
)
import cloudinary.api
import requests
from .permissions import (
    is_admin_user,
    is_property_manager,
    filter_properties_for_user,
    get_manager_property_ids,
    filter_tenants_for_user,
    filter_payments_for_user,
    filter_maintenance_for_user,
    MANAGER_EXPENSE_CATEGORIES,
    ADMIN_ONLY_EXPENSE_CATEGORIES,
)
from rest_framework.exceptions import PermissionDenied

def download_cloudinary_file(resource_path, resource_types=None, formats=None):
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
        
        # Keep the full path including extension
        # (Our uploads include .pdf in the public_id)
        public_id = clean_path
        
        logger.info(f"Attempting to download Cloudinary file: {public_id}")
        
        # Try different delivery types and methods
        resource_types = resource_types or ['raw']
        formats = formats or ['pdf']
        delivery_types = ['upload', 'authenticated', 'private']
        
        for resource_type in resource_types:
            for file_format in formats:
                for delivery_type in delivery_types:
                    try:
                        # Method 1: Use Cloudinary's private_download_url with API key signing
                        if hasattr(cloudinary.utils, 'private_download_url'):
                            # private_download_url requires `format`; skip invalid entries.
                            if not file_format:
                                continue
                            download_url = cloudinary.utils.private_download_url(
                                public_id,
                                format=file_format,
                                resource_type=resource_type,
                                type=delivery_type,
                                attachment=False,
                            )
                            
                            logger.info(
                                f"Trying private download URL ({resource_type}/{file_format or 'auto'}/{delivery_type}): {download_url[:100]}..."
                            )
                            response = requests.get(download_url, timeout=30)
                            
                            if response.status_code == 200:
                                logger.info(f"Successfully downloaded file using {resource_type}/{delivery_type}")
                                return response.content
                            else:
                                logger.warning(f"Failed with {resource_type}/{delivery_type}: HTTP {response.status_code}")
                                
                    except Exception as e:
                        logger.warning(f"Error with {resource_type}/{delivery_type}: {e}")
                        continue
        
        # Method 2: Try using Cloudinary Admin API to get resource details
        try:
            logger.info("Attempting to fetch resource details via Admin API")
            for resource_type in resource_types:
                try:
                    resource_info = cloudinary.api.resource(
                        public_id,
                        resource_type=resource_type,
                        type='upload'
                    )
                except Exception:
                    continue

                if 'secure_url' in resource_info:
                    secure_url = resource_info['secure_url']
                    logger.info(f"Got secure_url from Admin API ({resource_type}): {secure_url[:100]}...")
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """Return aggregate stats for dashboard without loading full lists."""
    total_revenue = Payment.objects.filter(status='Paid').aggregate(
        total=Sum('amount')
    )['total'] or 0
    overdue_amount = Tenant.objects.filter(balance__gt=0).aggregate(
        total=Sum('balance')
    )['total'] or 0
    tenant_count = Tenant.objects.count()
    active_count = Tenant.objects.filter(status='Active').count()
    occupancy_rate = round((active_count / tenant_count) * 100) if tenant_count else 0
    open_tickets = MaintenanceRequest.objects.exclude(status='Resolved').count()
    new_applications = Tenant.objects.filter(status='Applicant').count()
    return Response({
        'totalRevenue': float(total_revenue),
        'overdueAmount': float(overdue_amount),
        'occupancyRate': occupancy_rate,
        'openTickets': open_tickets,
        'newApplications': new_applications,
    })


# Note: OAuth callback and token refresh functions removed - using JWT authentication instead
class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [AllowAny]  # Require auth for most operations
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_queryset(self):
        qs = Tenant.objects.all().order_by('-id')
        qs = filter_tenants_for_user(qs, self.request.user)
        try:
            limit = int(self.request.query_params.get('limit', 0))
            offset = int(self.request.query_params.get('offset', 0))
            if limit > 0:
                qs = qs[offset:offset + limit]
        except (ValueError, TypeError):
            pass
        return qs

    def perform_destroy(self, instance):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Only admin can delete tenants.')
        instance.delete()

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

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='document')
    def document(self, request, pk=None):
        """
        Proxy tenant-uploaded documents through backend so preview/download works
        even when direct Cloudinary URLs are access-restricted.
        """
        tenant = self.get_object()
        raw_path = (request.query_params.get('path') or '').strip()
        if not raw_path:
            return Response({'error': 'path is required'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_path = raw_path.lstrip('/').replace('\\', '/')
        normalized_no_media = re.sub(r'^media/', '', normalized_path, flags=re.IGNORECASE)

        expected_prefix = f'applications/tenant_{tenant.id}/'
        if not normalized_no_media.startswith(expected_prefix):
            return Response({'error': 'Invalid document path'}, status=status.HTTP_403_FORBIDDEN)

        # Resolve original uploaded filename (keeps extension for downloads).
        original_filename = request.query_params.get('filename')
        if not original_filename:
            all_docs = []
            for arr in [tenant.photo_id_files or [], tenant.income_verification_files or [], tenant.background_check_files or []]:
                if isinstance(arr, list):
                    all_docs.extend([x for x in arr if isinstance(x, dict)])
            for doc in all_docs:
                doc_path = str(doc.get('path') or doc.get('file') or '').lstrip('/').replace('\\', '/')
                doc_no_media = re.sub(r'^media/', '', doc_path, flags=re.IGNORECASE)
                if doc_no_media == normalized_no_media and doc.get('filename'):
                    original_filename = str(doc.get('filename'))
                    break
        if not original_filename:
            original_filename = normalized_no_media.split('/')[-1]

        candidate_paths = [normalized_no_media, f"media/{normalized_no_media}"]
        file_handle = None
        try:
            for candidate in candidate_paths:
                try:
                    file_handle = default_storage.open(candidate, 'rb')
                    normalized_no_media = candidate
                    break
                except Exception:
                    continue
        except Exception:
            file_handle = None

        # Cloudinary fallback for private/restricted assets.
        if file_handle is None:
            cloudinary_path = f"media/{re.sub(r'^media/', '', normalized_no_media, flags=re.IGNORECASE)}"
            file_bytes = download_cloudinary_file(
                cloudinary_path,
                resource_types=['image', 'raw'],
                formats=['pdf', 'jpg', 'jpeg', 'png', 'webp'],
            )
            if not file_bytes:
                return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
            content_type, _ = mimetypes.guess_type(original_filename)
            response = HttpResponse(file_bytes, content_type=content_type or 'application/octet-stream')
            if request.query_params.get('download') == '1':
                response['Content-Disposition'] = f'attachment; filename="{original_filename}"'
            return response

        content_type, _ = mimetypes.guess_type(original_filename)
        response = FileResponse(file_handle, content_type=content_type or 'application/octet-stream')
        if request.query_params.get('download') == '1':
            response['Content-Disposition'] = f'attachment; filename="{original_filename}"'
        return response

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]  # Require authentication for payments

    def get_queryset(self):
        return filter_payments_for_user(Payment.objects.all(), self.request.user)

    def _deny_manager_write(self):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Property managers can view payments but not record or edit them.')

    def create(self, request, *args, **kwargs):
        self._deny_manager_write()
        """Override create to send invoice email after payment is created."""
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        proof_files = request.FILES.getlist('proof_of_payment_files_upload')
        if proof_files:
            if hasattr(data, 'setlist'):
                data.setlist('proof_of_payment_files_upload', proof_files)
            else:
                data['proof_of_payment_files_upload'] = proof_files
        serializer = self.get_serializer(data=data)
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

        # Send admin notification when tenant uploads proof of payment
        if payment.proof_of_payment_files and len(payment.proof_of_payment_files) > 0:
            try:
                try:
                    send_proof_of_payment_notification_to_admin.delay(payment.id)
                    logger.info(f"Queued proof-of-payment admin notification for payment {payment.id}")
                except Exception:
                    send_proof_of_payment_notification_to_admin(payment.id)
                    logger.info(f"Sent proof-of-payment admin notification inline for payment {payment.id}")
            except Exception as e:
                logger.error(f"Failed to send proof-of-payment admin notification: {e}")

        response_data = dict(serializer.data)
        response_data['invoice_email_sent'] = invoice_email_sent
        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_update(self, serializer):
        self._deny_manager_write()
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
    
    def perform_destroy(self, instance):
        self._deny_manager_write()
        instance.delete()

    @action(detail=True, methods=['post'], url_path='send-receipt')
    def send_receipt(self, request, pk=None):
        """Send receipt email to tenant for a payment (same pattern as Legal & Compliance)."""
        self._deny_manager_write()
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

    @action(detail=False, methods=['get'], url_path='income-statement')
    def income_statement(self, request):
        """Live P&L / income statement by property, unit, and portfolio."""
        if is_property_manager(request.user):
            return Response(
                {'error': 'Income statement is available to admin only. Property managers use the Expenses tab.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        year = timezone.now().year
        try:
            if request.query_params.get('year'):
                year = int(request.query_params.get('year'))
        except (TypeError, ValueError):
            return Response({'error': 'Invalid year'}, status=status.HTTP_400_BAD_REQUEST)

        admin_view = is_admin_user(request.user)
        properties_qs = filter_properties_for_user(
            Property.objects.select_related('financials').prefetch_related('property_units'),
            request.user,
        )
        properties = list(properties_qs)
        property_ids = [p.id for p in properties]
        property_ids_set = set(property_ids)

        def normalize(text):
            return re.sub(r'[^a-z0-9]+', '', (text or '').lower())

        property_aliases = []
        for p in properties:
            aliases = [normalize(p.name), normalize(p.address)]
            aliases = [a for a in aliases if a]
            property_aliases.append((p.id, aliases))

        def match_property_id(unit_text):
            token = normalize(unit_text)
            if not token:
                return None
            for prop_id, aliases in property_aliases:
                if any(alias and alias in token for alias in aliases):
                    return prop_id
            return None

        unit_rows_by_property = defaultdict(list)
        for prop in properties:
            for unit in prop.property_units.all():
                unit_rows_by_property[prop.id].append(unit)

        tenant_prop_map = {}
        for t in Tenant.objects.only('id', 'property_unit'):
            pid = match_property_id(t.property_unit)
            if pid in property_ids_set:
                tenant_prop_map[t.id] = pid

        rent_income_by_property = defaultdict(lambda: Decimal('0'))
        rent_income_by_unit = defaultdict(lambda: Decimal('0'))

        payments_qs = Payment.objects.filter(
            status='Paid',
            date__year=year,
            type='Rent',
            tenant_id__in=tenant_prop_map.keys() if tenant_prop_map else [],
        ).select_related('tenant').only('id', 'amount', 'tenant_id', 'tenant__property_unit')

        for row in payments_qs.values('tenant_id').annotate(total=Sum('amount')):
            pid = tenant_prop_map.get(row['tenant_id'])
            if pid:
                rent_income_by_property[pid] += row['total'] or Decimal('0')

        for pay in payments_qs:
            prop_id = tenant_prop_map.get(pay.tenant_id)
            if not prop_id:
                continue
            unit_token = normalize(pay.tenant.property_unit if pay.tenant else '')
            for unit in unit_rows_by_property.get(prop_id, []):
                if normalize(unit.label) in unit_token or unit_token in normalize(unit.label):
                    rent_income_by_unit[unit.id] += pay.amount or Decimal('0')
                    break

        short_stay_by_property = defaultdict(lambda: Decimal('0'))
        for row in ShortStayBooking.objects.filter(
            status='confirmed',
            check_in__year=year,
            property_id__in=property_ids,
        ).values('property_id').annotate(total=Sum('total_amount')):
            short_stay_by_property[row['property_id']] = row['total'] or Decimal('0')

        expenses_by_property = defaultdict(lambda: Decimal('0'))
        expenses_by_category = defaultdict(lambda: Decimal('0'))
        expenses_by_unit = defaultdict(lambda: Decimal('0'))
        expenses_qs = OperatingExpense.objects.filter(
            date__year=year,
        ).filter(
            Q(property_id__in=property_ids) | Q(property_id__isnull=True)
        ).select_related('property', 'unit').only(
            'id', 'amount', 'category', 'property_id', 'unit_id', 'visibility'
        )
        if not admin_view:
            expenses_qs = expenses_qs.exclude(visibility='admin_only')
        for exp in expenses_qs:
            amount = exp.amount or Decimal('0')
            expenses_by_category[exp.category] += amount
            if exp.unit_id:
                expenses_by_unit[exp.unit_id] += amount
            if exp.property_id:
                expenses_by_property[exp.property_id] += amount
            else:
                expenses_by_property['portfolio'] += amount

        property_rows = []
        unit_detail_rows = []
        total_rent = Decimal('0')
        total_short = Decimal('0')
        total_expenses = Decimal('0')
        for p in properties:
            rent = rent_income_by_property[p.id]
            short = short_stay_by_property[p.id]
            expenses = expenses_by_property[p.id]
            income = rent + short
            net = income - expenses
            total_rent += rent
            total_short += short
            total_expenses += expenses

            image_url = None
            if p.image:
                image_url = request.build_absolute_uri(p.image.url)
            elif p.image_url:
                image_url = p.image_url

            financials_data = None
            if admin_view:
                fin = getattr(p, 'financials', None)
                if fin:
                    financials_data = {
                        'purchase_price': float(fin.purchase_price or 0),
                        'down_payment': float(fin.down_payment or 0),
                        'closing_cost': float(fin.closing_cost or 0),
                        'loan_amount': float(fin.loan_amount or 0),
                        'interest_rate': float(fin.interest_rate or 0),
                        'loan_term_years': fin.loan_term_years,
                        'monthly_mortgage_payment': float(fin.monthly_mortgage_payment or 0),
                        'land_value': float(fin.land_value or 0),
                        'annual_depreciation_years': float(fin.annual_depreciation_years or 27.5),
                        'escrow_notes': fin.escrow_notes or '',
                    }

            units = []
            for unit in unit_rows_by_property.get(p.id, []):
                unit_income = rent_income_by_unit[unit.id]
                unit_expenses = expenses_by_unit[unit.id]
                unit_detail = {
                    'unit_id': unit.id,
                    'property_id': p.id,
                    'label': unit.label,
                    'monthly_rent': float(unit.monthly_rent or 0),
                    'status': unit.status,
                    'rent_income': float(unit_income),
                    'total_expenses': float(unit_expenses),
                    'net_income': float(unit_income - unit_expenses),
                }
                units.append(unit_detail)
                unit_detail_rows.append(unit_detail)

            property_rows.append({
                'property_id': p.id,
                'property_name': p.name,
                'address': p.address,
                'city': p.city,
                'state': p.state,
                'units_count': p.units,
                'image_url': image_url,
                'rent_income': float(rent),
                'short_stay_income': float(short),
                'total_income': float(income),
                'total_expenses': float(expenses),
                'net_income': float(net),
                'units': units,
                'financials': financials_data,
            })

        portfolio_expenses = total_expenses + expenses_by_property['portfolio']
        portfolio_income = total_rent + total_short
        portfolio_net = portfolio_income - portfolio_expenses

        monthly = []
        month_rent_map = {
            int(row['month']): row['total'] or Decimal('0')
            for row in Payment.objects.filter(
                status='Paid', type='Rent', date__year=year,
            ).annotate(month=ExtractMonth('date')).values('month').annotate(total=Sum('amount'))
        }
        month_short_map = {
            int(row['month']): row['total'] or Decimal('0')
            for row in ShortStayBooking.objects.filter(
                status='confirmed',
                check_in__year=year,
                property_id__in=property_ids,
            ).annotate(month=ExtractMonth('check_in')).values('month').annotate(total=Sum('total_amount'))
        }
        month_exp_qs = OperatingExpense.objects.filter(
            date__year=year,
        ).filter(
            Q(property_id__in=property_ids) | Q(property_id__isnull=True)
        )
        if not admin_view:
            month_exp_qs = month_exp_qs.exclude(visibility='admin_only')
        month_exp_map = {
            int(row['month']): row['total'] or Decimal('0')
            for row in month_exp_qs.annotate(month=ExtractMonth('date')).values('month').annotate(total=Sum('amount'))
        }
        for month in range(1, 13):
            month_rent = month_rent_map.get(month, Decimal('0'))
            month_short = month_short_map.get(month, Decimal('0'))
            month_exp = month_exp_map.get(month, Decimal('0'))
            monthly.append({
                'month': month,
                'income': float(month_rent + month_short),
                'expenses': float(month_exp),
                'net': float((month_rent + month_short) - month_exp),
            })

        return Response({
            'year': year,
            'is_admin_view': admin_view,
            'portfolio': {
                'rent_income': float(total_rent),
                'short_stay_income': float(total_short),
                'total_income': float(portfolio_income),
                'total_expenses': float(portfolio_expenses),
                'net_income': float(portfolio_net),
            },
            'by_property': property_rows,
            'by_unit': unit_detail_rows,
            'expenses_by_category': {k: float(v) for k, v in expenses_by_category.items()},
            'monthly': monthly,
        })


class OperatingExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = OperatingExpenseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = OperatingExpense.objects.select_related('property', 'unit', 'created_by').all()
        qs = qs.filter(
            Q(property__isnull=True)
            | Q(property__in=filter_properties_for_user(Property.objects.all(), self.request.user))
        )
        if not is_admin_user(self.request.user):
            qs = qs.exclude(visibility='admin_only')
        year = self.request.query_params.get('year')
        if year:
            try:
                qs = qs.filter(date__year=int(year))
            except (TypeError, ValueError):
                pass
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                qs = qs[: max(1, int(limit))]
            except (TypeError, ValueError):
                pass
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if is_admin_user(user):
            raise PermissionDenied('Admins view expenses only. Property managers record operating costs.')
        if not is_property_manager(user):
            raise PermissionDenied('Only property managers can record operating expenses.')
        prop = serializer.validated_data.get('property')
        if prop:
            allowed = filter_properties_for_user(Property.objects.filter(id=prop.id), user)
            if not allowed.exists():
                raise PermissionDenied('You cannot record expenses for this property.')
        serializer.save(created_by=user)

    def perform_update(self, serializer):
        if is_admin_user(self.request.user):
            raise PermissionDenied('Admins view expenses only. Property managers record operating costs.')
        if is_property_manager(self.request.user):
            prop = serializer.validated_data.get('property', serializer.instance.property)
            if prop:
                allowed = filter_properties_for_user(Property.objects.filter(id=prop.id), self.request.user)
                if not allowed.exists():
                    raise PermissionDenied('You cannot edit expenses for this property.')
        serializer.save()

    def perform_destroy(self, instance):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Property managers cannot delete expense records.')
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class PropertyUnitViewSet(viewsets.ModelViewSet):
    serializer_class = PropertyUnitSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        property_ids = filter_properties_for_user(Property.objects.all(), self.request.user)
        return PropertyUnit.objects.select_related('property').filter(property__in=property_ids)

    def perform_create(self, serializer):
        prop = serializer.validated_data['property']
        allowed = filter_properties_for_user(Property.objects.filter(id=prop.id), self.request.user)
        if not allowed.exists() and not is_admin_user(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You cannot add units to this property.')
        serializer.save()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manager_me(request):
    """Current property manager profile and assigned properties."""
    user = request.user
    if is_admin_user(user):
        return Response({
            'role': 'admin',
            'managed_property_ids': list(Property.objects.values_list('id', flat=True)),
        })
    if not is_property_manager(user):
        return Response({'error': 'Not a property manager'}, status=status.HTTP_403_FORBIDDEN)
    profile = getattr(user, 'manager_profile', None)
    if not profile:
        return Response({
            'role': 'property_manager',
            'managed_property_ids': [],
            'phone': '',
        })
    return Response({
        'role': 'property_manager',
        'managed_property_ids': list(profile.properties.values_list('id', flat=True)),
        'phone': profile.phone,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
        },
    })

class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceRequest.objects.all()
    serializer_class = MaintenanceRequestSerializer
    
    def get_queryset(self):
        qs = MaintenanceRequest.objects.all()
        if self.action != 'create':
            qs = filter_maintenance_for_user(qs, self.request.user)
        return qs

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

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if is_property_manager(request.user):
            raise PermissionDenied('Lease templates are admin only.')


class LegalDocumentViewSet(viewsets.ModelViewSet):
    queryset = LegalDocument.objects.all()
    serializer_class = LegalDocumentSerializer
    permission_classes = [IsAuthenticated]  # Require authentication for legal documents

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        if is_property_manager(self.request.user) and self.action in (
            'list', 'retrieve', 'create', 'update', 'partial_update', 'destroy',
        ):
            raise PermissionDenied('Legal documents are admin only.')
        queryset = LegalDocument.objects.all()
        tenant_id = self.request.query_params.get('tenant')
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        return queryset

    @action(detail=True, methods=['get'], url_path='signing_metadata', permission_classes=[AllowAny])
    def signing_metadata(self, request, pk=None):
        """
        Return metadata required for in-house e-signing:
        - Backend PDF proxy URL
        - Normalized overlay field definitions (checkboxes, initials, signatures, dates).

        Coordinates are normalized (0-1) relative to the visible page so the
        frontend can render a responsive overlay across devices.
        """
        try:
            legal_doc = self.get_object()
        except LegalDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        if not legal_doc.pdf_file:
            return Response({'error': 'No PDF file available for this document'}, status=status.HTTP_400_BAD_REQUEST)

        request_obj = request._request if hasattr(request, '_request') else request
        pdf_proxy_url = request_obj.build_absolute_uri(f"/api/legal-documents/{legal_doc.id}/pdf/")

        # For now we expose a conservative, static field map for Lease Agreement.
        # These normalized coordinates are easy for the frontend to adapt and we can
        # evolve them later (e.g. store per-template configuration in DB).
        fields = []
        if (legal_doc.type or '').lower() == 'lease agreement':
            fields = [
                # Agreement checkboxes (tenant ticks to confirm)
                {
                    "id": "agree_terms",
                    "type": "checkbox",
                    "label": "I agree to the terms",
                    "page": 1,
                    "x": 0.12,
                    "y": 0.72,
                    "width": 0.04,
                    "height": 0.04,
                    "required": True,
                },
                {
                    "id": "agree_rules",
                    "type": "checkbox",
                    "label": "I agree to community rules",
                    "page": 1,
                    "x": 0.12,
                    "y": 0.76,
                    "width": 0.04,
                    "height": 0.04,
                    "required": True,
                },
                # Tenant initials (short text)
                {
                    "id": "tenant_initials",
                    "type": "text",
                    "label": "Initials",
                    "page": 1,
                    "x": 0.55,
                    "y": 0.72,
                    "width": 0.12,
                    "height": 0.04,
                    "required": True,
                },
                # Tenant signature block
                {
                    "id": "tenant_signature",
                    "type": "signature",
                    "label": "Tenant Signature",
                    "page": 1,
                    "x": 0.12,
                    "y": 0.82,
                    "width": 0.35,
                    "height": 0.07,
                    "required": True,
                },
                {
                    "id": "tenant_signature_date",
                    "type": "text",
                    "label": "Date",
                    "page": 1,
                    "x": 0.52,
                    "y": 0.82,
                    "width": 0.15,
                    "height": 0.05,
                    "required": True,
                },
                # Landlord signature block
                {
                    "id": "landlord_signature",
                    "type": "signature",
                    "label": "Landlord Signature",
                    "page": 1,
                    "x": 0.12,
                    "y": 0.9,
                    "width": 0.35,
                    "height": 0.07,
                    "required": False,
                },
                {
                    "id": "landlord_signature_date",
                    "type": "text",
                    "label": "Date",
                    "page": 1,
                    "x": 0.52,
                    "y": 0.9,
                    "width": 0.15,
                    "height": 0.05,
                    "required": False,
                },
            ]

        return Response(
            {
                "id": legal_doc.id,
                "tenant_id": legal_doc.tenant_id,
                "type": legal_doc.type,
                "status": legal_doc.status,
                "pdf_url": pdf_proxy_url,
                "fields": fields,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'], url_path='submit_signed', permission_classes=[AllowAny])
    def submit_signed(self, request, pk=None):
        """
        Submit filled form values and field definitions; stamp them onto the PDF,
        store the signed PDF, and record audit info.
        Body: { "values": { field_id: value }, "fields": [ { id, type, page, x, y, width, height }, ... ] }
        """
        try:
            legal_doc = self.get_object()
        except LegalDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.is_authenticated:
            tenant = Tenant.objects.filter(email=request.user.email).first()
            if tenant and legal_doc.tenant_id != tenant.id:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        if not legal_doc.pdf_file:
            return Response({'error': 'No PDF file available'}, status=status.HTTP_400_BAD_REQUEST)

        values = request.data.get('values')
        fields = request.data.get('fields')
        if not isinstance(values, dict):
            return Response({'error': 'values must be an object'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(fields, list):
            return Response({'error': 'fields must be an array'}, status=status.HTTP_400_BAD_REQUEST)

        pdf_bytes = None
        if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
            public_id = (legal_doc.pdf_file.name or '').lstrip('/')
            pdf_bytes = download_cloudinary_file(public_id)
        if not pdf_bytes:
            try:
                legal_doc.pdf_file.open('rb')
                pdf_bytes = legal_doc.pdf_file.read()
                legal_doc.pdf_file.close()
            except Exception as e:
                logger.warning(f"Could not read PDF file from storage: {e}")
        if not pdf_bytes:
            return Response({'error': 'Could not retrieve PDF'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            signed_pdf_bytes = stamp_signed_pdf(pdf_bytes, fields, values)
        except Exception as e:
            logger.error(f"Error stamping PDF: {e}", exc_info=True)
            return Response({'error': f'Failed to stamp PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f"signed_lease_{legal_doc.tenant_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        request_obj = request._request if hasattr(request, '_request') else request
        audit = {
            'signed_at': timezone.now().isoformat(),
            'tenant_id': legal_doc.tenant_id,
            'ip': request_obj.META.get('REMOTE_ADDR'),
            'user_agent': (request_obj.META.get('HTTP_USER_AGENT') or '')[:500],
        }

        if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
            try:
                import cloudinary.uploader
                if not cloudinary.config().api_secret:
                    cloudinary.config(
                        cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
                        api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
                        api_secret=settings.CLOUDINARY_STORAGE['API_SECRET'],
                    )
                public_id_new = f"media/signed_leases/{filename}"
                if public_id_new.lower().endswith('.pdf'):
                    public_id_new = public_id_new[:-4]
                upload_result = cloudinary.uploader.upload(
                    signed_pdf_bytes,
                    resource_type="raw",
                    public_id=public_id_new,
                    type="upload",
                    format="pdf",
                )
                legal_doc.pdf_file.name = upload_result.get('public_id') or public_id_new
            except Exception as e:
                logger.error(f"Cloudinary upload failed for signed PDF: {e}")
                legal_doc.pdf_file.save(filename, ContentFile(signed_pdf_bytes), save=False)
        else:
            legal_doc.pdf_file.save(filename, ContentFile(signed_pdf_bytes), save=False)

        legal_doc.status = 'Signed'
        legal_doc.signed_at = timezone.now()
        legal_doc.signing_audit = audit
        legal_doc.save()

        tenant = legal_doc.tenant
        tenant.lease_status = 'Signed'
        # Auto-activate resident once signing is completed (tenant-only or tenant+landlord flow).
        if tenant.status != 'Active':
            tenant.status = 'Active'
            tenant.save(update_fields=['lease_status', 'status'])
        else:
            tenant.save(update_fields=['lease_status'])

        # Send confirmation emails to tenant and admin
        try:
            from .email_service import send_lease_signed_confirmation
            try:
                send_lease_signed_confirmation.delay(legal_doc.id)
            except Exception:
                send_lease_signed_confirmation(legal_doc.id)
        except Exception as e:
            logger.error(f"Failed to send signed confirmation email: {e}")

        pdf_url = request_obj.build_absolute_uri(f"/api/legal-documents/{legal_doc.id}/pdf/")
        serializer = self.get_serializer(legal_doc)
        data = dict(serializer.data)
        data['pdf_url'] = pdf_url
        data['signed_at'] = legal_doc.signed_at.isoformat() if legal_doc.signed_at else None
        return Response(data, status=status.HTTP_200_OK)

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

    @action(detail=True, methods=['post'], url_path='send_lease_inhouse', permission_classes=[IsAuthenticated])
    def send_lease_inhouse(self, request, pk=None):
        """
        Send a one-time signing link to the tenant via email (in-house flow).
        Creates/reuses a LeaseSigningToken and emails the tenant a link to sign in-app.
        """
        try:
            legal_doc = self.get_object()
        except LegalDocument.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        if not legal_doc.pdf_file:
            return Response({'error': 'No PDF file available. Generate the lease first.'}, status=status.HTTP_400_BAD_REQUEST)

        if legal_doc.status == 'Signed':
            return Response({'error': 'This lease is already signed.'}, status=status.HTTP_400_BAD_REQUEST)

        from datetime import timedelta
        from .models import LeaseSigningToken

        # Create a fresh token (invalidate previous one by deleting it)
        LeaseSigningToken.objects.filter(legal_document=legal_doc).delete()
        signing_token = LeaseSigningToken.objects.create(
            legal_document=legal_doc,
            expires_at=timezone.now() + timedelta(days=7),
        )

        legal_doc.status = 'Sent'
        legal_doc.delivery_method = 'In-House'
        legal_doc.save(update_fields=['status', 'delivery_method'])

        legal_doc.tenant.lease_status = 'Sent'
        legal_doc.tenant.save(update_fields=['lease_status'])

        # Send lease-ready email synchronously — admin-triggered, no Celery worker needed.
        try:
            from .email_service import _send_lease_ready_for_signing
            _send_lease_ready_for_signing(legal_doc.id, token=str(signing_token.token))
            logger.info(f"Lease-ready email sent for document {legal_doc.id}")
        except Exception as e:
            logger.error(f"Failed to send in-house lease email: {e}", exc_info=True)
            return Response({'error': f'Lease marked as Sent but email failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        serializer = self.get_serializer(legal_doc)
        return Response({**serializer.data, 'signing_token': str(signing_token.token)}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=['post'],
        url_path='send_notice_email',
        permission_classes=[IsAuthenticated],
    )
    def send_notice_email(self, request, pk=None):
        """
        Send an existing LegalDocument PDF to the tenant as a legal notice email.

        This is used by the Legal Compliance Center to ensure the email attachment
        matches the preview/template the admin generated.
        """
        from .email_service import send_notice_to_tenant

        legal_doc = self.get_object()

        # Frontend supplies delivery_method (Email/Certified Mail) and notice_type
        # so we can update the document fields before emailing.
        delivery_method = request.data.get('delivery_method', 'Email')
        notice_type = request.data.get('notice_type') or legal_doc.type
        tracking_number = request.data.get('tracking_number')

        if delivery_method not in ('Email', 'Certified Mail', 'Hand Delivered', 'Portal'):
            delivery_method = 'Email'

        legal_doc.type = notice_type
        legal_doc.status = 'Sent'
        legal_doc.delivery_method = delivery_method
        if tracking_number:
            legal_doc.tracking_number = tracking_number

        # Persist changes before sending the email task.
        fields_to_update = ['type', 'status', 'delivery_method']
        if tracking_number:
            fields_to_update.append('tracking_number')
        legal_doc.save(update_fields=fields_to_update)

        # Send email with the PDF attachment from the stored document.
        if not legal_doc.pdf_file:
            return Response(
                {'error': 'No PDF file available. Generate the notice first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            send_notice_to_tenant.delay(legal_doc.id)
        except Exception:
            # Celery may be misconfigured; fail-safe: send inline.
            send_notice_to_tenant(legal_doc.id)

        serializer = self.get_serializer(legal_doc)
        return Response(serializer.data, status=status.HTTP_200_OK)

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

        pdf_bytes = None
        if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
            public_id = (legal_doc.pdf_file.name or "").lstrip("/")
            logger.info(f"Attempting to download PDF for document {pk}, path: {public_id}")
            pdf_bytes = download_cloudinary_file(public_id)
            if pdf_bytes:
                logger.info(f"Successfully retrieved PDF for document {pk} ({len(pdf_bytes)} bytes)")
        if not pdf_bytes:
            try:
                legal_doc.pdf_file.open('rb')
                pdf_bytes = legal_doc.pdf_file.read()
                legal_doc.pdf_file.close()
            except Exception as e:
                logger.warning(f"Could not read PDF file for document {pk}: {e}")
        if not pdf_bytes:
            return Response({'error': 'Could not retrieve PDF'}, status=status.HTTP_404_NOT_FOUND)

        return HttpResponse(pdf_bytes, content_type="application/pdf")

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_signed_at = old_instance.signed_at
        legal_doc = serializer.save()
        new_signed_at = legal_doc.signed_at
        
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

def _clean_property_name_and_address(name, address, city, state):
    """Put unit from address into name and strip unit + duplicate city/state from address."""
    unit_label, address_no_unit = extract_unit_from_address(address)
    address_clean = strip_city_state_from_address(address_no_unit, city, state)
    if unit_label:
        base = re.sub(r"\s*-\s*Unit\s+[A-Za-z0-9]+\s*$", "", name, flags=re.IGNORECASE).strip() or name
        name = f"{base} - {unit_label}"
    return name, address_clean


class PropertyViewSet(viewsets.ModelViewSet):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    permission_classes = [AllowAny]  # Public access for all property operations (listings are public)
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def list(self, request, *args, **kwargs):
        qs = Property.objects.all().order_by("id")
        if request.user.is_authenticated and is_property_manager(request.user):
            qs = filter_properties_for_user(qs, request.user)
        data = PropertySerializer(qs, many=True, context={"request": request}).data
        for item in data:
            name, address = _clean_property_name_and_address(
                item.get("name", ""),
                item.get("address", ""),
                item.get("city", ""),
                item.get("state", ""),
            )
            item["name"] = name
            item["address"] = address
        return Response(data)

    def perform_create(self, serializer):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Only admin can add properties.')
        serializer.save()

    def perform_update(self, serializer):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Only admin can edit properties.')
        serializer.save()

    def perform_destroy(self, instance):
        if is_property_manager(self.request.user):
            raise PermissionDenied('Only admin can delete properties.')
        instance.delete()


class ShortStayBookingViewSet(viewsets.ModelViewSet):
    queryset = ShortStayBooking.objects.select_related('property').all()
    serializer_class = ShortStayBookingSerializer
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]

    def get_permissions(self):
        if self.action in ('create', 'check_availability', 'quote', 'booked_dates', 'validate_pin', 'guest_session'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        proof_files = request.FILES.getlist('proof_of_payment_files_upload')
        id_files = request.FILES.getlist('guest_id_files_upload')
        if proof_files:
            if hasattr(data, 'setlist'):
                data.setlist('proof_of_payment_files_upload', proof_files)
            else:
                data['proof_of_payment_files_upload'] = proof_files
        if id_files:
            if hasattr(data, 'setlist'):
                data.setlist('guest_id_files_upload', id_files)
            else:
                data['guest_id_files_upload'] = id_files
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()

        if booking.proof_of_payment_files:
            try:
                send_short_stay_proof_notification_to_admin.delay(booking.id)
            except Exception as e:
                logger.warning(f"Queued short-stay proof notification failed, skipping sync send: {e}")

        headers = self.get_success_headers(serializer.data)
        return Response({
            'id': booking.id,
            'status': booking.status,
            'guest_name': booking.guest_name,
            'property': booking.property_id,
            'check_in': booking.check_in,
            'check_out': booking.check_out,
            'total_amount': str(booking.total_amount),
        }, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        booking = serializer.save()
        if booking.status == 'confirmed':
            logger.info(f"Short-stay booking {booking.id} confirmed (PIN: {booking.access_pin or 'pending'})")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        patch_keys = {k for k in request.data.keys() if k not in ('csrfmiddlewaretoken',)}
        if patch_keys <= {'status', 'notes'}:
            return Response({
                'id': booking.id,
                'status': booking.status,
                'access_pin': booking.access_pin or '',
                'notes': booking.notes or '',
            })
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'], url_path='validate-pin')
    def validate_pin(self, request):
        pin = (request.query_params.get('pin') or '').strip()
        if not pin or len(pin) != 4 or not pin.isdigit():
            return Response({'error': 'Enter a valid 4-digit code.'}, status=status.HTTP_400_BAD_REQUEST)

        from .guest_portal import build_guest_property_payload, build_guest_reservation_payload

        booking = ShortStayBooking.objects.filter(
            access_pin=pin,
            status='confirmed',
        ).select_related('property').first()

        if not booking:
            return Response({'error': 'Invalid or expired code.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'source': 'django',
            'reservation': build_guest_reservation_payload(booking),
            'property': build_guest_property_payload(booking.property, booking),
        })

    @action(detail=False, methods=['get'], url_path='guest-session')
    def guest_session(self, request):
        reservation_id = (request.query_params.get('reservation_id') or '').strip()
        if not reservation_id.startswith('ss-'):
            return Response({'error': 'Invalid session id'}, status=status.HTTP_400_BAD_REQUEST)

        from .guest_portal import build_guest_property_payload, build_guest_reservation_payload

        try:
            booking_id = int(reservation_id.replace('ss-', ''))
        except ValueError:
            return Response({'error': 'Invalid session id'}, status=status.HTTP_400_BAD_REQUEST)

        booking = ShortStayBooking.objects.filter(
            id=booking_id,
            status='confirmed',
        ).select_related('property').first()

        if not booking:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'source': 'django',
            'reservation': build_guest_reservation_payload(booking),
            'property': build_guest_property_payload(booking.property, booking),
        })

    @action(detail=False, methods=['get'], url_path='check-availability')
    def check_availability(self, request):
        property_id = request.query_params.get('property_id')
        check_in = request.query_params.get('check_in')
        check_out = request.query_params.get('check_out')
        if not all([property_id, check_in, check_out]):
            return Response(
                {'error': 'property_id, check_in, and check_out are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            property_obj = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response({'error': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        from datetime import datetime as dt
        try:
            ci = dt.strptime(check_in, '%Y-%m-%d').date()
            co = dt.strptime(check_out, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if co <= ci:
            return Response({'available': False, 'reason': 'Check-out must be after check-in.'})

        from .serializers import check_short_stay_availability
        available, reason = check_short_stay_availability(property_obj, ci, co)
        return Response({'available': available, 'reason': reason if not available else ''})

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='document')
    def document(self, request, pk=None):
        booking = self.get_object()
        raw_path = (request.query_params.get('path') or '').strip()
        if not raw_path:
            return Response({'error': 'path is required'}, status=status.HTTP_400_BAD_REQUEST)

        normalized_path = raw_path.lstrip('/').replace('\\', '/')
        normalized_no_media = re.sub(r'^media/', '', normalized_path, flags=re.IGNORECASE)
        expected_prefix = f'short_stays/booking_{booking.id}/'
        if not normalized_no_media.startswith(expected_prefix):
            return Response({'error': 'Invalid document path'}, status=status.HTTP_403_FORBIDDEN)

        original_filename = request.query_params.get('filename')
        if not original_filename:
            all_docs = []
            for arr in [booking.proof_of_payment_files or [], booking.guest_id_files or []]:
                if isinstance(arr, list):
                    all_docs.extend([x for x in arr if isinstance(x, dict)])
            for doc in all_docs:
                doc_path = str(doc.get('path') or doc.get('file') or '').lstrip('/').replace('\\', '/')
                doc_no_media = re.sub(r'^media/', '', doc_path, flags=re.IGNORECASE)
                if doc_no_media == normalized_no_media and doc.get('filename'):
                    original_filename = str(doc.get('filename'))
                    break
        if not original_filename:
            original_filename = normalized_no_media.split('/')[-1]

        candidate_paths = [normalized_no_media, f"media/{normalized_no_media}"]
        file_handle = None
        for candidate in candidate_paths:
            try:
                file_handle = default_storage.open(candidate, 'rb')
                normalized_no_media = candidate
                break
            except Exception:
                continue

        if not file_handle:
            return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)

        content_type, _ = mimetypes.guess_type(original_filename)
        response = FileResponse(file_handle, content_type=content_type or 'application/octet-stream')
        disposition = 'inline' if request.query_params.get('download') != '1' else 'attachment'
        response['Content-Disposition'] = f'{disposition}; filename="{original_filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='booked-dates')
    def booked_dates(self, request):
        property_id = request.query_params.get('property_id')
        if not property_id:
            return Response({'error': 'property_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        bookings = ShortStayBooking.objects.filter(
            property_id=property_id,
            status__in=['pending_payment', 'proof_submitted', 'confirmed'],
        ).values('id', 'check_in', 'check_out', 'status', 'guest_name')
        blocks = ShortStayBlockedDate.objects.filter(property_id=property_id).values(
            'id', 'start_date', 'end_date', 'reason'
        )
        return Response({
            'bookings': [
                {
                    'id': b['id'],
                    'check_in': b['check_in'].isoformat(),
                    'check_out': b['check_out'].isoformat(),
                    'status': b['status'],
                    'guest_name': b['guest_name'],
                }
                for b in bookings
            ],
            'blocked': [
                {
                    'id': b['id'],
                    'start_date': b['start_date'].isoformat(),
                    'end_date': b['end_date'].isoformat(),
                    'reason': b['reason'] or '',
                }
                for b in blocks
            ],
        })

    @action(detail=False, methods=['get'], url_path='quote')
    def quote(self, request):
        property_id = request.query_params.get('property_id')
        check_in = request.query_params.get('check_in')
        check_out = request.query_params.get('check_out')
        if not all([property_id, check_in, check_out]):
            return Response(
                {'error': 'property_id, check_in, and check_out are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            property_obj = Property.objects.get(id=property_id)
        except Property.DoesNotExist:
            return Response({'error': 'Property not found'}, status=status.HTTP_404_NOT_FOUND)

        from datetime import datetime as dt
        from .serializers import calculate_short_stay_quote, check_short_stay_availability

        try:
            ci = dt.strptime(check_in, '%Y-%m-%d').date()
            co = dt.strptime(check_out, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if co <= ci:
            return Response({
                'error': 'Check-out must be after check-in.',
                'available': False,
            })

        nights = (co - ci).days
        try:
            num_guests = max(1, int(request.query_params.get('num_guests', 1)))
        except (TypeError, ValueError):
            num_guests = 1

        try:
            quote_data = calculate_short_stay_quote(property_obj, nights, num_guests)
            available, conflict_reason = check_short_stay_availability(property_obj, ci, co)
        except Exception as e:
            logger.exception('Short-stay quote failed')
            return Response(
                {'error': f'Could not calculate quote: {e}', 'available': False},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'available': available,
            'conflict_reason': conflict_reason if not available else '',
            'nights': quote_data['nights'],
            'nightly_rate': float(quote_data['nightly_rate']),
            'lodging_subtotal': float(quote_data['lodging_subtotal']),
            'discount_percent': float(quote_data['discount_percent']),
            'discount_amount': float(quote_data['discount_amount']),
            'cleaning_fee': float(quote_data['cleaning_fee']),
            'num_guests': quote_data['num_guests'],
            'included_guests': quote_data['included_guests'],
            'extra_guests': quote_data['extra_guests'],
            'extra_guest_fee_per_night': float(quote_data['extra_guest_fee_per_night']),
            'extra_guest_fee': float(quote_data['extra_guest_fee']),
            'subtotal': float(quote_data['lodging_subtotal']),
            'total_amount': float(quote_data['total_amount']),
            'max_guests': property_obj.get_short_stay_max_guests(),
            'check_in_time': property_obj.get_short_stay_check_in_time(),
            'check_out_time': property_obj.get_short_stay_check_out_time(),
        })


class ShortStayBlockedDateViewSet(viewsets.ModelViewSet):
    queryset = ShortStayBlockedDate.objects.select_related('property').all()
    serializer_class = ShortStayBlockedDateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        property_id = self.request.query_params.get('property_id')
        if property_id:
            qs = qs.filter(property_id=property_id)
        return qs


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


# ==================== Token-based in-house lease signing ====================

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def sign_lease_by_token(request):
    """
    GET  /api/sign-lease/?token=<uuid>  — validate token, return signing metadata
    POST /api/sign-lease/?token=<uuid>  — submit signed fields, stamp PDF, mark Signed

    No login required. The token is a one-time link sent via email by the admin.
    """
    raw_token = request.query_params.get('token') or request.data.get('token')
    if not raw_token:
        return Response({'error': 'token is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        signing_token = LeaseSigningToken.objects.select_related(
            'legal_document__tenant'
        ).get(token=raw_token)
    except (LeaseSigningToken.DoesNotExist, Exception):
        return Response({'error': 'Invalid or expired signing link.'}, status=status.HTTP_404_NOT_FOUND)

    if not signing_token.is_valid:
        return Response({'error': 'This signing link has already been used or has expired.'}, status=status.HTTP_410_GONE)

    legal_doc = signing_token.legal_document

    if request.method == 'GET':
        request_obj = request._request if hasattr(request, '_request') else request
        pdf_proxy_url = request_obj.build_absolute_uri(f"/api/legal-documents/{legal_doc.id}/pdf/")

        fields = []
        if (legal_doc.type or '').lower() == 'lease agreement':
            fields = [
                {"id": "agree_terms", "type": "checkbox", "label": "I agree to the terms",
                 "page": 1, "x": 0.12, "y": 0.72, "width": 0.04, "height": 0.04, "required": True},
                {"id": "agree_rules", "type": "checkbox", "label": "I agree to community rules",
                 "page": 1, "x": 0.12, "y": 0.76, "width": 0.04, "height": 0.04, "required": True},
                {"id": "tenant_initials", "type": "text", "label": "Initials",
                 "page": 1, "x": 0.55, "y": 0.72, "width": 0.12, "height": 0.04, "required": True},
                {"id": "tenant_signature", "type": "signature", "label": "Tenant Signature",
                 "page": 1, "x": 0.12, "y": 0.82, "width": 0.35, "height": 0.07, "required": True},
                {"id": "tenant_signature_date", "type": "text", "label": "Date",
                 "page": 1, "x": 0.52, "y": 0.82, "width": 0.15, "height": 0.05, "required": True},
                {"id": "landlord_signature", "type": "signature", "label": "Landlord Signature",
                 "page": 1, "x": 0.12, "y": 0.9, "width": 0.35, "height": 0.07, "required": False},
                {"id": "landlord_signature_date", "type": "text", "label": "Date",
                 "page": 1, "x": 0.52, "y": 0.9, "width": 0.15, "height": 0.05, "required": False},
            ]

        return Response({
            'id': legal_doc.id,
            'tenant_id': legal_doc.tenant_id,
            'tenant_name': legal_doc.tenant.name,
            'property_unit': legal_doc.tenant.property_unit,
            'type': legal_doc.type,
            'status': legal_doc.status,
            'pdf_url': pdf_proxy_url,
            'generated_content': legal_doc.generated_content or '',
            'fields': fields,
        }, status=status.HTTP_200_OK)

    # POST — submit signed values
    values = request.data.get('values')
    fields = request.data.get('fields')
    if not isinstance(values, dict):
        return Response({'error': 'values must be an object'}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(fields, list):
        return Response({'error': 'fields must be an array'}, status=status.HTTP_400_BAD_REQUEST)

    # Download original PDF
    pdf_bytes = None
    if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
        public_id = (legal_doc.pdf_file.name or '').lstrip('/')
        pdf_bytes = download_cloudinary_file(public_id)
    if not pdf_bytes:
        try:
            legal_doc.pdf_file.open('rb')
            pdf_bytes = legal_doc.pdf_file.read()
            legal_doc.pdf_file.close()
        except Exception as e:
            logger.warning(f"Could not read PDF for token signing: {e}")
    if not pdf_bytes:
        return Response({'error': 'Could not retrieve PDF'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # Stamp PDF
    try:
        signed_pdf_bytes = stamp_signed_pdf(pdf_bytes, fields, values)
    except Exception as e:
        logger.error(f"Error stamping PDF (token signing): {e}", exc_info=True)
        return Response({'error': f'Failed to stamp PDF: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    filename = f"signed_lease_{legal_doc.tenant_id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    request_obj = request._request if hasattr(request, '_request') else request
    # Collect non-signature inline field values filled in by the tenant
    inline_filled = {
        k: v for k, v in values.items()
        if (k.startswith('inline_') or k.startswith('checkbox_') or k.startswith('p'))
        and k not in ('tenant_signature', 'landlord_signature')
        and v not in (None, '', False)
    }
    audit = {
        'signed_at': timezone.now().isoformat(),
        'tenant_id': legal_doc.tenant_id,
        'ip': request_obj.META.get('REMOTE_ADDR'),
        'user_agent': (request_obj.META.get('HTTP_USER_AGENT') or '')[:500],
        'method': 'token_link',
    }
    if inline_filled:
        audit['filled_fields'] = inline_filled

    # Save signed PDF
    if hasattr(settings, 'CLOUDINARY_STORAGE') and settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
        try:
            import cloudinary.uploader
            if not cloudinary.config().api_secret:
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_STORAGE['CLOUD_NAME'],
                    api_key=settings.CLOUDINARY_STORAGE['API_KEY'],
                    api_secret=settings.CLOUDINARY_STORAGE['API_SECRET'],
                )
            public_id_new = f"media/signed_leases/{filename}"
            if public_id_new.lower().endswith('.pdf'):
                public_id_new = public_id_new[:-4]
            upload_result = cloudinary.uploader.upload(
                signed_pdf_bytes,
                resource_type="raw",
                public_id=public_id_new,
                type="upload",
                format="pdf",
            )
            legal_doc.pdf_file.name = upload_result.get('public_id') or public_id_new
        except Exception as e:
            logger.error(f"Cloudinary upload failed for token-signed PDF: {e}")
            legal_doc.pdf_file.save(filename, ContentFile(signed_pdf_bytes), save=False)
    else:
        legal_doc.pdf_file.save(filename, ContentFile(signed_pdf_bytes), save=False)

    legal_doc.status = 'Signed'
    legal_doc.signed_at = timezone.now()
    legal_doc.signing_audit = audit
    legal_doc.save()

    # Mark token as used
    signing_token.used_at = timezone.now()
    signing_token.save(update_fields=['used_at'])

    # Update tenant lease status
    tenant = legal_doc.tenant
    tenant.lease_status = 'Signed'
    # Auto-activate resident once signing is completed (tenant-only or tenant+landlord flow).
    if tenant.status != 'Active':
        tenant.status = 'Active'
        tenant.save(update_fields=['lease_status', 'status'])
    else:
        tenant.save(update_fields=['lease_status'])

    # Send confirmation emails
    try:
        from .email_service import send_lease_signed_confirmation
        try:
            send_lease_signed_confirmation.delay(legal_doc.id)
        except Exception:
            send_lease_signed_confirmation(legal_doc.id)
    except Exception as e:
        logger.error(f"Failed to send signed confirmation after token signing: {e}")

    pdf_url = request_obj.build_absolute_uri(f"/api/legal-documents/{legal_doc.id}/pdf/")
    return Response({
        'status': 'Signed',
        'pdf_url': pdf_url,
        'signed_at': legal_doc.signed_at.isoformat(),
    }, status=status.HTTP_200_OK)
