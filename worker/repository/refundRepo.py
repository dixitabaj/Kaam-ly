import httpx
import hmac
import hashlib
import base64
from datetime import datetime
from uuid import uuid4

# --- Hardcoded Config ---
ESEWA_MERCHANT_CODE = "EPAYTEST"
ESEWA_SECRET_KEY = "8gBm/:&EnhH.1/q"
ESEWA_REFUND_URL = "https://rc-epay.esewa.com.np/api/epay/merchant-api/v2/refund/"

# Import your database collections
from ..config.database import refund_collection, collection_task

# --- Helper Functions ---

def generate_signature(message: str, secret: str) -> str:
    """Generates the HMAC-SHA256 signature required by eSewa v2."""
    key = secret.encode("utf-8")
    msg = message.encode("utf-8")
    digest = hmac.new(key, msg, digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")

async def process_esewa_refund(transaction_uuid: str, amount: float):
    """
    Executes the POST request to eSewa. 
    Note: message string order is strict in v2.
    """
    # Use 2 decimal places to avoid signature mismatch
    formatted_amount = "{:.1f}".format(amount) 
    message = f"transaction_uuid={transaction_uuid},refund_amount={formatted_amount},product_code={ESEWA_MERCHANT_CODE}"
    signature = generate_signature(message, ESEWA_SECRET_KEY)

    payload = {
        "product_code": ESEWA_MERCHANT_CODE,
        "transaction_uuid": transaction_uuid,
        "refund_amount": formatted_amount,
        "signature": signature,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(
                ESEWA_REFUND_URL,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
        data = res.json() if res.text else {}
        
        # Check both HTTP status and business logic status
        if res.status_code == 200 and data.get("status") == "SUCCESS":
            return True, data
        else:
            return False, data
    except Exception as e:
        return False, {"error": str(e)}

# --- Refund Management ---

async def create_refund(data: dict):
    """Creates a new refund document in the DB."""
    doc = {
        "_id": str(uuid4()),
        "task_id": data.get("task_id"),
        "requester_id": data.get("requester_id"),
        "reported_id": data.get("reported_id"),
        "requester_type": data.get("requester_type"),
        "reported_type": data.get("reported_type"),
        "amount_customer": float(data.get("amount_customer", 0)),
        "amount_worker": float(data.get("amount_worker", 0)),
        "reason": data.get("reason"),
        "requested_by": data.get("requested_by"),
        "status": "pending",
        "admin_note": None,
        "created_at": datetime.utcnow(),
        "resolved_at": None,
    }
    await refund_collection.insert_one(doc)
    return doc

async def update_refund_status(refund_id: str, status: str, admin_note: str | None):
    """Updates status and triggers eSewa API if status is 'approved'."""
    # 1. Fetch current document
    refund_record = await refund_collection.find_one({"_id": refund_id})
    if not refund_record:
        return None

    # Skip if already finalized
    if refund_record.get("status") in ["approved", "failed"]:
        return refund_record

    final_status = status
    api_response = None

    # 2. Handle eSewa logic for customer refunds
    if status == "approved" and refund_record.get("amount_customer", 0) > 0:
        task = await collection_task.find_one({"_id": refund_record["task_id"]})
        
        # eSewa v2 requires the original Transaction UUID used during payment
        tx_uuid = task.get("esewa_ref_id") if task else None
        
        if tx_uuid:
            success, api_response = await process_esewa_refund(tx_uuid, refund_record["amount_customer"])
            if not success:
                final_status = "failed"
                admin_note = f"API Error: {api_response.get('message', 'Refund rejected by eSewa')}"
        else:
            final_status = "failed"
            admin_note = "Failed: Original transaction UUID not found in task record."

    # 3. Commit update to Database
    update_data = {
        "status": final_status,
        "admin_note": admin_note,
        "resolved_at": datetime.utcnow()
    }
    
    await refund_collection.update_one({"_id": refund_id}, {"$set": update_data})
    
    # Return updated record
    refund_record.update(update_data)
    refund_record["id"] = refund_record["_id"]
    return refund_record

async def list_refunds(skip=0, limit=50, status=None):
    query = {"status": status} if status else {}
    cursor = refund_collection.find(query).skip(skip).limit(limit).sort("created_at", -1)
    
    items = []
    async for doc in cursor:
        doc["id"] = doc["_id"]
        items.append(doc)
    return items

async def delete_refund(refund_id: str):
    return await refund_collection.delete_one({"_id": refund_id})