import httpx
import hmac
import hashlib
import base64
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["esewa"])

ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"
ESEWA_VERIFY_URL    = "https://rc.esewa.com.np/api/epay/merchant-api/v2/verification/"


class EsewaVerifyRequest(BaseModel):
    esewa_id: str


def generate_signature(message: str, secret: str) -> str:
    key    = secret.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def build_auth_header() -> str:
    credentials = base64.b64encode(
        f"{ESEWA_MERCHANT_CODE}:{ESEWA_SECRET_KEY}".encode()
    ).decode()
    return f"Basic {credentials}"


@router.post("/esewa/verify")
async def verify_esewa_id(request: EsewaVerifyRequest):
    """
    Verifies whether a given eSewa ID (phone number) exists.
    Called from the worker registration form before submission.
    Returns { valid: bool, name: str }
    """
    transaction_uuid = str(uuid.uuid4())
    test_amount      = "1"

    message   = f"total_amount={test_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = generate_signature(message, ESEWA_SECRET_KEY)

    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "total_amount":     test_amount,
        "esewa_id":         request.esewa_id,
        "signature":        signature,
    }

    headers = {
        "Content-Type":  "application/json",
        "Authorization": build_auth_header(),
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(ESEWA_VERIFY_URL, json=payload, headers=headers)

        # ── Log raw response for debugging ──────────────────────────
        print(f"[eSewa verify] status={res.status_code} body={res.text}")

        # ── Parse response ──────────────────────────────────────────
        try:
            data = res.json()
        except Exception:
            data = {}

        # ── Handle different status codes ───────────────────────────
        if res.status_code == 200:
            status = data.get("status", "").lower()
            if status in ("success", "complete", "active"):
                return {
                    "valid":    True,
                    "name":     data.get("name") or data.get("account_name") or data.get("full_name") or "",
                    "esewa_id": request.esewa_id,
                }
            else:
                return {
                    "valid":   False,
                    "message": data.get("message") or "eSewa ID not found. Please check and try again.",
                }

        elif res.status_code == 401:
            # Auth failed — either wrong credentials or endpoint needs different auth
            raise HTTPException(
                status_code=502,
                detail="eSewa merchant authentication failed. Check ESEWA_MERCHANT_CODE and ESEWA_SECRET_KEY."
            )

        elif res.status_code == 404:
            return {
                "valid":   False,
                "message": "eSewa ID not found. Please check and try again.",
            }

        elif res.status_code == 422:
            raise HTTPException(
                status_code=422,
                detail=f"eSewa rejected the request payload: {data}"
            )

        else:
            raise HTTPException(
                status_code=502,
                detail=f"Unexpected response from eSewa: {res.status_code} — {res.text}"
            )

    except HTTPException:
        raise  # re-raise our own errors cleanly

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="eSewa verification timed out. Please try again.")

    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach eSewa: {str(e)}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"eSewa verification failed: {str(e)}")