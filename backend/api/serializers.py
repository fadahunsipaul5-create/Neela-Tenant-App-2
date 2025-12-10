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
        }
    
    def create(self, validated_data):
        # Extract file uploads
        photo_id_uploads = validated_data.pop('photo_id_files_upload', [])
        income_verification_uploads = validated_data.pop('income_verification_files_upload', [])
        background_check_uploads = validated_data.pop('background_check_files_upload', [])
        
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
        
        # Update tenant with file paths
        tenant.photo_id_files = photo_id_file_paths
        tenant.income_verification_files = income_verification_file_paths
        tenant.background_check_files = background_check_file_paths
        tenant.save()
        
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
    class Meta:
        model = Payment
        fields = '__all__'

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
        """Returns the full URL for the PDF file"""
        if obj.pdf_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None

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
