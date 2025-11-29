"""
User service for creating user accounts from tenant data.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings

User = get_user_model()


def create_user_from_tenant(tenant):
    """
    Create a User account from Tenant data if it doesn't exist.
    
    Args:
        tenant: Tenant instance with application data
        
    Returns:
        tuple: (user, created) - User instance and boolean indicating if user was created
    """
    # Extract name parts from tenant name
    name_parts = tenant.name.split(' ', 1)
    first_name = name_parts[0] if len(name_parts) > 0 else tenant.name
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    # Check if user already exists
    try:
        user = User.objects.get(email=tenant.email)
        
        # Backfill name if missing
        updated = False
        if not user.first_name:
            user.first_name = first_name
            updated = True
        if not user.last_name:
            user.last_name = last_name
            updated = True
            
        if updated:
            user.save()
            
        return user, False
    except User.DoesNotExist:
        pass
    
    # Create user account (without password - user will set it via reset link)
    # Use create() instead of create_user() since we don't have a password yet
    user = User.objects.create(
        email=tenant.email,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        is_verified=False,  # Will be verified when they set password
    )
    
    # Set unusable password - user must set password via reset link
    user.set_unusable_password()
    user.save()
    
    return user, True


def generate_password_reset_token(user):
    """
    Generate a password reset token for a user.
    
    Args:
        user: User instance
        
    Returns:
        tuple: (token, uidb64) - Token string and base64 encoded user ID
    """
    token_generator = PasswordResetTokenGenerator()
    token = token_generator.make_token(user)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    
    return token, uidb64


def get_password_reset_url(uidb64, token, base_url=None):

    if base_url is None:
        # Try to get from settings or use a default
        base_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
    
    # Remove trailing slash if present
    base_url = base_url.rstrip('/')
    
    # Construct the reset URL
    reset_url = f"{base_url}/reset-password/{uidb64}/{token}"
    
    return reset_url

