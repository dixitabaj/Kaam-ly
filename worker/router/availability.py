# routers/availability_router.py

from fastapi import APIRouter, HTTPException
from typing import List
from ..repository import availabilityRepo

router = APIRouter(
    prefix="/availability",
    tags=["Availability"]
)

# ── Update or set availability for a day ────────────────────────────────
@router.post("/update-day")
async def update_day(day: availabilityRepo.DayAvailability):
    """
    Update availability for a worker on a specific day.
    If available=False, slots are ignored and the day is fully unavailable.
    """
    result = availabilityRepo.AvailabilityRepository.update_day(day)
    return {
        "status": "success",
        "message": f"Availability for {day.date} updated",
        "matched_count": result.matched_count,
        "modified_count": result.modified_count
    }

# ── Get availability for a specific day ───────────────────────────────
@router.get("/{worker_id}/{date_value}")
async def get_day_availability(worker_id: str, date_value: str):
    """
    Retrieve the availability of a worker for a specific date.
    """
    day = availabilityRepo.AvailabilityRepository.get_day(worker_id, date_value)
    if not day:
        raise HTTPException(status_code=404, detail="No availability found for this day")
    return {
        "workerId": day["workerId"],
        "date": day["date"].strftime("%Y-%m-%d") if hasattr(day["date"], "strftime") else day["date"],
        "available": day.get("available", False),
        "availableStatus": day.get("availableStatus", "unknown"),
        "slots": day.get("slots", [])
    }