"""
DocuSign integration service for electronic lease signing.
Uses JWT authentication for server-to-server integration.
"""

import logging
import requests
import base64
import os
import time
import json
from typing import Optional, Dict, Any
from urllib.parse import quote
from django.conf import settings

logger = logging.getLogger(__name__)

# DocuSign SDK imports
try:
    from docusign_esign import ApiClient, EnvelopesApi, EnvelopeDefinition, Signer, SignHere, Tabs, Document, Recipients, RecipientViewRequest
    DOCUSIGN_SDK_AVAILABLE = True
except ImportError:
    DOCUSIGN_SDK_AVAILABLE = False
    logger.warning("docusign-esign SDK not available. Install with: pip install docusign-esign")

# Token cache to avoid repeated authentication
_docusign_token_cache = {
    'access_token': None,
    'expires_at': None,
    'account_id': None,
    'base_path': None
}


def clear_docusign_token_cache():
    """Clear the DocuSign token cache to force re-authentication."""
    global _docusign_token_cache
    _docusign_token_cache = {
        'access_token': None,
        'expires_at': None,
        'account_id': None,
        'base_path': None
    }
    logger.info("DocuSign token cache cleared")


def get_docusign_config() -> Dict[str, Any]:
    """
    Get DocuSign configuration from Django settings.
    Strips whitespace from all values to handle accidental spaces.
    Ensures base_path ends with /restapi.
    
    Returns:
        Dictionary with DocuSign configuration (API keys, account ID, etc.)
    """
    config = {
        'api_client_id': getattr(settings, 'DOCUSIGN_API_CLIENT_ID', ''),
        'api_secret': getattr(settings, 'DOCUSIGN_API_SECRET', ''),
        'account_id': getattr(settings, 'DOCUSIGN_ACCOUNT_ID', ''),
        'base_path': getattr(settings, 'DOCUSIGN_BASE_PATH', 'https://demo.docusign.net/restapi'),
        'user_id': getattr(settings, 'DOCUSIGN_USER_ID', ''),
        'private_key_file': getattr(settings, 'DOCUSIGN_PRIVATE_KEY_FILE', ''),
    }
    # Strip whitespace from all string values
    for key, value in config.items():
        if isinstance(value, str):
            config[key] = value.strip()
            
    # Ensure base_path ends with /restapi for standard DocuSign URLs
    if config['base_path'] and 'docusign.net' in config['base_path'] and not config['base_path'].endswith('/restapi'):
        config['base_path'] = config['base_path'].rstrip('/') + '/restapi'
        
    return config


def get_docusign_config_status() -> Dict[str, Any]:
    """
    Get detailed status of DocuSign configuration.
    
    Returns:
        Dictionary with configuration status including which keys are missing
    """
    config = get_docusign_config()
    required_keys = ['api_client_id', 'account_id']
    
    status = {
        'configured': True,
        'missing_keys': [],
        'present_keys': [],
        'config_details': {}
    }
    
    for key in required_keys:
        value = config.get(key, '')
        is_present = bool(value)
        status['config_details'][key] = {
            'present': is_present,
            'length': len(value) if value else 0,
            'masked_value': value[:4] + '***' if value and len(value) > 4 else '***' if value else ''
        }
        
        if is_present:
            status['present_keys'].append(key)
        else:
            status['missing_keys'].append(key)
            status['configured'] = False
    
    return status


