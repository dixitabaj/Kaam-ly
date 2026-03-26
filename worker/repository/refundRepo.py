import httpx
import hmac
import hashlib
import base64
import asyncio

from datetime import datetime, timezone
from uuid import uuid4
from bson import ObjectId
from ..config.database import refund_collection, collection_task

# ── Config ────────────────────────────────────────────────────────────────────
ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY    = "8gBm/:&EnhH.1/q"
ESEWA_REFUND_URL    = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/refund/"


# ── Helpers ───────────────────────────────────────────────────────────────────
def create_refund_doc(
    task_id: str,
    requester_id: str,
    reported_id: str | None,
    requester_type: str,
    reported_type: str,
    amount_customer: float,
    amount_worker: float,
    reason: str,
    requested_by: str,
) -> dict:
    return {
        "_id":             str(uuid4()),
        "task_id":         task_id,
        "requester_id":    requester_id,
        "reported_id":     reported_id,
        "requester_type":  requester_type,
        "reported_type":   reported_type,
        "amount_customer": amount_customer,
        "amount_worker":   amount_worker,
        "reason":          reason,
        "requested_by":    requested_by,
        "status":          "pending",
        "admin_note":      None,
        "created_at":      datetime.now(timezone.utc),
        "resolved_at":     None,
    }


def generate_signature(message: str, secret: str) -> str:
    key    = secret.encode("utf-8")
    msg    = message.encode("utf-8")
    digest = hmac.new(key, msg, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


async def process_esewa_refund(transaction_uuid: str, amount: float) -> tuple[bool, dict]:
    message   = (
        f"transaction_uuid={transaction_uuid},"
        f"refund_amount={amount},"
        f"product_code={ESEWA_MERCHANT_CODE}"
    )
    signature = generate_signature(message, ESEWA_SECRET_KEY)

    payload = {
        "product_code":     ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "refund_amount":    str(amount),
        "signature":        signature,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                ESEWA_REFUND_URL,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        data = res.json() if res.content else {}
        return (res.status_code == 200 and data.get("status") == "SUCCESS"), data
    except Exception as e:
        return False, {"error": str(e)}


# ── CRUD ──────────────────────────────────────────────────────────────────────
async def create_refund(data: dict) -> dict:
    doc = create_refund_doc(**data)
    await refund_collection.insert_one(doc)
    return doc


async def list_refunds(skip: int = 0, limit: int = 50, status: str | None = None) -> list[dict]:
    query = {}
    if status:
        query["status"] = status

    cursor = refund_collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
    items  = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        items.append(doc)
    return items


async def update_refund_status(
    refund_id:  str,
    status:     str,
    admin_note: str | None,
) -> dict | None:
    result = await refund_collection.find_one({"_id": refund_id})
    if not result:
        return None

    update_data = {
        "status":      status,
        "admin_note":  admin_note,
        "resolved_at": datetime.now(timezone.utc),
    }
    await refund_collection.update_one({"_id": refund_id}, {"$set": update_data})
    result.update(update_data)
    result["id"] = result["_id"]

    # Trigger eSewa refund for the customer portion when admin approves
    if status == "approved" and result.get("amount_customer", 0) > 0:
        # Convert task_id to ObjectId if needed
        try:
            tid = ObjectId(result["task_id"])
        except:
            tid = result["task_id"]
        
        task = await collection_task.find_one({"_id": tid})
        if task and task.get("esewa_ref_id"):
            success, response = await process_esewa_refund(
                task["esewa_ref_id"], result["amount_customer"]
            )
            if not success:
                print(f"[eSewa] Refund failed for refund_id={refund_id}: {response}")
            else:
                # Update refund record with eSewa response
                await refund_collection.update_one(
                    {"_id": refund_id},
                    {"$set": {
                        "esewa_refund_status": "success",
                        "esewa_refund_response": response,
                        "esewa_refund_at": datetime.now(timezone.utc),
                    }}
                )

    return result


async def delete_refund(refund_id: str) -> bool:
    res = await refund_collection.delete_one({"_id": refund_id})
    return res.deleted_count == 1