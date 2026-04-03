import hmac
import hashlib
import base64
import httpx
from datetime import datetime
from uuid import uuid4
from typing import Tuple, Dict, Any

# ── Config — move to .env ─────────────────────────────────────────────────────
ESEWA_MERCHANT_CODE     = "EPAYTEST"
ESEWA_SECRET_KEY        = "8gBm/:&EnhH.1/q"
ESEWA_MERCHANT_USERNAME = "9806800001"
ESEWA_MERCHANT_PASSWORD = "Nepal@123"
ESEWA_TIMEOUT           = 30

# Sandbox
ESEWA_MERCHANT_API_BASE = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
ESEWA_STATUS_URL        = "https://rc-epay.esewa.com.np/api/epay/transaction/status/"

# Production (swap on go-live)
# ESEWA_MERCHANT_API_BASE = "https://epay.esewa.com.np/api/epay/merchant-api/v2"
# ESEWA_STATUS_URL        = "https://epay.esewa.com.np/api/epay/transaction/status/"


# ── Helpers ───────────────────────────────────────────────────────────────────
def _generate_signature(message: str) -> str:
    key    = ESEWA_SECRET_KEY.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def _log(label: str, status: int, body: Any):
    print(f"[eSewa][{label}] status={status} body={body}")


# ── Merchant Login → Token ────────────────────────────────────────────────────
async def _get_merchant_token() -> str | None:
    """
    Login to eSewa merchant API and return the access token.
    Called before every refund/disbursement request.
    """
    try:
        async with httpx.AsyncClient(timeout=ESEWA_TIMEOUT) as client:
            res = await client.post(
                f"{ESEWA_MERCHANT_API_BASE}/login/",
                json={
                    "client_id": ESEWA_MERCHANT_CODE,
                    "username":  ESEWA_MERCHANT_USERNAME,
                    "password":  ESEWA_MERCHANT_PASSWORD,
                },
                headers={"Content-Type": "application/json"},
            )
        _log("login", res.status_code, res.text)

        try:
            data = res.json()
        except Exception:
            data = {}

        return (
            data.get("token")
            or data.get("access_token")
            or data.get("accessToken")
        )

    except Exception as e:
        print(f"[eSewa][login] failed: {e}")
        return None


