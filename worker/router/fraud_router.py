import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from ..repository.fraud_engine import FraudScorer

router = APIRouter(prefix="/fraud", tags=["fraud"])


class ReviewAction(BaseModel):
    action: str
    note: str = ""


def get_db(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db


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
    report = await scorer.score(user_id)          # ← scorer is now truly async
    return {
        "user_id": user_id,
        "risk_level": report.risk_level,           # ← .value removed, it's a plain str
        "total_score": report.total_score,
        "signals": [
            {"name": s.name, "score": s.score, "reason": s.reason}  # ← s.name not s.category
            for s in report.signals
        ],
    }