def is_docusign_configured() -> bool:
    """
    Check if DocuSign is properly configured for JWT authentication.
    
    Returns:
        True if DocuSign credentials are configured, False otherwise
    """
    if not DOCUSIGN_SDK_AVAILABLE:
        logger.warning("DocuSign SDK not available. Please install docusign-esign.")
        return False
    
    config = get_docusign_config()
    private_key_file = config.get('private_key_file', '')
    
    # Check if private_key_file is a valid file path or contains key content
    private_key_valid = bool(
        private_key_file and (
            os.path.exists(private_key_file) or 
            private_key_file.strip().startswith('-----BEGIN')
        )
    )
    
    # For JWT authentication, we need: api_client_id, account_id, user_id, and private_key_file
    is_configured = bool(
        config.get('api_client_id') and
        config.get('account_id') and
        config.get('user_id') and
        private_key_valid
    )
    
    # Log configuration status for debugging
    if not is_configured:
        missing = []
        if not config.get('api_client_id'):
            missing.append('DOCUSIGN_API_CLIENT_ID')
        if not config.get('account_id'):
            missing.append('DOCUSIGN_ACCOUNT_ID')
        if not config.get('user_id'):
            missing.append('DOCUSIGN_USER_ID')
        if not private_key_file:
            missing.append('DOCUSIGN_PRIVATE_KEY_FILE')
        elif not private_key_valid:
            missing.append('DOCUSIGN_PRIVATE_KEY_FILE (must be a file path or key content starting with -----BEGIN)')
        
        logger.debug(
            f"DocuSign not configured. Missing: {', '.join(missing)}. "
            f"DocuSign requires JWT authentication with a private key for server-to-server integration."
        )
    else:
        logger.debug("DocuSign configuration verified successfully")
    
    return is_configured


