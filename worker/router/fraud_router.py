# fraud_router.py
import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from ..repository.fraud_engine import FraudScorer, RiskLevel

router = APIRouter(prefix="/fraud", tags=["fraud"])


class ReviewAction(BaseModel):
    action: str   # clear | restrict | suspend
    note:   str = ""


def get_db(request: Request):
    return request.app.state.db


@router.get("/flagged")
def flagged_users(level: str = "monitor", page: int = 1, db=Depends(get_db)):
    valid = ["monitor", "restrict", "suspend"]
    if level not in valid:
        raise HTTPException(400, "level must be monitor | restrict | suspend")
    levels = valid[valid.index(level):]
    limit  = 20
    total  = db.fraud_reports.count_documents({"risk_level": {"$in": levels}})
    users  = list(db.fraud_reports.find(
        {"risk_level": {"$in": levels}},
        sort=[("total_score", -1)],
        skip=(page - 1) * limit,
        limit=limit,
    ))
    for u in users:
        u["_id"] = str(u["_id"])
    return {"total": total, "page": page, "users": users}


@router.get("/user/{user_id}")
def user_detail(user_id: str, db=Depends(get_db)):
    report = db.fraud_reports.find_one({"user_id": user_id})
    if not report:
        raise HTTPException(404, "No fraud report found")
    report["_id"] = str(report["_id"])
    return report


@router.post("/user/{user_id}/review")
def manual_review(user_id: str, body: ReviewAction, db=Depends(get_db)):
    if body.action not in ("clear", "restrict", "suspend"):
        raise HTTPException(400, "action must be clear | restrict | suspend")
    level_map = {"clear": "clean", "restrict": "restrict", "suspend": "suspend"}
    db.fraud_reports.update_one(
        {"user_id": user_id},
        {"$set": {
            "risk_level":     level_map[body.action],
            "manual_review":  {
                "action": body.action,
                "note":   body.note,
                "at":     datetime.datetime.utcnow(),
            },
        }},
    )
    return {"status": "ok", "new_level": level_map[body.action]}


@router.post("/user/{user_id}/rescan")
def rescan_user(user_id: str, db=Depends(get_db)):
    scorer = FraudScorer(db)
    report = scorer.score(user_id)
    return {
        "user_id":     user_id,
        "risk_level":  report.risk_level.value,
        "total_score": report.total_score,
        "signals":     [{"category": s.category, "score": s.score, "reason": s.reason} for s in report.signals],
    }