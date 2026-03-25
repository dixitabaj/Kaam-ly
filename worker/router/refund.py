from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from ..schemas.schemas import RefundCreate, RefundOut, RefundUpdateStatus
from ..router.refund import create_refund, list_refunds, update_refund_status, delete_refund

router = APIRouter(
    prefix="/refunds",
    tags=["Refunds"]
)

# ── Create a refund ──────────────────────────────────────────────────────────
@router.post("/", response_model=RefundOut)
async def create_refund_endpoint(data: RefundCreate):
    doc = await create_refund(data.dict())
    return doc

# ── List refunds ────────────────────────────────────────────────────────────
@router.get("/", response_model=list[RefundOut])
async def list_refunds_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None)
):
    refunds = await list_refunds(skip, limit, status)
    return refunds

# ── Update refund status ────────────────────────────────────────────────────
@router.patch("/{refund_id}/status", response_model=RefundOut)
async def update_status_endpoint(refund_id: str, data: RefundUpdateStatus):
    refund = await update_refund_status(refund_id, data.status, data.admin_note)
    if not refund:
        raise HTTPException(404, "Refund not found")
    return refund

# ── Delete a refund ─────────────────────────────────────────────────────────
@router.delete("/{refund_id}", status_code=204)
async def delete_refund_endpoint(refund_id: str):
    await delete_refund(refund_id)