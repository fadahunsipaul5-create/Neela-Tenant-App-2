from rest_framework import serializers
from .models import Tenant, Payment, MaintenanceRequest, LegalDocument, Listing, Property, LeaseTemplate
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
    
    class Meta:
        model = Property
        fields = '__all__'
        read_only_fields = ('display_image',)
    
    def get_display_image(self, obj):
        """Returns the full URL for the image (uploaded file or external URL)"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url
    
    def validate(self, data):
        """Ensure either image file or image_url is provided, not both"""
        image = data.get('image')
        image_url = data.get('image_url')
        
        # If both are being set, prioritize the uploaded file
        if image and image_url:
            data['image_url'] = None  # Clear URL when file is uploaded
        
        return data
