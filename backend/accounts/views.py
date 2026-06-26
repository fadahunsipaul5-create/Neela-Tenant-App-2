"""
Authentication views for the accounts app.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_reset_token(request):
    """
    Verify if a password reset token is valid.
    
    POST /accounts/verify-reset-token/
    Body: {
        "uidb64": "...",
        "token": "..."
    }
    """
    uidb64 = request.data.get('uidb64')
    token = request.data.get('token')
    
    if not uidb64 or not token:
        return Response(
            {'error': 'uidb64 and token are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {'error': 'Invalid token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    token_generator = PasswordResetTokenGenerator()
    if not token_generator.check_token(user, token):
        return Response(
            {'error': 'Invalid or expired token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    return Response(
        {'valid': True, 'email': user.email},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):

    uidb64 = request.data.get('uidb64')
    token = request.data.get('token')
    new_password = request.data.get('new_password')
    
    if not all([uidb64, token, new_password]):
        return Response(
            {'error': 'uidb64, token, and new_password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return Response(
            {'error': 'Invalid token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    token_generator = PasswordResetTokenGenerator()
    if not token_generator.check_token(user, token):
        return Response(
            {'error': 'Invalid or expired token'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate password
    try:
        validate_password(new_password, user)
    except ValidationError as e:
        return Response(
            {'error': 'Password validation failed', 'details': list(e.messages)},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set password and mark as verified
    user.set_password(new_password)
    user.is_verified = True
    user.save()
    
    # Generate JWT tokens for automatic login
    tokens = user.token()
    
    # Get user data
    user_data = {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_verified': user.is_verified,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'role': getattr(user, 'role', 'tenant'),
    }
    
    # Try to find linked tenant by email
    tenant_data = None
    try:
        from api.models import Tenant
        tenant = Tenant.objects.filter(email=user.email).first()
        if tenant:
            from api.serializers import TenantSerializer
            tenant_data = TenantSerializer(tenant).data
    except Exception as e:
        # If tenant doesn't exist or any error, tenant_data remains None
        pass
    
    return Response(
        {
            'message': 'Password reset successfully',
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': user_data,
            'tenant': tenant_data,
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    
    if not email or not password:
        return Response(
            {'error': 'Email and password are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Authenticate user
    user = authenticate(request, username=email, password=password)
    
    if not user:
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Check if user is verified (allow staff/superusers to bypass)
    if not user.is_verified and not (user.is_staff or user.is_superuser):
        return Response(
            {'error': 'Please verify your account by setting up your password first'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    
    # Generate JWT tokens
    tokens = user.token()
    
    # Get user data
    user_data = {
        'id': user.id,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_verified': user.is_verified,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
        'role': getattr(user, 'role', 'tenant'),
    }
    
    # Try to find linked tenant by email
    tenant_data = None
    try:
        from api.models import Tenant
        tenant = Tenant.objects.filter(email=user.email).first()
        if tenant:
            from api.serializers import TenantSerializer
            tenant_data = TenantSerializer(tenant).data
    except Exception as e:
        # If tenant doesn't exist or any error, tenant_data remains None
        pass
    
    return Response(
        {
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': user_data,
            'tenant': tenant_data,
        },
        status=status.HTTP_200_OK
    )
