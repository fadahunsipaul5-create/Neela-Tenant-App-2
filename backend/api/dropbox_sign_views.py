"""
Dropbox Sign webhook callback for signature request events.
"""

import json
import logging
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["GET", "POST"])
def dropbox_sign_callback(request):
    """
    Handle Dropbox Sign account callback (webhooks).
    GET: used by Dropbox Sign to verify callback URL (returns challenge).
    POST: event notifications (signature_request_signed, etc.).
    """
    if request.method == "GET":
        challenge = request.GET.get("challenge", "")
        return HttpResponse(challenge, content_type="text/plain")

    try:
        body = json.loads(request.body) if request.body else {}
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event = body.get("event", {})
    event_type = event.get("event_type")
    event_time = event.get("event_time")

    logger.info(f"Dropbox Sign callback: event_type={event_type}, event_time={event_time}")

    if event_type == "signature_request_signed":
        try:
            from .models import LegalDocument
            from .lease_service import process_dropbox_sign_status_update
            meta = event.get("event_metadata", {}) or {}
            sr_id = meta.get("reported_id") or (body.get("signature_request", {}) or {}).get("signature_request_id")
            if sr_id:
                doc = LegalDocument.objects.filter(
                    dropbox_sign_signature_request_id=sr_id
                ).first()
                if doc:
                    process_dropbox_sign_status_update(doc)
        except Exception as e:
            logger.warning(f"Dropbox Sign callback processing: {e}")

    return JsonResponse({"success": True})