def get_docusign_api_client() -> Optional[ApiClient]:
    """
    Get authenticated DocuSign API client using JWT authentication.
    
    Returns:
        Authenticated ApiClient instance or None if authentication fails
    """
    if not is_docusign_configured():
        return None
    
    if not DOCUSIGN_SDK_AVAILABLE:
        logger.error("DocuSign SDK not available")
        return None
    
    try:
        config = get_docusign_config()
        api_client = ApiClient()
        api_client.set_base_path(config['base_path'])
        
        # Check if we have a cached valid token
        # CACHE DISABLED FOR DEBUGGING - ensure fresh token every time
        # if (_docusign_token_cache['access_token'] and 
        #     _docusign_token_cache['expires_at'] and 
        #     time.time() < _docusign_token_cache['expires_at']):
        #     # Set authorization header directly
        #     api_client.set_default_header('Authorization', f"Bearer {_docusign_token_cache['access_token']}")
            
        #     # Use cached base path if available, otherwise fallback to config
        #     cached_base_path = _docusign_token_cache.get('base_path')
        #     if cached_base_path:
        #         api_client.set_base_path(cached_base_path)
        #         logger.debug(f"Using cached base path: {cached_base_path}")
            
        #     logger.debug("Using cached DocuSign access token")
        #     return api_client
        
        # DocuSign requires JWT authentication for server-to-server integration
        private_key_file = config.get('private_key_file', '')
        if not private_key_file:
            logger.error(
                "DocuSign JWT authentication requires a private key. "
                "Please set DOCUSIGN_PRIVATE_KEY_FILE in your .env file (either as a file path or the key content itself)."
            )
            return None
        
        # Determine OAuth host based on base path
        oauth_host = 'account.docusign.com' if 'demo' not in config['base_path'] else 'account-d.docusign.com'
        
        # JWT authentication
        api_client.set_oauth_host_name(oauth_host)
        
        # Check if private_key_file is a file path or the key content itself
        if os.path.exists(private_key_file):
            # It's a file path - read the file
            with open(private_key_file, 'r') as key_file:
                private_key = key_file.read()
        elif private_key_file.strip().startswith('-----BEGIN'):
            # It's the key content itself - handle newlines that might be escaped
            private_key = private_key_file
        else:
            logger.error(
                f"DOCUSIGN_PRIVATE_KEY_FILE is neither a valid file path nor valid key content. "
                f"Please provide either a file path or the RSA private key content starting with '-----BEGIN RSA PRIVATE KEY-----'"
            )
            return None
        
        # Clean and normalize the private key
        # Handle escaped newlines (common when key is in .env file)
        private_key = private_key.replace('\\n', '\n')
        while '\\n' in private_key:
            private_key = private_key.replace('\\n', '\n')
        
        private_key = private_key.strip()
        
        # Validate the key format
        if not private_key.startswith('-----BEGIN'):
            logger.error("Private key does not start with '-----BEGIN'. Please check the key format.")
            return None
        
        # Validate user_id is set (required for JWT)
        user_id = config.get('user_id')
        if not user_id:
            logger.error(
                "DOCUSIGN_USER_ID is required for JWT authentication. "
                "This should be the GUID of the user being impersonated."
            )
            return None
        
        # Get access token using JWT
        logger.info(f"Authenticating with DocuSign using JWT (User ID: {user_id})")
        
        try:
            # Request JWT with required scopes
            # Standard scopes for JWT
            # Reverted to standard scopes as 'extended' might be causing permission issues
            jwt_token = api_client.request_jwt_user_token(
                client_id=config['api_client_id'],
                user_id=user_id,
                oauth_host_name=oauth_host,
                private_key_bytes=private_key.encode('utf-8'),
                expires_in=3600,
                scopes=["signature", "impersonation"]
            )
            
            access_token = jwt_token.access_token
            if access_token:
                access_token = str(access_token).strip()
            
            expires_in = jwt_token.expires_in
            
            # Ensure expires_in is a number
            if isinstance(expires_in, str):
                expires_in = int(expires_in)
            elif not isinstance(expires_in, (int, float)):
                expires_in = 3600  # Default to 1 hour if invalid
            
            # Test the token and resolve account info
            try:
                logger.info("Testing generated token with user_info call...")
                # We must set the header on the client for get_user_info to work
                api_client.set_default_header('Authorization', f"Bearer {access_token}")
                
                # Also set configuration-level auth which some SDK parts use
                if hasattr(api_client, 'configuration') and api_client.configuration:
                    api_client.configuration.access_token = access_token
                    api_client.configuration.api_key = {"Authorization": access_token}
                    api_client.configuration.api_key_prefix = {"Authorization": "Bearer"}
                
                test_user_info = api_client.get_user_info(access_token)
                logger.info(f"Token valid! User info retrieved for: {test_user_info.name}")
                
                # Resolve the account
                if hasattr(test_user_info, 'accounts') and test_user_info.accounts:
                    target_account_id = config.get('account_id')
                    matched_account = None
                    
                    for acc in test_user_info.accounts:
                        if acc.account_id == target_account_id:
                            matched_account = acc
                            break
                    
                    if not matched_account:
                        # Fallback to default
                        for acc in test_user_info.accounts:
                            if acc.is_default == "true":
                                matched_account = acc
                                break
                        if not matched_account and test_user_info.accounts:
                            matched_account = test_user_info.accounts[0]
                        
                    if matched_account:
                        _docusign_token_cache['account_id'] = matched_account.account_id
                        base_uri = matched_account.base_uri
                        
                        # Ensure it ends with /restapi
                        if not base_uri.endswith('/restapi'):
                            base_uri = base_uri.rstrip('/') + '/restapi'
                        
                        # Force v2.1 suffix - required for proper envelope creation routing
                        if not base_uri.endswith('/v2.1'):
                             base_uri = base_uri + '/v2.1'
                             
                        _docusign_token_cache['base_path'] = base_uri
                        logger.info(f"Authoritative Account ID: {_docusign_token_cache['account_id']}")
                        logger.info(f"Authoritative Base Path: {_docusign_token_cache['base_path']}")
                        
                        # Update the client's base path
                        api_client.set_base_path(base_uri)
                        if hasattr(api_client, 'configuration') and api_client.configuration:
                            api_client.configuration.host = base_uri
                        
                        # RE-ASSERT HEADERS: Changing base path might reset internal state
                        api_client.set_default_header('Authorization', f"Bearer {access_token}")
                    else:
                         # Ensure fallback logic if matched_account is None
                         logger.warning("No matching account found. Using defaults.")
                         api_client.set_default_header('Authorization', f"Bearer {access_token}")
            
            except Exception as token_test_error:
                logger.error(f"IMMEDIATE TOKEN FAILURE: {token_test_error}")
                return None

            # Cache the token
            _docusign_token_cache['access_token'] = access_token
            _docusign_token_cache['expires_at'] = time.time() + expires_in - 60
            
            # Ensure Authorization header is set for future calls
            api_client.set_default_header('Authorization', f"Bearer {access_token}")
            
            logger.info("Successfully authenticated with DocuSign using JWT")
            return api_client
            
        except Exception as jwt_auth_error:
            error_msg = str(jwt_auth_error)
            logger.error(f"JWT authentication error: {error_msg}")
            
            if 'consent_required' in error_msg.lower() or 'consent' in error_msg.lower():
                oauth_host = 'account.docusign.com' if 'demo' not in config['base_path'] else 'account-d.docusign.com'
                redirect_uri = getattr(settings, 'DOCUSIGN_REDIRECT_URI', 'https://www.docusign.com')
                redirect_uri_encoded = quote(redirect_uri, safe='')
                consent_url = f"https://{oauth_host}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={config['api_client_id']}&redirect_uri={redirect_uri_encoded}"
                
                logger.error(
                    f"Consent is required. Visit: {consent_url}\n"
                    f"Sign in as User ID: {user_id}"
                )
            raise
        
    except Exception as e:
        logger.error(f"Error creating DocuSign API client: {e}", exc_info=True)
        return None


