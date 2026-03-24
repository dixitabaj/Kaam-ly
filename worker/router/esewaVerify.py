# ── Backend: add this endpoint to your worker registration router ─────────────
# Calls eSewa's merchant verification API to check if the ID exists.

import httpx
import hmac
import hashlib
import base64
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["esewa"])

ESEWA_MERCHANT_CODE = "EPAYTEST"          # swap for prod
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"  # swap for prod
ESEWA_VERIFY_URL    = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/verification/"


class EsewaVerifyRequest(BaseModel):
    esewa_id: str  # phone number or eSewa ID the worker enters


def generate_signature(message: str, secret: str) -> str:
    key    = secret.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


@router.post("/esewa/verify")
async def verify_esewa_id(request: EsewaVerifyRequest):
    """
    Called from the worker registration form when they enter their eSewa ID.
    Returns { valid: true/false, name: "..." } so the frontend can show
    the account holder name as confirmation before they submit the form.
    """
    transaction_uuid = str(uuid.uuid4())
    # eSewa verification uses a small test amount to confirm the ID exists
    test_amount = "1"

    message   = f"total_amount={test_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = generate_signature(message, ESEWA_SECRET_KEY)

    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "total_amount":     test_amount,
        "esewa_id":         request.esewa_id,
        "signature":        signature,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                ESEWA_VERIFY_URL,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
        data = res.json() if res.content else {}

        if res.status_code == 200 and data.get("status") == "SUCCESS":
            return {
                "valid": True,
                "name":  data.get("name") or data.get("account_name") or "",
                "esewa_id": request.esewa_id,
            }
        else:
            return {
                "valid":   False,
                "message": "eSewa ID not found. Please check and try again.",
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"eSewa verification failed: {str(e)}")