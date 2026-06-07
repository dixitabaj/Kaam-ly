# fraud_router.py - Optimized for 12K+ users
import asyncio
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any
from ..repository.fraud_engine import FraudScorer
from ..config.database import collection, collection_worker

router = APIRouter(prefix="/fraud", tags=["fraud"])

# In-memory job store — swap for Redis in production
_scan_jobs: Dict[str, Any] = {}


class ReviewAction(BaseModel):
    action: str
    note: str = ""


def get_db(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db


# ── existing endpoints ────────────────────────────────────────────────────────

@router.get("/flagged")
async def flagged_users(level: str = "monitor", page: int = 1, db=Depends(get_db)):
    valid = ["monitor", "restrict", "suspend"]
    if level not in valid:
        raise HTTPException(status_code=400, detail="level must be monitor | restrict | suspend")

    levels = valid[valid.index(level):]
    limit = 20
    total = await db.fraud_reports.count_documents({"risk_level": {"$in": levels}})
    users_cursor = db.fraud_reports.find(
        {"risk_level": {"$in": levels}},
        sort=[("total_score", -1)],
        skip=(page - 1) * limit,
        limit=limit,
    )
    users = []
    async for u in users_cursor:
        u["_id"] = str(u["_id"])
        users.append(u)

    return {"total": total, "page": page, "users": users}


@router.get("/user/{user_id}")
async def user_detail(user_id: str, db=Depends(get_db)):
    report = await db.fraud_reports.find_one({"user_id": user_id})
    if not report:
        raise HTTPException(status_code=404, detail="No fraud report found")
    report["_id"] = str(report["_id"])
    return report


@router.post("/user/{user_id}/review")
async def manual_review(user_id: str, body: ReviewAction, db=Depends(get_db)):
    if body.action not in ("clear", "restrict", "suspend"):
        raise HTTPException(status_code=400, detail="action must be clear | restrict | suspend")

    level_map = {"clear": "clean", "restrict": "restrict", "suspend": "suspend"}
    result = await db.fraud_reports.update_one(
        {"user_id": user_id},
        {"$set": {
            "risk_level": level_map[body.action],
            "manual_review": {
                "action": body.action,
                "note": body.note,
                "at": datetime.datetime.utcnow(),
            },
        }},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"status": "ok", "new_level": level_map[body.action]}


@router.post("/user/{user_id}/rescan")
async def rescan_user(user_id: str, db=Depends(get_db)):
    scorer = FraudScorer(db)
    report = await scorer.score(user_id)
    return {
        "user_id": user_id,
        "risk_level": report.risk_level,
        "total_score": report.total_score,
        "signals": [
            {"name": s.name, "score": s.score, "reason": s.reason}
            for s in report.signals
        ],
    }


# ── OPTIMIZED scan-all endpoints ──────────────────────────────────────────────
# ── OPTIMIZED scan-all endpoints (FIXED VERSION) ──────────────────────────────

@router.post("/scan-all")
async def scan_all(request: Request, db=Depends(get_db)):
    """
    Kicks off a background fraud scan job for all users.
    Safe for 12K+ users.
    """
    job_id = str(uuid.uuid4())

    _scan_jobs[job_id] = {
        "status": "running",
        "progress": 0,
        "total": 0,
        "errors": 0,
        "started_at": datetime.datetime.utcnow().isoformat(),
    }

    asyncio.create_task(_run_scan_job(job_id, db))

    return {"job_id": job_id}


@router.get("/scan-progress/{job_id}")
async def scan_progress(job_id: str):
    """Poll job progress"""
    job = _scan_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ── INTERNAL JOB WORKER ──────────────────────────────────────────────────────

def _normalize_id(uid):
    """
    Fixes corrupted DB values:
    - list
    - dict
    - None
    """
    if uid is None:
        return None

    if isinstance(uid, list):
        # if it's ["123"], flatten it
        if len(uid) == 1:
            return str(uid[0])
        return None

    if isinstance(uid, dict):
        return None

    return str(uid)


async def _safe_score(scorer, uid):
    """Prevents single-user crash from killing batch"""
    try:
        return await scorer.score(uid)
    except Exception as e:
        return e


async def _run_scan_job(job_id: str, db) -> None:
    try:
        # 1. Fetch IDs safely
        customer_ids =  collection.distinct("_id")
        worker_ids =  collection_worker.distinct("_id")

        raw_ids = customer_ids + worker_ids

        # 2. Clean IDs (CRITICAL FIX)
        all_ids = []
        for uid in raw_ids:
            clean = _normalize_id(uid)
            if clean:
                all_ids.append(clean)

        if not all_ids:
            _scan_jobs[job_id].update({
                "status": "done",
                "total": 0,
                "progress": 0
            })
            return

        _scan_jobs[job_id]["total"] = len(all_ids)

        scorer = FraudScorer(db)

        BATCH_SIZE = 50
        errors = 0

        # 3. Batch processing
        for i in range(0, len(all_ids), BATCH_SIZE):
            batch = all_ids[i:i + BATCH_SIZE]

            # extra safety filter
            batch = [uid for uid in batch if isinstance(uid, str)]

            results = await asyncio.gather(
                *[_safe_score(scorer, uid) for uid in batch],
                return_exceptions=True,
            )

            # count errors
            errors += sum(1 for r in results if isinstance(r, Exception))

            # update progress
            _scan_jobs[job_id]["progress"] = min(i + BATCH_SIZE, len(all_ids))
            _scan_jobs[job_id]["errors"] = errors

        # 4. Mark complete
        _scan_jobs[job_id].update({
            "status": "done",
            "completed_at": datetime.datetime.utcnow().isoformat(),
        })

    except Exception as exc:
        _scan_jobs[job_id].update({
            "status": "error",
            "detail": str(exc),
            "failed_at": datetime.datetime.utcnow().isoformat(),
        })

# Optional: Cleanup old jobs (call this periodically or via cron)
@router.delete("/scan-jobs/cleanup")
async def cleanup_old_jobs():
    """Remove completed jobs older than 1 hour"""
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    removed = 0
    
    for job_id in list(_scan_jobs.keys()):
        job = _scan_jobs[job_id]
        if job["status"] in ("done", "error"):
            started = datetime.datetime.fromisoformat(job["started_at"])
            if started < cutoff:
                del _scan_jobs[job_id]
                removed += 1
    
    return {"removed": removed, "active_jobs": len(_scan_jobs)}