from rest_framework import serializers
from .models import Tenant, Payment, MaintenanceRequest, LegalDocument, Listing, Property, LeaseTemplate, ShortStayBooking, ShortStayBlockedDate, OperatingExpense, PropertyUnit, PropertyFinancials, PropertyManagerProfile
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
from datetime import datetime

class TenantSerializer(serializers.ModelSerializer):
    # Accept file uploads (these won't be in the model directly)
    photo_id_files_upload = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    income_verification_files_upload = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    background_check_files_upload = serializers.ListField(
        child=serializers.FileField(),
        write_only=True,
        required=False,
        allow_empty=True
    )
    
    class Meta:
        model = Tenant
        fields = '__all__'
        extra_kwargs = {
            'photo_id_files': {'read_only': True},
            'income_verification_files': {'read_only': True},
            'background_check_files': {'read_only': True},
            'balance': {'read_only': True},  # Balance is auto-calculated
        }

    def _normalize_file_entries(self, tenant_id, entries):
        """
        Ensure each uploaded document dict has a usable URL for frontend preview/download.
        Works for local media storage and Cloudinary storage.
        """
        request = self.context.get('request')
        out = []
        for item in (entries or []):
            if not isinstance(item, dict):
                out.append(item)
                continue

            entry = dict(item)
            existing_url = entry.get('url')
            if existing_url:
                out.append(entry)
                continue

            path = entry.get('path') or entry.get('file')
            if isinstance(path, str) and path.strip():
                try:
                    normalized_path = path.lstrip('/')
                    if request:
                        url = request.build_absolute_uri(
                            f"/api/tenants/{tenant_id}/document/?path={normalized_path}"
                        )
                    else:
                        url = f"/api/tenants/{tenant_id}/document/?path={normalized_path}"
                    entry['url'] = url
                except Exception:
                    # Fallback: preserve path and let frontend handle local /media URLs.
                    pass
            out.append(entry)
        return out

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['photo_id_files'] = self._normalize_file_entries(instance.id, rep.get('photo_id_files'))
        rep['income_verification_files'] = self._normalize_file_entries(instance.id, rep.get('income_verification_files'))
        rep['background_check_files'] = self._normalize_file_entries(instance.id, rep.get('background_check_files'))
        return rep
    
    def create(self, validated_data):
        # Extract file uploads
        photo_id_uploads = validated_data.pop('photo_id_files_upload', [])
        income_verification_uploads = validated_data.pop('income_verification_files_upload', [])
        background_check_uploads = validated_data.pop('background_check_files_upload', [])
        
        # Remove balance from validated_data if present (it's auto-calculated)
        validated_data.pop('balance', None)
        
        # Create the tenant instance
        tenant = super().create(validated_data)
        
        # Handle photo ID file uploads
        photo_id_file_paths = []
        for file in photo_id_uploads:
            # Create unique filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"applications/tenant_{tenant.id}/photo_id_{timestamp}_{file.name}"
            
            # Save file to storage
            path = default_storage.save(filename, ContentFile(file.read()))
            
            # Store file metadata
            photo_id_file_paths.append({
                'filename': file.name,
                'path': path,
                'size': file.size,
                'uploaded_at': datetime.now().isoformat()
            })
        
        # Handle income verification file uploads
        income_verification_file_paths = []
        for file in income_verification_uploads:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"applications/tenant_{tenant.id}/income_{timestamp}_{file.name}"
            
            path = default_storage.save(filename, ContentFile(file.read()))
            
            income_verification_file_paths.append({
                'filename': file.name,
                'path': path,
                'size': file.size,
                'uploaded_at': datetime.now().isoformat()
            })
        
        # Handle background check file uploads
        background_check_file_paths = []
        for file in background_check_uploads:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"applications/tenant_{tenant.id}/background_{timestamp}_{file.name}"
            
            path = default_storage.save(filename, ContentFile(file.read()))
            
            background_check_file_paths.append({
                'filename': file.name,
                'path': path,
                'size': file.size,
                'uploaded_at': datetime.now().isoformat()
            })
        
        # Update tenant with file paths and calculate balance
        tenant.photo_id_files = photo_id_file_paths
        tenant.income_verification_files = income_verification_file_paths
        tenant.background_check_files = background_check_file_paths
        # Persist uploaded document references.
        # tenant.update_balance() saves only the `balance` field (update_fields=['balance']),
        # so we must save these JSON fields first.
        tenant.save(update_fields=['photo_id_files', 'income_verification_files', 'background_check_files'])
        tenant.update_balance()  # Auto-calculate balance
        
        return tenant
    
    def update(self, instance, validated_data):
        """Override update to auto-calculate balance"""
        # Remove balance from validated_data if present (it's auto-calculated)
        validated_data.pop('balance', None)
        
        # Extract file uploads (for update operations)
        validated_data.pop('photo_id_files_upload', None)
        validated_data.pop('income_verification_files_upload', None)
        validated_data.pop('background_check_files_upload', None)
        
        # Update the tenant instance
        tenant = super().update(instance, validated_data)
        
        # Recalculate balance after update
        tenant.update_balance()
        
        return tenant
    
    def validate(self, data):
        """Validate file uploads and application data"""
        # Validate file uploads
        photo_id_uploads = data.get('photo_id_files_upload', [])
        income_verification_uploads = data.get('income_verification_files_upload', [])
        background_check_uploads = data.get('background_check_files_upload', [])
        
        # Validate file sizes (max 10MB per file)
        max_size = 10 * 1024 * 1024  # 10MB in bytes
        allowed_extensions = ['.pdf', '.jpg', '.jpeg', '.png']
        
        for file in photo_id_uploads:
            if file.size > max_size:
                raise serializers.ValidationError({
                    'photo_id_files_upload': f'File {file.name} exceeds maximum size of 10MB'
                })
            
            # Validate file type
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError({
                    'photo_id_files_upload': f'File {file.name} has invalid type. Allowed: PDF, JPG, PNG'
                })
        
        for file in income_verification_uploads:
            if file.size > max_size:
                raise serializers.ValidationError({
                    'income_verification_files_upload': f'File {file.name} exceeds maximum size of 10MB'
                })
            
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError({
                    'income_verification_files_upload': f'File {file.name} has invalid type. Allowed: PDF, JPG, PNG'
                })
        
        for file in background_check_uploads:
            if file.size > max_size:
                raise serializers.ValidationError({
                    'background_check_files_upload': f'File {file.name} exceeds maximum size of 10MB'
                })
            
            ext = os.path.splitext(file.name)[1].lower()
            if ext not in allowed_extensions:
                raise serializers.ValidationError({
                    'background_check_files_upload': f'File {file.name} has invalid type. Allowed: PDF, JPG, PNG'
                })
        
        return data

