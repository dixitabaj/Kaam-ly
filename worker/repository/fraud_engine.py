# fraud_engine.py
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List


class RiskLevel(Enum):
    CLEAN    = "clean"
    MONITOR  = "monitor"
    RESTRICT = "restrict"
    SUSPEND  = "suspend"


@dataclass
class FraudSignal:
    category: str
    score:    int
    reason:   str


@dataclass
class FraudReport:
    user_id:     str
    total_score: int
    risk_level:  RiskLevel
    signals:     List[FraudSignal] = field(default_factory=list)
    checked_at:  datetime          = field(default_factory=datetime.utcnow)


class FraudScorer:
    def __init__(self, db):
        self.db = db

    def score(self, user_id: str) -> FraudReport:
        signals: List[FraudSignal] = []

        signals += self._check_cancellations(user_id)
        signals += self._check_payment_failures(user_id)
        signals += self._check_review_spam(user_id)
        signals += self._check_rapid_signups(user_id)

        total = sum(s.score for s in signals)

        if total >= 80:
            level = RiskLevel.SUSPEND
        elif total >= 50:
            level = RiskLevel.RESTRICT
        elif total >= 25:
            level = RiskLevel.MONITOR
        else:
            level = RiskLevel.CLEAN

        report = FraudReport(
            user_id=user_id,
            total_score=total,
            risk_level=level,
            signals=signals,
        )

        # Persist to MongoDB
        self.db.fraud_reports.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id":     user_id,
                "total_score": total,
                "risk_level":  level.value,
                "signals":     [{"category": s.category, "score": s.score, "reason": s.reason} for s in signals],
                "checked_at":  report.checked_at,
            }},
            upsert=True,
        )
        return report

    # ── Signals ────────────────────────────────────────────────────────────────

    def _check_cancellations(self, user_id: str) -> List[FraudSignal]:
        since = datetime.utcnow() - timedelta(days=30)
        count = self.db.tasks.count_documents({
            "customerId": user_id,
            "status": "cancelled",
            "cancelledAt": {"$gte": since},
        })
        if count >= 10:
            return [FraudSignal("cancellations", 40, f"{count} cancellations in 30 days")]
        if count >= 5:
            return [FraudSignal("cancellations", 20, f"{count} cancellations in 30 days")]
        return []

    def _check_payment_failures(self, user_id: str) -> List[FraudSignal]:
        since = datetime.utcnow() - timedelta(days=7)
        count = self.db.payments.count_documents({
            "user_id": user_id,
            "status":  "failed",
            "created_at": {"$gte": since},
        })
        if count >= 5:
            return [FraudSignal("payment_failures", 35, f"{count} failed payments in 7 days")]
        if count >= 2:
            return [FraudSignal("payment_failures", 15, f"{count} failed payments in 7 days")]
        return []

    def _check_review_spam(self, user_id: str) -> List[FraudSignal]:
        since = datetime.utcnow() - timedelta(hours=24)
        count = self.db.reviews.count_documents({
            "customerId": user_id,
            "createdAt":  {"$gte": since},
        })
        if count >= 8:
            return [FraudSignal("review_spam", 30, f"{count} reviews in 24 hours")]
        return []

    def _check_rapid_signups(self, user_id: str) -> List[FraudSignal]:
        user = self.db.users.find_one({"_id": user_id})
        if not user:
            return []
        created = user.get("createdAt") or user.get("created_at")
        if not created:
            return []
        age_hours = (datetime.utcnow() - created).total_seconds() / 3600
        # New account acting very fast
        tasks = self.db.tasks.count_documents({"customerId": user_id})
        if age_hours < 2 and tasks >= 5:
            return [FraudSignal("rapid_activity", 25, f"{tasks} tasks within {age_hours:.1f}h of signup")]
        return []