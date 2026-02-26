"""
Dropbox Sign integration for electronic lease signing.
Uses API key authentication.
"""

import logging
import requests
import os
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.hellosign.com/v3"


def get_dropbox_sign_config() -> Dict[str, Any]:
    """Get Dropbox Sign config from Django settings."""
    config = {
        'api_key': (getattr(settings, 'DROPBOX_SIGN_API_KEY', '') or os.environ.get('DROPBOX_SIGN_API_KEY', '')).strip(),
    }
    return config


def get_dropbox_sign_config_status() -> Dict[str, Any]:
    """Config status for Dropbox Sign."""
    config = get_dropbox_sign_config()
    status = {
        'configured': bool(config.get('api_key')),
        'missing_keys': [] if config.get('api_key') else ['DROPBOX_SIGN_API_KEY'],
        'present_keys': ['DROPBOX_SIGN_API_KEY'] if config.get('api_key') else [],
    }
    return status


def is_dropbox_sign_configured() -> bool:
    """Check if Dropbox Sign API key is set."""
    return bool(get_dropbox_sign_config().get('api_key'))


def _headers() -> Dict[str, str]:
    """Authorization header for Dropbox Sign API."""
    api_key = get_dropbox_sign_config().get('api_key')
    if not api_key:
        return {}
    return {"Authorization": f"Bearer {api_key}"}


def create_signature_request(
    tenant_email: str,
    tenant_name: str,
    pdf_content: bytes,
    document_name: str = "Lease Agreement",
    landlord_email: str = None,
    landlord_name: str = None,
) -> Optional[Dict[str, Any]]:
    """
    Create a Dropbox Sign signature request (tenant signs first, then landlord).
    Returns dict with signature_request_id and signing_url (tenant's link).
    """
    if not is_dropbox_sign_configured():
        logger.warning("Dropbox Sign not configured")
        return None

    landlord_email = landlord_email or getattr(settings, 'LANDLORD_EMAIL', None) or 'admin@example.com'
    landlord_name = (landlord_name or getattr(settings, 'LANDLORD_NAME', None) or 'Landlord').strip()

    url = f"{API_BASE}/signature_request/send"
    headers = _headers()

    files = {
        "file": (f"{document_name}.pdf", pdf_content, "application/pdf"),
    }
    data = {
        "title": document_name,
        "subject": "Please sign your lease agreement",
        "message": "Please sign the attached lease agreement. Thank you.",
        "signers[0][email_address]": tenant_email,
        "signers[0][name]": tenant_name,
        "signers[1][email_address]": landlord_email,
        "signers[1][name]": landlord_name,
    }

    try:
        resp = requests.post(url, headers=headers, data=data, files=files, timeout=60)
        if resp.status_code not in (200, 201):
            logger.error(f"Dropbox Sign send failed: {resp.status_code} - {resp.text}")
            return None

        body = resp.json()
        sr = body.get("signature_request", {})
        signature_request_id = sr.get("signature_request_id")
        signatures = sr.get("signatures", [])
        signing_url = None
        for sig in signatures:
            if sig.get("signer_email_address", "").lower() == tenant_email.lower():
                signing_url = sig.get("signing_url")
                break
        if not signing_url and signatures:
            signing_url = signatures[0].get("signing_url")

        logger.info(f"Dropbox Sign signature request created: {signature_request_id}")
        return {
            "signature_request_id": signature_request_id,
            "signing_url": signing_url,
        }
    except Exception as e:
        logger.error(f"Error creating Dropbox Sign signature request: {e}", exc_info=True)
        return None


def get_signature_request_status(signature_request_id: str) -> Optional[Dict[str, Any]]:
    """Get status of a signature request."""
    if not is_dropbox_sign_configured():
        return None
    url = f"{API_BASE}/signature_request/{signature_request_id}"
    try:
        resp = requests.get(url, headers=_headers(), timeout=30)
        if resp.status_code != 200:
            logger.warning(f"Dropbox Sign status failed: {resp.status_code}")
            return None
        return resp.json().get("signature_request", {})
    except Exception as e:
        logger.error(f"Error getting Dropbox Sign status: {e}", exc_info=True)
        return None


def download_signed_document(signature_request_id: str) -> Optional[bytes]:
    """Download the combined signed PDF."""
    if not is_dropbox_sign_configured():
        return None
    url = f"{API_BASE}/signature_request/files/{signature_request_id}"
    try:
        resp = requests.get(
            url,
            headers=_headers(),
            params={"response_type": "pdf"},
            timeout=60,
        )
        if resp.status_code != 200:
            logger.warning(f"Dropbox Sign download failed: {resp.status_code}")
            return None
        return resp.content
    except Exception as e:
        logger.error(f"Error downloading from Dropbox Sign: {e}", exc_info=True)
        return None