# ── Refund to Customer ────────────────────────────────────────────────────────
async def refund_to_customer(
    esewa_id:        str,
    amount:          float,
    esewa_ref_id:    str,
    remarks:         str = "",
    idempotency_key: str = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Refund money back to a customer's eSewa account.
    Requires the original esewa_ref_id (transaction_code) from when the customer paid.
    """
    if not esewa_id:
        return False, {"message": "Customer eSewa ID is required"}
    if not esewa_ref_id:
        return False, {"message": "Original eSewa transaction reference (esewa_ref_id) is required"}
    if amount <= 0:
        return False, {"message": "Refund amount must be greater than 0"}

    if not idempotency_key:
        idempotency_key = f"refund-{uuid4()}"

    # ── Step 1: Get merchant token ────────────────────────────
    token = await _get_merchant_token()
    if not token:
        return False, {"message": "Could not authenticate with eSewa merchant API — check RC credentials"}

    # ── Step 2: Build signed payload ─────────────────────────
    transaction_uuid = str(uuid4())
    total_amount     = int(amount)
    message          = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature        = _generate_signature(message)

    payload = {
        "product_code":       ESEWA_MERCHANT_CODE,
        "transaction_uuid":   transaction_uuid,
        "total_amount":       str(total_amount),
        "esewa_id":           esewa_id,
        "ref_id":             esewa_ref_id,
        "remarks":            remarks or "Task refund",
        "signed_field_names": "total_amount,transaction_uuid,product_code",
        "signature":          signature,
    }

    headers = {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {token}",
    }

    try:
        async with httpx.AsyncClient(timeout=ESEWA_TIMEOUT) as client:
            res = await client.post(
                f"{ESEWA_MERCHANT_API_BASE}/refund/",
                json=payload,
                headers=headers,
            )

        _log("refund_to_customer", res.status_code, res.text)

        try:
            data = res.json()
        except Exception:
            data = {}

        if res.status_code == 200:
            status = str(data.get("status", "")).upper()
            if status in ("SUCCESS", "COMPLETE", "REFUNDED"):
                return True, {
                    "transactionId":    data.get("transactionId") or transaction_uuid,
                    "transaction_uuid": transaction_uuid,
                    "message":          "Refund successful",
                    "timestamp":        datetime.utcnow().isoformat(),
                    "recipientEsewaId": esewa_id,
                }
            else:
                return False, {
                    "message":     data.get("message") or f"Unexpected eSewa status: {status}",
                    "raw":         data,
                    "status_code": res.status_code,
                }

        elif res.status_code == 401:
            return False, {
                "message":     "eSewa merchant login token rejected — re-login failed",
                "status_code": 401,
            }
        elif res.status_code == 403:
            return False, {
                "message":     f"eSewa 403: {data.get('error_message', 'Merchant account lacks refund API permission')}",
                "status_code": 403,
            }
        elif res.status_code == 404:
            return False, {
                "message":     "Original transaction not found on eSewa — check esewa_ref_id",
                "status_code": 404,
            }
        elif res.status_code == 422:
            return False, {
                "message":     f"eSewa rejected payload: {data}",
                "status_code": 422,
            }
        else:
            return False, {
                "message":     data.get("message") or f"eSewa error {res.status_code}",
                "raw":         data,
                "status_code": res.status_code,
            }

    except httpx.TimeoutException:
        return False, {"message": "eSewa timeout — refund may still be processing, check manually"}
    except httpx.RequestError as e:
        return False, {"message": f"Network error: {str(e)}"}
    except Exception as e:
        return False, {"message": f"Unexpected error: {str(e)}"}


# ── Disburse to Worker ────────────────────────────────────────────────────────
async def disburse_to_worker(
    phone:           str,
    amount:          float,
    remarks:         str = "",
    idempotency_key: str = None,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Send payment to a worker's eSewa account via their phone number.
    """
    if not phone:
        return False, {"message": "Worker phone number is required"}
    if amount <= 0:
        return False, {"message": "Amount must be greater than 0"}

    if not idempotency_key:
        idempotency_key = f"worker-{uuid4()}"

    # ── Step 1: Get merchant token ────────────────────────────
    token = await _get_merchant_token()
    if not token:
        return False, {"message": "Could not authenticate with eSewa merchant API — check RC credentials"}

    # ── Step 2: Build signed payload ─────────────────────────
    transaction_uuid = str(uuid4())
    total_amount     = int(amount)
    message          = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature        = _generate_signature(message)

    payload = {
        "product_code":       ESEWA_MERCHANT_CODE,
        "transaction_uuid":   transaction_uuid,
        "total_amount":       str(total_amount),
        "esewa_id":           phone,
        "remarks":            remarks or "Worker payout",
        "signed_field_names": "total_amount,transaction_uuid,product_code",
        "signature":          signature,
    }

    headers = {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {token}",
    }

    try:
        async with httpx.AsyncClient(timeout=ESEWA_TIMEOUT) as client:
            res = await client.post(
                f"{ESEWA_MERCHANT_API_BASE}/refund/",
                json=payload,
                headers=headers,
            )

        _log("disburse_to_worker", res.status_code, res.text)

        try:
            data = res.json()
        except Exception:
            data = {}

        if res.status_code == 200:
            status = str(data.get("status", "")).upper()
            if status in ("SUCCESS", "COMPLETE"):
                return True, {
                    "transactionId":    data.get("transactionId") or transaction_uuid,
                    "transaction_uuid": transaction_uuid,
                    "message":          "Disbursement successful",
                    "timestamp":        datetime.utcnow().isoformat(),
                    "phone":            phone,
                }
            else:
                return False, {
                    "message":     data.get("message") or f"Unexpected eSewa status: {status}",
                    "raw":         data,
                    "status_code": res.status_code,
                }

        elif res.status_code == 401:
            return False, {
                "message":     "eSewa merchant login token rejected",
                "status_code": 401,
            }
        elif res.status_code == 403:
            return False, {
                "message":     f"eSewa 403: {data.get('error_message', 'Merchant account lacks disbursement API permission')}",
                "status_code": 403,
            }
        elif res.status_code == 404:
            return False, {
                "message":     "Worker eSewa account not found — check phone number",
                "status_code": 404,
            }
        elif res.status_code == 422:
            return False, {
                "message":     f"eSewa rejected payload: {data}",
                "status_code": 422,
            }
        else:
            return False, {
                "message":     data.get("message") or f"eSewa error {res.status_code}",
                "raw":         data,
                "status_code": res.status_code,
            }

    except httpx.TimeoutException:
        return False, {"message": "eSewa timeout — disbursement may still be processing"}
    except httpx.RequestError as e:
        return False, {"message": f"Network error: {str(e)}"}
    except Exception as e:
        return False, {"message": f"Unexpected error: {str(e)}"}


# ── Verify Transaction ────────────────────────────────────────────────────────
async def verify_transaction(
    transaction_uuid: str,
    total_amount:     float,
) -> Tuple[bool, Dict[str, Any]]:
    """
    Check a transaction's status against eSewa.
    """
    try:
        async with httpx.AsyncClient(timeout=ESEWA_TIMEOUT) as client:
            res = await client.get(
                ESEWA_STATUS_URL,
                params={
                    "product_code":     ESEWA_MERCHANT_CODE,
                    "total_amount":     int(total_amount),
                    "transaction_uuid": transaction_uuid,
                },
                headers={"Authorization": f"Bearer {await _get_merchant_token()}"},
            )

        _log("verify_transaction", res.status_code, res.text)

        try:
            data = res.json()
        except Exception:
            data = {}

        if res.status_code == 200:
            return True, data
        else:
            return False, {
                "message":     data.get("message", "Verification failed"),
                "status_code": res.status_code,
            }

    except httpx.TimeoutException:
        return False, {"message": "eSewa API timeout"}
    except httpx.RequestError as e:
        return False, {"message": f"Network error: {str(e)}"}
    except Exception as e:
        return False, {"message": f"Unexpected error: {str(e)}"}


# ── Bulk Operations ───────────────────────────────────────────────────────────
async def bulk_disburse_to_workers(
    disbursements: list[dict],
) -> Tuple[list, list]:
    """
    Process multiple worker disbursements in parallel.
    Each dict needs: phone, amount, remarks (optional), idempotency_key (optional)
    """
    import asyncio

    tasks = [
        disburse_to_worker(
            phone=d.get("phone") or d.get("esewa_id"),
            amount=d.get("amount"),
            remarks=d.get("remarks", ""),
            idempotency_key=d.get("idempotency_key"),
        )
        for d in disbursements
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    successful, failed = [], []
    for idx, result in enumerate(results):
        if isinstance(result, Exception):
            failed.append({"index": idx, "disbursement": disbursements[idx], "error": str(result)})
        else:
            success, response = result
            if success:
                successful.append({"index": idx, "disbursement": disbursements[idx], "response": response})
            else:
                failed.append({"index": idx, "disbursement": disbursements[idx], "error": response.get("message", "Unknown error")})

    return successful, failed


async def bulk_refund_to_customers(
    refunds: list[dict],
) -> Tuple[list, list]:
    """
    Process multiple customer refunds in parallel.
    Each dict needs: esewa_id, amount, esewa_ref_id, remarks (optional), idempotency_key (optional)
    """
    import asyncio

    tasks = [
        refund_to_customer(
            esewa_id=r.get("esewa_id"),
            amount=r.get("amount"),
            esewa_ref_id=r.get("esewa_ref_id"),
            remarks=r.get("remarks", ""),
            idempotency_key=r.get("idempotency_key"),
        )
        for r in refunds
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    successful, failed = [], []
    for idx, result in enumerate(results):
        if isinstance(result, Exception):
            failed.append({"index": idx, "refund": refunds[idx], "error": str(result)})
        else:
            success, response = result
            if success:
                successful.append({"index": idx, "refund": refunds[idx], "response": response})
            else:
                failed.append({"index": idx, "refund": refunds[idx], "error": response.get("message", "Unknown error")})

    return successful, failed