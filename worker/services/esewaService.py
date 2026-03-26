import hmac
import hashlib
import base64
import httpx
from datetime import datetime
from uuid import uuid4

# ── Config — move to .env ─────────────────────────────────────────────────────
ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"

# Sandbox
ESEWA_REFUND_URL  = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/refund/"
ESEWA_STATUS_URL  = "https://rc.esewa.com.np/api/epay/transaction/status/"

# Production (swap on go-live)
# ESEWA_REFUND_URL = "https://epay.esewa.com.np/api/epay/merchant-api/v2/refund/"
# ESEWA_STATUS_URL = "https://epay.esewa.com.np/api/epay/transaction/status/"

# ── Enterprise disbursement (requires signed F1Soft agreement) ────────────────
# Email partnerships@esewa.com.np to get access
ESEWA_DISBURSE_ENABLED   = False
ESEWA_DISBURSE_CLIENT_ID = ""
ESEWA_DISBURSE_SECRET    = ""
ESEWA_DISBURSE_URL       = ""
ESEWA_DISBURSE_TOKEN_URL = ""


# ── Signature ─────────────────────────────────────────────────────────────────

def _sign(message: str, secret: str = ESEWA_SECRET_KEY) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")


# ── 1. Verify transaction ─────────────────────────────────────────────────────

async def verify_transaction(transaction_uuid: str, total_amount: float) -> dict:
    """
    Always call after receiving eSewa success callback.
    Do NOT release escrow until this returns success=True.
    """
    params = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "total_amount":     f"{total_amount:.2f}",
        "transaction_uuid": transaction_uuid,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(ESEWA_STATUS_URL, params=params)
        data = res.json() if res.text else {}
        return {
            "success":          res.status_code == 200 and data.get("status") == "COMPLETE",
            "transaction_uuid": transaction_uuid,
            "data":             data,
        }
    except Exception as e:
        return {"success": False, "data": {"error": str(e)}}


# ── 2. Refund to customer ─────────────────────────────────────────────────────

async def refund_to_customer(
    transaction_uuid: str,
    amount: float,
) -> tuple[bool, dict]:
    """
    Refunds back to the eSewa wallet that originally paid.
    Uses the original transaction_uuid stored on the task as esewa_ref_id.
    """
    formatted = f"{amount:.2f}"
    message   = (
        f"transaction_uuid={transaction_uuid},"
        f"refund_amount={formatted},"
        f"product_code={ESEWA_MERCHANT_CODE}"
    )
    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "refund_amount":    formatted,
        "signature":        _sign(message),
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                ESEWA_REFUND_URL,
                json    = payload,
                headers = {"Content-Type": "application/json"},
            )
        data    = res.json() if res.text else {}
        success = res.status_code == 200 and data.get("status") == "SUCCESS"
        return success, data
    except Exception as e:
        return False, {"error": str(e)}


# ── 3. Disburse to worker ─────────────────────────────────────────────────────

async def _get_disburse_token() -> str | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                ESEWA_DISBURSE_TOKEN_URL,
                data = {
                    "grant_type":    "client_credentials",
                    "client_id":     ESEWA_DISBURSE_CLIENT_ID,
                    "client_secret": ESEWA_DISBURSE_SECRET,
                },
                headers = {"Content-Type": "application/x-www-form-urlencoded"},
            )
        if res.status_code == 200:
            return res.json().get("access_token")
    except Exception as e:
        print(f"[ESEWA DISBURSE] Token fetch failed: {e}")
    return None


async def disburse_to_worker(
    worker_esewa_id: str,
    amount: float,
    remarks: str = "",
    idempotency_key: str = "",
) -> tuple[bool, dict]:
    """
    Push money to a worker's eSewa wallet.
    Falls back to queue if enterprise API not enabled.
    """
    if not ESEWA_DISBURSE_ENABLED:
        return False, {
            "reason":  "not_enabled",
            "message": (
                "eSewa disbursement API requires a signed F1Soft enterprise agreement. "
                "Payout queued for manual processing."
            ),
        }

    token = await _get_disburse_token()
    if not token:
        return False, {"reason": "auth_failed", "message": "Could not obtain disbursement token"}

    ref_id  = idempotency_key or str(uuid4())
    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": ref_id,
        "amount":           f"{amount:.2f}",
        "esewa_id":         worker_esewa_id,
        "remarks":          remarks or f"Worker payout {ref_id}",
    }
    message          = f"transaction_uuid={ref_id},amount={amount:.2f},product_code={ESEWA_MERCHANT_CODE}"
    payload["signature"] = _sign(message, ESEWA_DISBURSE_SECRET)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                ESEWA_DISBURSE_URL,
                json    = payload,
                headers = {
                    "Content-Type":  "application/json",
                    "Authorization": f"Bearer {token}",
                },
            )
        data    = res.json() if res.text else {}
        success = res.status_code == 200 and data.get("status") in ("SUCCESS", "COMPLETE")
        return success, data
    except Exception as e:
        return False, {"reason": "exception", "error": str(e)}