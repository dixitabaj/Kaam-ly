# slots_utils.py
from datetime import datetime
from bson import ObjectId


# ── time helpers ──────────────────────────────────────────────────────────────

def _to_mins(t: str) -> int:
    h, m = t.strip().split(":")
    return int(h) * 60 + int(m)


def _to_str(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


# ── worker resolver ───────────────────────────────────────────────────────────

def resolve_worker(worker_id: str, collection_worker):
    """Accept ObjectId string or email; return the worker doc or None."""
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(worker_id)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": worker_id})
    return worker


# ── core slot functions ───────────────────────────────────────────────────────

def get_general_slots(worker: dict, date: str) -> list[dict]:
    """
    Returns the raw weekly-template slots for a given date from worker.hours.
    Each slot: { "start": "HH:MM", "end": "HH:MM" }
    """
    try:
        date_obj = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValueError(f"Invalid date format '{date}'. Use YYYY-MM-DD.")

    day_cap = date_obj.strftime("%A")    # "Monday"
    day_low = day_cap.lower()             # "monday"

    hours_dict = worker.get("hours") or worker.get("availability", {}).get("hours", {})
    weekly     = hours_dict.get(day_cap) or hours_dict.get(day_low) or []

    slots = []
    for s in weekly:
        if isinstance(s, dict) and "start" in s and "end" in s:
            slots.append({"start": s["start"], "end": s["end"]})
        elif isinstance(s, str) and "-" in s:
            parts = s.split("-")
            if len(parts) == 2:
                slots.append({"start": parts[0].strip(), "end": parts[1].strip()})
    return slots


def get_booked_slots(worker: dict, date: str, db) -> list[dict]:
    """
    Returns tasks booked for this worker on the given date.
    Each slot: { "start", "end", "taskId", "taskName", "status" }
    """
    resolved_id = str(worker["_id"])
    email       = worker.get("email")

    tasks = list(db.collection_task.find({
        "assignedWorkerId": {"$in": [x for x in [resolved_id, email] if x]},
        "status":           {"$in": ["pending", "confirmed", "accepted", "in_progress"]},
    }))

    booked = []
    for task in tasks:
        service_date = task.get("serviceDate")
        service_time = task.get("serviceTime")
        if not service_date or not service_time:
            continue
        if str(service_date).split("T")[0] != date:
            continue

        start_mins = _to_mins(service_time)
        est_hours  = task.get("estimatedHours") or 2
        end_mins   = start_mins + int(est_hours * 60)

        booked.append({
            "start":    service_time,
            "end":      _to_str(end_mins),
            "taskId":   str(task["_id"]),
            "taskName": task.get("taskName", ""),
            "status":   task.get("status"),
        })

    return booked


def get_free_slots(
    general_slots: list[dict],
    booked_slots:  list[dict],
    min_duration_mins: int = 15,
) -> list[dict]:
    """
    Subtracts booked ranges from general slots.
    Returns slots at least `min_duration_mins` long.
    """
    free = [
        {"start": _to_mins(s["start"]), "end": _to_mins(s["end"])}
        for s in general_slots
    ]

    for booked in booked_slots:
        b_start   = _to_mins(booked["start"])
        b_end     = _to_mins(booked["end"])
        remaining = []

        for seg in free:
            if b_end <= seg["start"] or b_start >= seg["end"]:
                remaining.append(seg)
            else:
                if seg["start"] < b_start:
                    remaining.append({"start": seg["start"], "end": b_start})
                if seg["end"] > b_end:
                    remaining.append({"start": b_end, "end": seg["end"]})

        free = remaining

    return [
        {"start": _to_str(s["start"]), "end": _to_str(s["end"])}
        for s in free
        if s["end"] - s["start"] >= min_duration_mins
    ]

# routers/worker.py
from fastapi import APIRouter, HTTPException
from datetime import datetime
from ..config.database import db, collection_worker, worker_calendar          # adjust to your import path

router = APIRouter(prefix="/worker", tags=["worker"])


# ── 1. Worker availability ────────────────────────────────────────────────────

@router.get("/availability/{workerId}")
def get_worker_availability(workerId: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    hours = worker.get("hours") or worker.get("availability", {}).get("hours", {})

    return {
        "workerId":    str(worker["_id"]),
        "isAvailable": worker.get("isAvailable", True),
        "hours":       hours,
    }


# ── 2. Booked slots for a date ────────────────────────────────────────────────

@router.get("/booked/{workerId}/{date}")
def get_worker_booked_slots(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    booked = get_booked_slots(worker, date, db)

    return {
        "workerId":    str(worker["_id"]),
        "date":        date,
        "bookedSlots": booked,
    }


# ── 3. General slots for a date (weekly template only) ───────────────────────

@router.get("/general-slots/{workerId}/{date}")
def get_worker_general_slots(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    try:
        general = get_general_slots(worker, date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "workerId":     str(worker["_id"]),
        "date":         date,
        "generalSlots": general,
    }


# ── 4. Free slots (general minus booked) ─────────────────────────────────────

@router.get("/free-slots/{workerId}/{date}")
def get_worker_free_slots(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    try:
        general = get_general_slots(worker, date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    booked = get_booked_slots(worker, date, db)
    free   = get_free_slots(general, booked)

    return {
        "workerId":     str(worker["_id"]),
        "date":         date,
        "generalSlots": general,   # full weekly template for the day
        "bookedSlots":  booked,    # active tasks occupying time
        "freeSlots":    free,      # general minus booked, ≥ 15 min
    }

def get_booked_slot_ranges(booked_slots: list[dict]) -> list[dict]:
    """
    Merges overlapping booked slots and returns continuous ranges.
    Each slot: { "start": "HH:MM", "end": "HH:MM" }
    """
    # Convert to minutes for easy calculations
    ranges = sorted(
        [{"start": _to_mins(s["start"]), "end": _to_mins(s["end"])} for s in booked_slots],
        key=lambda x: x["start"]
    )

    merged = []
    for r in ranges:
        if not merged:
            merged.append(r)
        else:
            last = merged[-1]
            if r["start"] <= last["end"]:  # overlapping or contiguous
                last["end"] = max(last["end"], r["end"])
            else:
                merged.append(r)

    # Convert back to "HH:MM"
    return [{"start": _to_str(s["start"]), "end": _to_str(s["end"])} for s in merged]

@router.get("/booked-ranges/{workerId}/{date}")
def get_worker_booked_slot_ranges(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    booked = get_booked_slots(worker, date, db)
    booked_ranges = get_booked_slot_ranges(booked)

    return {
        "workerId":     str(worker["_id"]),
        "date":         date,
        "bookedSlots":  booked_ranges,  # merged booked ranges
    }

# ── 5. Calendar slots (worker_calendar with weekly fallback) ──────────────────

@router.get("/calendar/{workerId}/{date}")
def get_worker_calendar_slots(workerId: str, date: str):
    worker = resolve_worker(workerId, collection_worker)
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    resolved_id = str(worker["_id"])

    # Check worker_calendar first
    calendar_doc = worker_calendar.find_one({
        "workerId": resolved_id,
        "date":     date,
    })

    if calendar_doc:
        slots = calendar_doc.get("slots", [])
        return {"workerId": resolved_id, "date": date, "slots": slots, "source": "calendar"}

    # Fall back to weekly template
    try:
        general = get_general_slots(worker, date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Seed into worker_calendar so future booking blocks have a base
    if general:
        database.worker_calendar.update_one(
            {"workerId": resolved_id, "date": date},
            {"$set": {
                "slots":     general,
                "updatedAt": datetime.utcnow(),
                "source":    "seeded_from_weekly",
            }},
            upsert=True,
        )

    return {"workerId": resolved_id, "date": date, "slots": general, "source": "weekly_template"}