def create_envelope(legal_document_id: int, tenant_email: str, tenant_name: str, landlord_email: str = None, landlord_name: str = None, pdf_url: str = None, pdf_content: bytes = None) -> Optional[Dict[str, Any]]:
    """
    Create a DocuSign envelope for a lease document.
    Supports dual signing (Tenant and Landlord) and auto-placement of tabs.
    """
    if not is_docusign_configured():
        return None
    
    if not DOCUSIGN_SDK_AVAILABLE:
        return None
    
    try:
        config = get_docusign_config()
        api_client = get_docusign_api_client()
        
        if not api_client:
            logger.error("Failed to authenticate with DocuSign")
            return None
        
        # Default landlord if not provided
        if not landlord_email:
            landlord_email = getattr(settings, 'LANDLORD_EMAIL', 'admin@example.com')
        if not landlord_name:
            landlord_name = getattr(settings, 'LANDLORD_NAME', 'Rosa Martinez')

        pdf_base64 = None
        
        if pdf_content:
            logger.info("Using provided PDF content directly")
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
        elif pdf_url:
            # Download PDF from URL
            logger.info(f"Downloading PDF from {pdf_url}")
            pdf_response = requests.get(pdf_url, timeout=30)
            if pdf_response.status_code != 200:
                logger.error(f"Failed to download PDF: {pdf_response.status_code}")
                return None
            pdf_bytes = pdf_response.content
            pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
        else:
            logger.error("No PDF content or URL provided")
            return None
        
        # Log document encoding status
        logger.debug(f"Document base64 length: {len(pdf_base64)}")
        
        # Create document object (referenced in envelope)
        document_data = {
            "documentBase64": pdf_base64,
            "name": f"Lease Agreement - {tenant_name}",
            "fileExtension": "pdf",
            "documentId": "1"
        }
        
        # --- RECIPIENT 1: TENANT ---
        # Tenant signs first (routing order 1)
        # Tabs: Signature, Date, Text Fields (___), Checkboxes ([ ])
        tenant_recipient = {
            "email": tenant_email,
            "name": tenant_name,
            "recipientId": "1",
            "routingOrder": "1",
            # "clientUserId": f"tenant_{legal_document_id}", # Keep commented out for remote (email) signing
            "tabs": {
                "signHereTabs": [{
                    "anchorString": "Tenant's Signature:",
                    "anchorYOffset": "-20", # Move up slightly to sit on line
                    "anchorXOffset": "140", # Move right to be after the label
                    "anchorUnits": "pixels",
                    "documentId": "1",
                    "pageNumber": "1", # Optional with anchor
                }],
                "dateSignedTabs": [{
                    "anchorString": "Tenant's Signature:",
                    "anchorYOffset": "20", # Below signature
                    "anchorXOffset": "140",
                    "anchorUnits": "pixels",
                    "documentId": "1"
                }],
                # Auto-place text fields for missing info (___)
                "textTabs": [
                    # Bedrooms
                    { "anchorString": "[_Beds_]", "anchorYOffset": "-2", "width": "40", "required": "false", "documentId": "1", "tabLabel": "Bedrooms" },
                    # Bathrooms
                    { "anchorString": "[_Baths_]", "anchorYOffset": "-2", "width": "40", "required": "false", "documentId": "1", "tabLabel": "Bathrooms" },
                    # DOB
                    { "anchorString": "[_DOB_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "DOB" },
                    # Driver License
                    { "anchorString": "[_DL_]", "anchorYOffset": "-2", "width": "100", "required": "false", "documentId": "1", "tabLabel": "DriverLicense" },
                    # DL State
                    { "anchorString": "[_DLState_]", "anchorYOffset": "-2", "width": "40", "required": "false", "documentId": "1", "tabLabel": "DLState" },
                    # SSN
                    { "anchorString": "[_SSN_]", "anchorYOffset": "-2", "width": "100", "required": "false", "documentId": "1", "tabLabel": "SSN" },
                    # Marital Status
                    { "anchorString": "[_Marital_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "MaritalStatus" },
                    # Citizenship
                    { "anchorString": "[_Citizen_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "Citizenship" },
                    # Height
                    { "anchorString": "[_Height_]", "anchorYOffset": "-2", "width": "60", "required": "false", "documentId": "1", "tabLabel": "Height" },
                    # Weight
                    { "anchorString": "[_Weight_]", "anchorYOffset": "-2", "width": "60", "required": "false", "documentId": "1", "tabLabel": "Weight" },
                    # Hair
                    { "anchorString": "[_Hair_]", "anchorYOffset": "-2", "width": "60", "required": "false", "documentId": "1", "tabLabel": "HairColor" },
                    # Eye
                    { "anchorString": "[_Eye_]", "anchorYOffset": "-2", "width": "60", "required": "false", "documentId": "1", "tabLabel": "EyeColor" },
                    # Emergency Contact
                    { "anchorString": "[_EmergName_]", "anchorYOffset": "-2", "width": "150", "required": "false", "documentId": "1", "tabLabel": "EmergName" },
                    { "anchorString": "[_EmergPhone_]", "anchorYOffset": "-2", "width": "100", "required": "false", "documentId": "1", "tabLabel": "EmergPhone" },
                    { "anchorString": "[_EmergAddr_]", "anchorYOffset": "-2", "width": "200", "required": "false", "documentId": "1", "tabLabel": "EmergAddr" },
                    { "anchorString": "[_EmergEmail_]", "anchorYOffset": "-2", "width": "150", "required": "false", "documentId": "1", "tabLabel": "EmergEmail" },
                    # Employment
                    { "anchorString": "[_SupName_]", "anchorYOffset": "-2", "width": "150", "required": "false", "documentId": "1", "tabLabel": "SupName" },
                    { "anchorString": "[_SupPhone_]", "anchorYOffset": "-2", "width": "100", "required": "false", "documentId": "1", "tabLabel": "SupPhone" },
                    { "anchorString": "[_EmpStart_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "EmpStart" },
                    { "anchorString": "[_EmpDur_]", "anchorYOffset": "-2", "width": "60", "required": "false", "documentId": "1", "tabLabel": "EmpDur" },
                    { "anchorString": "[_Employer_]", "anchorYOffset": "-2", "width": "150", "required": "false", "documentId": "1", "tabLabel": "Employer" },
                    { "anchorString": "[_JobTitle_]", "anchorYOffset": "-2", "width": "100", "required": "false", "documentId": "1", "tabLabel": "JobTitle" },
                    { "anchorString": "[_Income_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "Income" },
                    # Previous Rental
                    { "anchorString": "[_PrevAddr_]", "anchorYOffset": "-2", "width": "200", "required": "false", "documentId": "1", "tabLabel": "PrevAddr" },
                    { "anchorString": "[_PrevLandlord_]", "anchorYOffset": "-2", "width": "150", "required": "false", "documentId": "1", "tabLabel": "PrevLandlord" },
                    { "anchorString": "[_PrevRent_]", "anchorYOffset": "-2", "width": "80", "required": "false", "documentId": "1", "tabLabel": "PrevRent" },
                    { "anchorString": "[_LeaveReason_]", "anchorYOffset": "-2", "width": "200", "required": "false", "documentId": "1", "tabLabel": "LeaveReason" },
                ],
                # Auto-place checkboxes for [ ]
                "checkboxTabs": [
                    { "anchorString": "[_PetY_]", "anchorYOffset": "0", "documentId": "1", "tabLabel": "HasPets" },
                    { "anchorString": "[_PetN_]", "anchorYOffset": "0", "documentId": "1", "tabLabel": "NoPets" },
                    # Generic fallback just in case
                    { "anchorString": "[ ]", "anchorYOffset": "0", "documentId": "1", "tabLabel": "GenericCheckbox" }
                ]
            }
        }

        # --- RECIPIENT 2: LANDLORD ---
        # Landlord signs second (routing order 2)
        landlord_recipient = {
            "email": landlord_email,
            "name": landlord_name,
            "recipientId": "2",
            "routingOrder": "2",
            "tabs": {
                "signHereTabs": [{
                    "anchorString": "Landlord's Signature:",
                    "anchorYOffset": "-20",
                    "anchorXOffset": "140",
                    "anchorUnits": "pixels",
                    "documentId": "1"
                }],
                "dateSignedTabs": [{
                    "anchorString": "Landlord's Signature:",
                    "anchorYOffset": "20",
                    "anchorXOffset": "140",
                    "anchorUnits": "pixels",
                    "documentId": "1"
                }]
            }
        }

        # RAW REQUEST ATTEMPT TO BYPASS SDK ISSUES
        import json as json_lib
        
        base_path = _docusign_token_cache.get('base_path') or config['base_path']
        resolved_account_id = _docusign_token_cache.get('account_id') or config['account_id']
        access_token = _docusign_token_cache.get('access_token')
        
        # Ensure base_path is correct for raw requests
        if '/v2.1' not in base_path:
             base_path = base_path + '/v2.1'
             
        url = f"{base_path}/accounts/{resolved_account_id}/envelopes"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Construct the JSON body manually
        envelope_json = {
            "emailSubject": "Please sign your lease agreement",
            "status": "sent",
            "documents": [document_data],
            "recipients": {
                "signers": [tenant_recipient, landlord_recipient]
            }
        }
        
        logger.info(f"Attempting raw REST API call to: {url}")
        
        response = requests.post(url, headers=headers, json=envelope_json)
        
        if response.status_code not in [200, 201]:
            logger.error(f"Raw API Call Failed: {response.status_code} - {response.text}")
            raise Exception(f"DocuSign API Error: {response.status_code} {response.text}")
            
        response_data = response.json()
        envelope_id = response_data.get('envelopeId')
        
        # Mocking the SDK response object structure expected by the rest of the code
        # envelope_summary = envelopes_api.create_envelope(...) 
        
        logger.info(f"DocuSign envelope created successfully (RAW): {envelope_id}")
        
        # Get signing URL
        # For remote signing (email), we don't generate a signing URL.
        # The tenant will receive an email from DocuSign.
        signing_url = None
        
        # Only generate signing URL if we are doing embedded signing (clientUserId is set)
        # signing_url = get_signing_url(envelope_id, tenant_email, tenant_name)
        
        return {
            'envelope_id': envelope_id,
            'signing_url': signing_url
        }
        
    except Exception as e:
        logger.error(f"Error creating DocuSign envelope: {e}", exc_info=True)
        return None


def get_signing_url(envelope_id: str, recipient_email: str, recipient_name: str = None) -> Optional[str]:
    """
    Get the signing URL for a DocuSign envelope.
    """
    if not is_docusign_configured():
        return None
    
    if not DOCUSIGN_SDK_AVAILABLE:
        return None
    
    try:
        config = get_docusign_config()
        # Note: We call get_docusign_api_client again, which might hit cache or re-auth
        # This is fine as it ensures valid token
        api_client = get_docusign_api_client()
        
        if not api_client:
            return None
        
        # Get frontend URL for return after signing
        frontend_url = getattr(settings, 'FRONTEND_URL', 'https://neela-tenant.vercel.app')
        return_url = f"{frontend_url.rstrip('/')}/lease-signed"
        
        # Create recipient view request
        recipient_view_request = RecipientViewRequest(
            authentication_method='email',
            email=recipient_email,
            user_name=recipient_name or recipient_email,
            return_url=return_url
        )
        
        # Get signing URL
        envelopes_api = EnvelopesApi(api_client)
        
        # Ensure we use the resolved account ID
        resolved_account_id = _docusign_token_cache.get('account_id') or config['account_id']
        
        logger.info(f"Getting signing URL for envelope {envelope_id}")
        view_url = envelopes_api.create_recipient_view(
            account_id=resolved_account_id,
            envelope_id=envelope_id,
            recipient_view_request=recipient_view_request
        )
        
        signing_url = view_url.url
        logger.info(f"Signing URL generated successfully for envelope {envelope_id}")
        return signing_url
        
    except Exception as e:
        logger.error(f"Error getting DocuSign signing URL: {e}", exc_info=True)
        return None


def get_envelope_status(envelope_id: str) -> Optional[Dict[str, Any]]:
    """
    Get the status of a DocuSign envelope.
    """
    if not is_docusign_configured():
        return None
    
    if not DOCUSIGN_SDK_AVAILABLE:
        return None
    
    try:
        # Ensure auth and get fresh token
        api_client = get_docusign_api_client()
        
        if not api_client:
            return None
        
        # Use raw request for reliability
        base_path = _docusign_token_cache.get('base_path') or get_docusign_config()['base_path']
        resolved_account_id = _docusign_token_cache.get('account_id') or get_docusign_config()['account_id']
        access_token = _docusign_token_cache.get('access_token')
        
        if not access_token:
            logger.error("No access token available for status check")
            return None
            
        # Ensure base_path has version
        if '/v2.1' not in base_path:
             base_path = base_path + '/v2.1'
             
        url = f"{base_path}/accounts/{resolved_account_id}/envelopes/{envelope_id}"
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        logger.debug(f"Getting status for envelope {envelope_id} via RAW request")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Error getting envelope status: {response.status_code} - {response.text}")
            return None
            
        envelope = response.json()
        
        return {
            'status': envelope.get('status'),
            'completed_date_time': envelope.get('completedDateTime'),
            'sent_date_time': envelope.get('sentDateTime'),
        }
        
    except Exception as e:
        logger.error(f"Error getting DocuSign envelope status: {e}", exc_info=True)
        return None


def download_signed_document(envelope_id: str) -> Optional[bytes]:
    """
    Download the signed document from DocuSign.
    """
    if not is_docusign_configured():
        return None
    
    if not DOCUSIGN_SDK_AVAILABLE:
        return None
    
    try:
        # Ensure auth
        api_client = get_docusign_api_client()
        
        if not api_client:
            return None
        
        # Use raw request for reliability
        base_path = _docusign_token_cache.get('base_path') or get_docusign_config()['base_path']
        resolved_account_id = _docusign_token_cache.get('account_id') or get_docusign_config()['account_id']
        access_token = _docusign_token_cache.get('access_token')
        
        if not access_token:
            return None

        if '/v2.1' not in base_path:
             base_path = base_path + '/v2.1'
             
        # 'combined' gets all documents merged
        url = f"{base_path}/accounts/{resolved_account_id}/envelopes/{envelope_id}/documents/combined"
        
        headers = {
            "Authorization": f"Bearer {access_token}"
        }
        
        logger.info(f"Downloading signed document for envelope {envelope_id} via RAW request")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            logger.error(f"Error downloading DocuSign signed document: {response.status_code} - {response.text}")
            return None
            
        return response.content
        
    except Exception as e:
        logger.error(f"Error downloading DocuSign signed document: {e}", exc_info=True)
        return None