class PaymentSerializer(serializers.ModelSerializer):
    proof_of_payment_files_upload = serializers.ListField(
        child=serializers.FileField(max_length=100000, allow_empty_file=False),
        write_only=True,
        required=False,
        allow_empty=True
    )
    
    class Meta:
        model = Payment
        fields = '__all__'
        extra_kwargs = {
            'proof_of_payment_files': {'read_only': True},
        }
    
    def create(self, validated_data):
        """Override create to auto-update tenant balance after payment"""
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)
        
        proof_uploads = validated_data.pop('proof_of_payment_files_upload', [])
        
        # Ensure payment is fully committed before updating tenant balance
        with transaction.atomic():
            payment = super().create(validated_data)
            
            # Handle proof of payment file uploads
            proof_file_paths = []
            for file in proof_uploads:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"payments/tenant_{payment.tenant_id}/proof_{timestamp}_{file.name}"
                path = default_storage.save(filename, ContentFile(file.read()))
                proof_file_paths.append({
                    'filename': file.name,
                    'path': path,
                    'size': file.size,
                    'uploaded_at': datetime.now().isoformat()
                })
            if proof_file_paths:
                payment.proof_of_payment_files = proof_file_paths
                payment.save(update_fields=['proof_of_payment_files'])
            
            logger.info(f"Payment created: {payment.id} for tenant {payment.tenant.name}, amount: {payment.amount}")
            
            # Get balance before update
            old_balance = payment.tenant.balance
            
            # Update the tenant's balance after payment is recorded
            payment.tenant.update_balance()
            
            # Get balance after update
            new_balance = payment.tenant.balance
            logger.info(f"Tenant {payment.tenant.name} balance updated: {old_balance} -> {new_balance}")
            
            # Refresh the tenant to ensure we have the latest data
            payment.tenant.refresh_from_db()
        
        # Refresh payment to get updated tenant data
        payment.refresh_from_db()
        return payment
    
    def update(self, instance, validated_data):
        """Override update to auto-update tenant balance after payment update"""
        payment = super().update(instance, validated_data)
        # Update the tenant's balance after payment is updated
        payment.tenant.update_balance()
        return payment

class MaintenanceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceRequest
        fields = '__all__'

class OperatingExpenseSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    unit_label = serializers.CharField(source='unit.label', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OperatingExpense
        fields = '__all__'
        read_only_fields = ('created_by',)

    def get_created_by_name(self, obj):
        if not obj.created_by:
            return None
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email

    def validate(self, data):
        visibility = data.get('visibility', getattr(self.instance, 'visibility', 'operating'))
        category = data.get('category', getattr(self.instance, 'category', 'utilities'))
        admin_categories = {'mortgage_interest', 'mortgage_principal', 'depreciation'}
        if category in admin_categories:
            data['visibility'] = 'admin_only'
        request = self.context.get('request')
        if request and request.user and not (request.user.is_staff or request.user.is_superuser):
            if visibility == 'admin_only' or category in admin_categories:
                raise serializers.ValidationError('Property managers cannot create admin-only expenses.')
        return data


class PropertyUnitSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PropertyUnit
        fields = '__all__'


class PropertyFinancialsSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = PropertyFinancials
        fields = '__all__'


class PropertyManagerProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    property_ids = serializers.PrimaryKeyRelatedField(
        source='properties', many=True, queryset=Property.objects.all(), required=False
    )

    class Meta:
        model = PropertyManagerProfile
        fields = ('id', 'user', 'user_email', 'user_name', 'phone', 'property_ids', 'created_at')

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

class LeaseTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaseTemplate
        fields = '__all__'

class LegalDocumentSerializer(serializers.ModelSerializer):
    pdf_url = serializers.SerializerMethodField()
    
    class Meta:
        model = LegalDocument
        fields = '__all__'
    
    def get_pdf_url(self, obj):
        request = self.context.get('request')
        if not request:
            return None
        return request.build_absolute_uri(f"/api/legal-documents/{obj.id}/pdf/")

class ListingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Listing
        fields = '__all__'

class PropertySerializer(serializers.ModelSerializer):
    display_image = serializers.SerializerMethodField()
    effective_nightly_rate = serializers.SerializerMethodField()
    effective_max_guests = serializers.SerializerMethodField()
    effective_cleaning_fee = serializers.SerializerMethodField()
    effective_check_in_time = serializers.SerializerMethodField()
    effective_check_out_time = serializers.SerializerMethodField()
    guest_listing_title = serializers.SerializerMethodField()
    guest_listing_description = serializers.SerializerMethodField()
    guest_listing_area = serializers.SerializerMethodField()
    guest_listing_location = serializers.SerializerMethodField()
    
    class Meta:
        model = Property
        fields = '__all__'
        read_only_fields = (
            'display_image', 'effective_nightly_rate', 'effective_max_guests',
            'effective_cleaning_fee', 'effective_check_in_time', 'effective_check_out_time',
            'guest_listing_title', 'guest_listing_description', 'guest_listing_area',
            'guest_listing_location',
        )
    
    def get_display_image(self, obj):
        """Returns the full URL for the image (uploaded file or external URL)"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url

    def get_effective_nightly_rate(self, obj):
        return float(obj.get_short_stay_nightly_rate())

    def get_effective_max_guests(self, obj):
        return obj.get_short_stay_max_guests()

    def get_effective_cleaning_fee(self, obj):
        return float(obj.get_short_stay_cleaning_fee())

    def get_effective_check_in_time(self, obj):
        return obj.get_short_stay_check_in_time()

    def get_effective_check_out_time(self, obj):
        return obj.get_short_stay_check_out_time()

    def get_guest_listing_title(self, obj):
        return obj.get_short_stay_listing_title()

    def get_guest_listing_description(self, obj):
        return obj.get_short_stay_listing_description()

    def get_guest_listing_area(self, obj):
        return obj.get_short_stay_listing_area()

    def get_guest_listing_location(self, obj):
        return obj.get_short_stay_listing_location()
    
    def validate(self, data):
        """Ensure either image file or image_url is provided, not both"""
        image = data.get('image')
        image_url = data.get('image_url')
        
        # If both are being set, prioritize the uploaded file
        if image and image_url:
            data['image_url'] = None  # Clear URL when file is uploaded
        
        return data


def _short_stay_discount_percent(nights: int) -> float:
    if nights >= 14:
        return 15.0
    if nights >= 7:
        return 10.0
    if nights >= 3:
        return 5.0
    return 0.0


ACTIVE_SHORT_STAY_STATUSES = ('pending_payment', 'proof_submitted', 'confirmed')


def check_short_stay_availability(property_obj, check_in, check_out, exclude_booking_id=None):
    if not property_obj.short_stay_enabled:
        return False, 'Short stays are disabled for this property.'
    qs = ShortStayBooking.objects.filter(
        property=property_obj,
        status__in=ACTIVE_SHORT_STAY_STATUSES,
        check_in__lt=check_out,
        check_out__gt=check_in,
    )
    if exclude_booking_id:
        qs = qs.exclude(id=exclude_booking_id)
    if qs.exists():
        conflict = qs.first()
        return False, (
            f'Dates overlap with booking for {conflict.guest_name} '
            f'({conflict.check_in} to {conflict.check_out}).'
        )
    blocked = ShortStayBlockedDate.objects.filter(
        property=property_obj,
        start_date__lt=check_out,
        end_date__gt=check_in,
    )
    if blocked.exists():
        block = blocked.first()
        return False, f'Dates are admin-blocked ({block.start_date} to {block.end_date}).'
    return True, ''


def calculate_short_stay_quote(property_obj, nights: int, num_guests: int = 1) -> dict:
    from decimal import Decimal, ROUND_HALF_UP

    nightly_rate = property_obj.get_short_stay_nightly_rate()
    discount_percent = Decimal(str(_short_stay_discount_percent(nights)))
    cleaning_fee = property_obj.get_short_stay_cleaning_fee()
    lodging_subtotal = nightly_rate * nights
    discount_amount = (lodging_subtotal * discount_percent / Decimal('100')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    lodging_after_discount = lodging_subtotal - discount_amount

    included_guests = property_obj.get_short_stay_included_guests()
    extra_guests = max(0, num_guests - included_guests)
    extra_guest_fee_per_night = property_obj.get_short_stay_extra_guest_fee_per_night()
    extra_guest_fee = (extra_guest_fee_per_night * extra_guests * nights).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    total = (lodging_after_discount + cleaning_fee + extra_guest_fee).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )
    return {
        'nights': nights,
        'nightly_rate': nightly_rate,
        'lodging_subtotal': lodging_subtotal,
        'discount_percent': discount_percent,
        'discount_amount': discount_amount,
        'cleaning_fee': cleaning_fee,
        'num_guests': num_guests,
        'included_guests': included_guests,
        'extra_guests': extra_guests,
        'extra_guest_fee_per_night': extra_guest_fee_per_night,
        'extra_guest_fee': extra_guest_fee,
        'total_amount': total,
    }


class ShortStayBookingSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)
    property_address = serializers.SerializerMethodField()
    proof_of_payment_files_upload = serializers.ListField(
        child=serializers.FileField(max_length=100000, allow_empty_file=False),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    guest_id_files_upload = serializers.ListField(
        child=serializers.FileField(max_length=100000, allow_empty_file=False),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = ShortStayBooking
        fields = '__all__'
        read_only_fields = (
            'nights', 'nightly_rate', 'discount_percent', 'cleaning_fee', 'total_amount',
            'proof_of_payment_files', 'guest_id_files', 'access_pin', 'created_at', 'updated_at',
        )

    def get_property_address(self, obj):
        p = obj.property
        return f"{p.address}, {p.city}, {p.state}"

    def validate(self, data):
        check_in = data.get('check_in') or getattr(self.instance, 'check_in', None)
        check_out = data.get('check_out') or getattr(self.instance, 'check_out', None)
        property_obj = data.get('property') or getattr(self.instance, 'property', None)
        num_guests = data.get('num_guests') or getattr(self.instance, 'num_guests', 1)

        if check_in and check_out:
            if check_out <= check_in:
                raise serializers.ValidationError({'check_out': 'Check-out must be after check-in.'})
            nights = (check_out - check_in).days
            if nights < 1:
                raise serializers.ValidationError({'check_out': 'Stay must be at least 1 night.'})

        if property_obj and num_guests:
            max_guests = property_obj.get_short_stay_max_guests()
            if num_guests > max_guests:
                raise serializers.ValidationError({
                    'num_guests': f'Maximum {max_guests} guests allowed for this property.'
                })

        if property_obj and check_in and check_out and not self.instance:
            available, reason = check_short_stay_availability(property_obj, check_in, check_out)
            if not available:
                raise serializers.ValidationError(reason)

        return data

    def update(self, instance, validated_data):
        old_status = instance.status
        new_status = validated_data.get('status', instance.status)
        if new_status == 'confirmed' and old_status != 'confirmed':
            available, reason = check_short_stay_availability(
                instance.property, instance.check_in, instance.check_out, exclude_booking_id=instance.id
            )
            if not available:
                raise serializers.ValidationError({'status': reason})

        booking = super().update(instance, validated_data)

        if old_status != 'confirmed' and booking.status == 'confirmed':
            from .guest_portal import generate_short_stay_access_pin
            from .email_service import send_short_stay_confirmation_to_guest

            if not booking.access_pin:
                booking.access_pin = generate_short_stay_access_pin()
                booking.save(update_fields=['access_pin'])
            try:
                send_short_stay_confirmation_to_guest.delay(booking.id)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(
                    f"Queued short-stay confirmation email failed, skipping sync send: {e}"
                )

        return booking

    def create(self, validated_data):
        proof_uploads = validated_data.pop('proof_of_payment_files_upload', [])
        id_uploads = validated_data.pop('guest_id_files_upload', [])
        property_obj = validated_data['property']
        check_in = validated_data['check_in']
        check_out = validated_data['check_out']
        nights = (check_out - check_in).days
        num_guests = validated_data.get('num_guests', 1)
        quote = calculate_short_stay_quote(property_obj, nights, num_guests)

        validated_data['nights'] = nights
        validated_data['nightly_rate'] = quote['nightly_rate']
        validated_data['discount_percent'] = quote['discount_percent']
        validated_data['cleaning_fee'] = quote['cleaning_fee']
        validated_data['total_amount'] = quote['total_amount']

        booking = ShortStayBooking.objects.create(**validated_data)

        def save_one_file(file, prefix):
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"short_stays/booking_{booking.id}/{prefix}_{timestamp}_{file.name}"
            path = default_storage.save(filename, ContentFile(file.read()))
            return {
                'filename': file.name,
                'path': path,
                'size': file.size,
                'uploaded_at': datetime.now().isoformat(),
            }

        proof_file_paths = [save_one_file(f, 'proof') for f in proof_uploads]
        id_file_paths = [save_one_file(f, 'guest_id') for f in id_uploads]
        update_fields = []
        if proof_file_paths:
            booking.proof_of_payment_files = proof_file_paths
            booking.status = 'proof_submitted'
            update_fields.extend(['proof_of_payment_files', 'status'])
        if id_file_paths:
            booking.guest_id_files = id_file_paths
            update_fields.append('guest_id_files')
        if update_fields:
            booking.save(update_fields=update_fields)

        return booking


class ShortStayBlockedDateSerializer(serializers.ModelSerializer):
    property_name = serializers.CharField(source='property.name', read_only=True)

    class Meta:
        model = ShortStayBlockedDate
        fields = '__all__'
        read_only_fields = ('created_at',)

    def validate(self, data):
        start = data.get('start_date') or getattr(self.instance, 'start_date', None)
        end = data.get('end_date') or getattr(self.instance, 'end_date', None)
        if start and end and end <= start:
            raise serializers.ValidationError({'end_date': 'End date must be after start date.'})
        return data
