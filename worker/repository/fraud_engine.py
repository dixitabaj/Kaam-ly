# fraud_engine.py
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional


@dataclass
class FraudSignal:
    name: str
    score: int
    reason: str


@dataclass
class FraudResult:
    user_id: str
    total_score: int
    risk_level: str
    signals: List[FraudSignal] = field(default_factory=list)


class FraudScorer:
    def __init__(self, db):
        self.db = db

    async def score(self, user_id: str) -> FraudResult:
        signals: List[FraudSignal] = []

        signals += await self._check_cancellations(user_id)
        signals += await self._check_payment_failures(user_id)
        signals += await self._check_review_spam(user_id)
        signals += await self._check_rapid_signups(user_id)
        signals += await self._check_ip_signals(user_id)
        signals += await self._check_rating_spike(user_id)
        signals += await self._check_fraud_ring(user_id)
        signals += await self._check_refund_abuse(user_id)

        total = sum(s.score for s in signals)
        risk_level = self._risk_level(total)

        result = FraudResult(
            user_id=user_id,
            total_score=total,
            risk_level=risk_level,
            signals=signals,
        )

        await self.db.fraud_reports.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "total_score": total,
                "risk_level": risk_level,
                "signals": [vars(s) for s in signals],
                "evaluated_at": datetime.utcnow(),
            }},
            upsert=True,
        )

        return result

    async def _check_cancellations(self, user_id: str) -> List[FraudSignal]:
        signals = []
        since = datetime.utcnow() - timedelta(days=30)
        count = await self.db.tasks.count_documents({
            "user_id": user_id,
            "status": "cancelled",
            "cancelled_at": {"$gte": since},
        })
        if count >= 10:
            signals.append(FraudSignal("cancellations", 40, f"{count} cancellations in 30 days"))
        elif count >= 5:
            signals.append(FraudSignal("cancellations", 20, f"{count} cancellations in 30 days"))
        return signals

    async def _check_payment_failures(self, user_id: str) -> List[FraudSignal]:
        signals = []
        since = datetime.utcnow() - timedelta(days=7)
        count = await self.db.payments.count_documents({
            "user_id": user_id,
            "status": "failed",
            "failed_at": {"$gte": since},
        })
        if count >= 5:
            signals.append(FraudSignal("payment_failures", 35, f"{count} payment failures in 7 days"))
        elif count >= 2:
            signals.append(FraudSignal("payment_failures", 15, f"{count} payment failures in 7 days"))
        return signals

    async def _check_review_spam(self, user_id: str) -> List[FraudSignal]:
        signals = []
        since = datetime.utcnow() - timedelta(hours=24)
        count = await self.db.reviews.count_documents({
            "user_id": user_id,
            "createdAt": {"$gte": since},
        })
        if count >= 8:
            signals.append(FraudSignal("review_spam", 30, f"{count} reviews in 24 hours"))
        return signals

    async def _check_rating_spike(self, user_id: str) -> List[FraudSignal]:
        signals = []

        for window_hours, threshold, score, label in [
            (1, 5, 40, "1h"),
            (24, 15, 25, "24h"),
        ]:
            since = datetime.utcnow() - timedelta(hours=window_hours)
            burst = await self.db.reviews.count_documents({
                "target_user_id": user_id,
                "stars": 5,
                "createdAt": {"$gte": since},
            })
            if burst >= threshold:
                signals.append(FraudSignal("rating_spike_received", score,
                    f"{burst} five-star reviews received in {label}"))
                break

        since_24h = datetime.utcnow() - timedelta(hours=24)
        given = await self.db.reviews.count_documents({
            "user_id": user_id,
            "stars": 5,
            "createdAt": {"$gte": since_24h},
        })
        if given >= 10:
            signals.append(FraudSignal("rating_spike_given", 35,
                f"{given} five-star reviews submitted in 24h"))
        elif given >= 5:
            signals.append(FraudSignal("rating_spike_given", 20,
                f"{given} five-star reviews submitted in 24h"))

        # Only check verified_purchase if the field exists in the collection
        sample = await self.db.reviews.find_one({})
        if sample and "verified_purchase" in sample:
            unverified = await self.db.reviews.count_documents({
                "user_id": user_id,
                "verified_purchase": False,
                "createdAt": {"$gte": since_24h},
            })
            if unverified >= 3:
                signals.append(FraudSignal("unverified_reviews", 25,
                    f"{unverified} reviews with no purchase history in 24h"))

        return signals

    async def _check_rapid_signups(self, user_id: str) -> List[FraudSignal]:
        signals = []
        # Check both customers and workers collections
        user = await self.db.customers.find_one({"_id": user_id}) \
            or await self.db.workers.find_one({"_id": user_id})
        if not user:
            return signals

        created_at = user.get("createdAt") or user.get("created_at")
        if not created_at:
            return signals

        account_age = datetime.utcnow() - created_at
        if account_age.total_seconds() < 7200:
            task_count = await self.db.tasks.count_documents({"user_id": user_id})
            if task_count >= 5:
                signals.append(FraudSignal(
                    "rapid_activity", 25,
                    f"Account {account_age.seconds // 60}m old with {task_count} tasks",
                ))
        return signals

    async def _check_ip_signals(self, user_id: str) -> List[FraudSignal]:
        signals = []
        record = await self.db.user_ips.find_one({"user_id": user_id})
        if not record:
            return signals

        since = datetime.utcnow() - timedelta(hours=24)
        recent_ips = [
            entry["ip"]
            for entry in record.get("ip_log", [])
            if entry.get("at") and entry["at"] >= since
        ]
        unique_recent = len(set(recent_ips))
        if unique_recent >= 5:
            signals.append(FraudSignal("ip_hopping", 30, f"{unique_recent} different IPs in 24h"))

        last_ip: Optional[str] = record.get("last_ip")
        if last_ip:
            other_accounts = await self.db.user_ips.count_documents({
                "ips": last_ip,
                "user_id": {"$ne": user_id},
            })
            if other_accounts >= 3:
                signals.append(FraudSignal(
                    "shared_ip", 35,
                    f"IP {last_ip} shared with {other_accounts} other accounts",
                ))

            ip_meta = await self.db.ip_reputation.find_one({"ip": last_ip})
            if ip_meta and ip_meta.get("is_proxy"):
                signals.append(FraudSignal("proxy_ip", 20, f"IP {last_ip} flagged as proxy/VPN"))

        return signals

    async def _check_fraud_ring(self, user_id: str) -> List[FraudSignal]:
        signals = []

        # Check customers and workers for device_id
        user = await self.db.customers.find_one({"_id": user_id}, {"device_id": 1}) \
            or await self.db.workers.find_one({"_id": user_id}, {"device_id": 1})

        device_id = user.get("device_id") if user else None
        if device_id:
            same_device_customers = await self.db.customers.count_documents({
                "device_id": device_id,
                "_id": {"$ne": user_id},
            })
            same_device_workers = await self.db.workers.count_documents({
                "device_id": device_id,
                "_id": {"$ne": user_id},
            })
            same_device = same_device_customers + same_device_workers
            if same_device >= 3:
                signals.append(FraudSignal("shared_device", 40,
                    f"Device fingerprint shared with {same_device} other accounts"))
            elif same_device >= 1:
                signals.append(FraudSignal("shared_device", 20,
                    f"Device fingerprint shared with {same_device} other account(s)"))

        reviewed_ids = await self.db.reviews.distinct(
            "target_user_id", {"user_id": user_id}
        )
        if reviewed_ids:
            mutual_reviewers = await self.db.reviews.count_documents({
                "user_id": {"$in": reviewed_ids},
                "target_user_id": user_id,
            })
            if mutual_reviewers >= 3:
                signals.append(FraudSignal("review_ring", 45,
                    f"{mutual_reviewers} accounts have mutually reviewed each other"))

        user_record = await self.db.customers.find_one({"_id": user_id}, {"createdAt": 1}) \
            or await self.db.workers.find_one({"_id": user_id}, {"createdAt": 1})
        ip_record = await self.db.user_ips.find_one({"user_id": user_id}, {"last_ip": 1})

        if user_record and ip_record:
            signup_ip = ip_record.get("last_ip")
            created_at = user_record.get("createdAt") or user_record.get("created_at")
            if signup_ip and created_at:
                window_start = created_at - timedelta(minutes=30)
                window_end = created_at + timedelta(minutes=30)
                nearby_customers = await self.db.customers.count_documents({
                    "signup_ip": signup_ip,
                    "_id": {"$ne": user_id},
                    "createdAt": {"$gte": window_start, "$lte": window_end},
                })
                nearby_workers = await self.db.workers.count_documents({
                    "signup_ip": signup_ip,
                    "_id": {"$ne": user_id},
                    "createdAt": {"$gte": window_start, "$lte": window_end},
                })
                nearby_signups = nearby_customers + nearby_workers
                if nearby_signups >= 3:
                    signals.append(FraudSignal("coordinated_signup", 35,
                        f"{nearby_signups} accounts created from same IP within 30 min"))

        return signals

    async def _check_refund_abuse(self, user_id: str) -> List[FraudSignal]:
        signals = []

        since_90d = datetime.utcnow() - timedelta(days=90)
        since_7d = datetime.utcnow() - timedelta(days=7)

        total_refunds_90d = await self.db.refunds.count_documents({
            "requester_id": user_id,
            "created_at": {"$gte": since_90d},
        })
        resolved_reports_90d = await self.db.reports.count_documents({
            "reporterId": user_id,
            "status": "resolved",
            "refundStatus": "refunded",
            "createdAt": {"$gte": since_90d},
        })
        total_actions_90d = total_refunds_90d + resolved_reports_90d

        if total_actions_90d >= 5:
            refund_rate = total_refunds_90d / total_actions_90d
            if refund_rate >= 0.6:
                signals.append(FraudSignal(
                    "high_refund_rate", 40,
                    f"{refund_rate:.0%} refund rate over 90 days ({total_refunds_90d}/{total_actions_90d})"
                ))
            elif refund_rate >= 0.35:
                signals.append(FraudSignal(
                    "high_refund_rate", 20,
                    f"{refund_rate:.0%} refund rate over 90 days ({total_refunds_90d}/{total_actions_90d})"
                ))

        recent_refunds = await self.db.refunds.count_documents({
            "requester_id": user_id,
            "created_at": {"$gte": since_7d},
        })
        if recent_refunds >= 5:
            signals.append(FraudSignal(
                "refund_velocity", 30,
                f"{recent_refunds} refunds in the last 7 days"
            ))

        pipeline = [
            {"$match": {
                "requester_id": user_id,
                "status": "refunded",
                "created_at": {"$gte": since_90d},
            }},
            {"$group": {"_id": "$task_id", "count": {"$sum": 1}}},
            {"$match": {"count": {"$gte": 3}}}
        ]
        repeat_tasks = await self.db.refunds.aggregate(pipeline).to_list(None)
        if repeat_tasks:
            worst = max(repeat_tasks, key=lambda x: x["count"])
            signals.append(FraudSignal(
                "repeat_task_refund", 35,
                f"Task {worst['_id']} refunded {worst['count']} times in 90 days"
            ))

        return signals

    @staticmethod
    def _risk_level(score: int) -> str:
        if score >= 80:
            return "suspend"
        if score >= 50:
            return "restrict"
        if score >= 25:
            return "monitor"
        return "clean"