from fastapi import APIRouter
from datetime import datetime, timedelta
from bson import ObjectId
from ..repository.workerRepo import deleteWorkerById, verifyWorkerSkill, verifyWorkerFace
from ..schemas.schemas import StatusUpdate
from ..config.database import collection, collection_worker, collection_task, collection_reports

router = APIRouter(tags=["admin-dashboard"])

# ── assume these are imported from your db setup ──────────────────────────────
# from database import (
#     collection,          # customers
#     collection_worker,   # workers
#     collection_task,     # tasks
#     collection_reports,  # reports
# )

def serialize(doc):
    """Convert ObjectId fields to strings."""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id", ""))
    return doc


# ── 1. ESCROW SUMMARY ─────────────────────────────────────────────────────────
# Total NPR currently held in escrow vs already released
@router.get("/api/admin/escrow/summary")
def get_escrow_summary():
    result = list(collection_task.aggregate([
        {
            "$match": {
                "escrow_status": {"$in": ["held", "released"]},
                "payment_status": "paid"
            }
        },
        {
            "$group": {
                "_id":           "$escrow_status",
                "total_amount":  {"$sum": "$totalCost"},
                "task_count":    {"$sum": 1}
            }
        }
    ]))

    summary = {"held": {"amount": 0, "count": 0}, "released": {"amount": 0, "count": 0}}
    for row in result:
        key = row["_id"]
        if key in summary:
            summary[key]["amount"] = round(row["total_amount"], 2)
            summary[key]["count"]  = row["task_count"]

    summary["total_liability"] = round(summary["held"]["amount"], 2)
    return summary


# ── 2. LOW-RATED WORKERS ──────────────────────────────────────────────────────
# Workers whose average rating is below threshold (default 3.5)
@router.get("/api/admin/workers/low-rated")
def get_low_rated_workers(threshold: float = 3.5, limit: int = 10):
    result = list(collection_task.aggregate([
        # Only look at completed tasks that have a rating
        {"$match":  {"status": "completed", "rating": {"$exists": True, "$ne": None}}},
        {"$group":  {
            "_id":          "$assignedWorkerId",
            "avg_rating":   {"$avg": "$rating"},
            "total_tasks":  {"$sum": 1}
        }},
        {"$match":  {"avg_rating": {"$lt": threshold}, "total_tasks": {"$gte": 3}}},  # min 3 tasks to be fair
        {"$sort":   {"avg_rating": 1}},
        {"$limit":  limit},
    ]))

    workers = []
    for row in result:
        worker = collection_worker.find_one(
            {"_id": ObjectId(row["_id"])},
            {"firstName": 1, "lastName": 1, "email": 1, "taskType": 1, "status": 1}
        )
        if worker:
            workers.append({
                "id":          str(worker["_id"]),
                "name":        f"{worker.get('firstName','')} {worker.get('lastName','')}".strip(),
                "email":       worker.get("email", ""),
                "taskType":    worker.get("taskType", ""),
                "status":      worker.get("status", "active"),
                "avg_rating":  round(row["avg_rating"], 2),
                "total_tasks": row["total_tasks"],
            })
    return {"threshold": threshold, "workers": workers}


# ── 3. RECENT TRANSACTIONS ────────────────────────────────────────────────────
# Last N paid tasks — useful for fraud spotting
@router.get("/api/admin/transactions/recent")
def get_recent_transactions(limit: int = 15):
    tasks = list(collection_task.find(
        {"payment_status": "paid"},
        {
            "selectedService": 1, "taskType": 1, "totalCost": 1, "final_price": 1,
            "payment_method": 1, "esewa_ref_id": 1, "customerId": 1,
            "assignedWorkerId": 1, "updatedAt": 1, "paid_at": 1,
            "escrow_status": 1, "location": 1
        }
    ).sort("updatedAt", -1).limit(limit))

    result = []
    for task in tasks:
        tid        = str(task.pop("_id"))
        cid        = task.get("customerId", "")
        wid        = task.get("assignedWorkerId", "")
        amount     = task.get("final_price") or task.get("totalCost") or 0

        # Fetch names inline (small N, acceptable)
        customer = collection.find_one({"_id": ObjectId(cid)}, {"firstName": 1, "lastName": 1}) if cid else None
        worker   = collection_worker.find_one({"_id": ObjectId(wid)}, {"firstName": 1, "lastName": 1}) if wid else None

        result.append({
            "id":             tid,
            "service":        task.get("selectedService") or task.get("taskType") or "Service",
            "amount":         round(amount, 2),
            "payment_method": task.get("payment_method", "—"),
            "esewa_ref_id":   task.get("esewa_ref_id", ""),
            "escrow_status":  task.get("escrow_status", ""),
            "location":       task.get("location", ""),
            "paid_at":        str(task.get("paid_at") or task.get("updatedAt") or ""),
            "customer_name":  f"{customer.get('firstName','')} {customer.get('lastName','')}".strip() if customer else cid,
            "worker_name":    f"{worker.get('firstName','')} {worker.get('lastName','')}".strip() if worker else wid,
        })
    return {"transactions": result}


# ── 4. UNASSIGNED TASKS (24h+) ────────────────────────────────────────────────
# Bookings sitting in pending with no worker assigned
@router.get("/api/admin/tasks/unassigned")
def get_unassigned_tasks(hours: int = 24, limit: int = 20):
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    tasks = list(collection_task.find(
        {
            "status":           "pending",
            "assignedWorkerId": {"$in": [None, ""]},
            "createdAt":        {"$lte": cutoff}
        },
        {
            "selectedService": 1, "taskType": 1, "totalCost": 1,
            "customerId": 1, "location": 1, "serviceDate": 1, "createdAt": 1
        }
    ).sort("createdAt", 1).limit(limit))   # oldest first

    result = []
    for task in tasks:
        tid      = str(task.pop("_id"))
        cid      = task.get("customerId", "")
        created  = task.get("createdAt")
        hours_waiting = round((datetime.utcnow() - created).total_seconds() / 3600, 1) if created else None

        customer = collection.find_one({"_id": ObjectId(cid)}, {"firstName": 1, "lastName": 1, "phone": 1}) if cid else None

        result.append({
            "id":            tid,
            "service":       task.get("selectedService") or task.get("taskType") or "Service",
            "location":      task.get("location", ""),
            "service_date":  str(task.get("serviceDate", "")),
            "created_at":    str(created or ""),
            "hours_waiting": hours_waiting,
            "amount":        task.get("totalCost", 0),
            "customer_name": f"{customer.get('firstName','')} {customer.get('lastName','')}".strip() if customer else cid,
            "customer_phone":customer.get("phone", "") if customer else "",
        })
    return {"threshold_hours": hours, "count": len(result), "tasks": result}


# ── 5. REPEAT OFFENDERS ───────────────────────────────────────────────────────
# Users (customer or worker) with 2+ reports against them
@router.get("/api/admin/users/repeat-offenders")
def get_repeat_offenders(min_reports: int = 2, limit: int = 10):
    result = list(collection_reports.aggregate([
        {"$match":  {"status": {"$in": ["pending", "resolved"]}}},  # exclude declined (likely false reports)
        {"$group":  {
            "_id":          "$reportedId",
            "reported_type":"$first: $reportedType",   # customer or worker
            "report_count": {"$sum": 1},
            "pending":      {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
            "resolved":     {"$sum": {"$cond": [{"$eq": ["$status", "resolved"]}, 1, 0]}},
            "reasons":      {"$push": "$reason"},
            "latest":       {"$max": "$createdAt"},
        }},
        {"$match":  {"report_count": {"$gte": min_reports}}},
        {"$sort":   {"report_count": -1}},
        {"$limit":  limit},
    ]))

    # Fix the $first syntax — it needs to be in the $group stage
    result = list(collection_reports.aggregate([
        {"$match":  {"status": {"$in": ["pending", "resolved"]}}},
        {"$group":  {
            "_id":           "$reportedId",
            "reported_type": {"$first": "$reportedType"},
            "report_count":  {"$sum": 1},
            "pending":       {"$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}},
            "resolved":      {"$sum": {"$cond": [{"$eq": ["$status", "resolved"]}, 1, 0]}},
            "reasons":       {"$push": "$reason"},
            "latest":        {"$max": "$createdAt"},
        }},
        {"$match":  {"report_count": {"$gte": min_reports}}},
        {"$sort":   {"report_count": -1}},
        {"$limit":  limit},
    ]))

    offenders = []
    for row in result:
        uid  = row["_id"]
        role = row.get("reported_type", "")

        profile = None
        if role == "worker":
            profile = collection_worker.find_one(
                {"_id": ObjectId(uid)},
                {"firstName": 1, "lastName": 1, "email": 1, "status": 1, "taskType": 1}
            )
        elif role == "customer":
            profile = collection.find_one(
                {"_id": ObjectId(uid)},
                {"firstName": 1, "lastName": 1, "email": 1, "status": 1}
            )

        offenders.append({
            "id":           uid,
            "role":         role,
            "name":         f"{profile.get('firstName','')} {profile.get('lastName','')}".strip() if profile else uid,
            "email":        profile.get("email", "") if profile else "",
            "status":       profile.get("status", "") if profile else "",
            "taskType":     profile.get("taskType", "") if profile else "",
            "report_count": row["report_count"],
            "pending":      row["pending"],
            "resolved":     row["resolved"],
            "reasons":      list(set(row["reasons"])),   # deduplicated
            "latest_report":str(row.get("latest", "")),
        })
    return {"min_reports": min_reports, "offenders": offenders}


# ── 6. CUSTOMER RETENTION ─────────────────────────────────────────────────────
# How many customers booked more than once
@router.get("/api/admin/customers/retention")
def get_customer_retention():
    result = list(collection_task.aggregate([
        {"$match":  {"status": {"$in": ["completed", "paid"]}}},
        {"$group":  {"_id": "$customerId", "booking_count": {"$sum": 1}}},
        {"$group":  {
            "_id":   "$booking_count",
            "users": {"$sum": 1}
        }},
        {"$sort":   {"_id": 1}},
    ]))

    total_customers  = collection.count_documents({})
    active_customers = sum(r["users"] for r in result)
    repeat_customers = sum(r["users"] for r in result if r["_id"] >= 2)
    one_timers       = sum(r["users"] for r in result if r["_id"] == 1)
    retention_rate   = round((repeat_customers / active_customers * 100), 1) if active_customers else 0

    return {
        "total_customers":   total_customers,
        "active_customers":  active_customers,    # at least 1 completed task
        "one_time_customers":one_timers,
        "repeat_customers":  repeat_customers,    # 2+ completed tasks
        "retention_rate":    retention_rate,       # % who came back
        "breakdown":         [{"bookings": r["_id"], "customers": r["users"]} for r in result],
    }


# ── 7. AVG TASK COMPLETION TIME ───────────────────────────────────────────────
# How long from task created → completed on average
@router.get("/api/admin/tasks/completion-time")
def get_avg_completion_time():
    result = list(collection_task.aggregate([
        {
            "$match": {
                "status":    "completed",
                "createdAt": {"$exists": True},
                "updatedAt": {"$exists": True},
            }
        },
        {
            "$addFields": {
                "duration_hours": {
                    "$divide": [
                        {"$subtract": ["$updatedAt", "$createdAt"]},
                        3600000   # ms → hours
                    ]
                }
            }
        },
        {
            "$group": {
                "_id":          None,
                "avg_hours":    {"$avg": "$duration_hours"},
                "min_hours":    {"$min": "$duration_hours"},
                "max_hours":    {"$max": "$duration_hours"},
                "total_tasks":  {"$sum": 1},
            }
        }
    ]))

    if not result:
        return {"avg_hours": 0, "min_hours": 0, "max_hours": 0, "total_tasks": 0}

    r = result[0]
    return {
        "avg_hours":   round(r["avg_hours"],  1),
        "min_hours":   round(r["min_hours"],  1),
        "max_hours":   round(r["max_hours"],  1),
        "total_tasks": r["total_tasks"],
        "avg_display": f"{round(r['avg_hours'])}h" if r["avg_hours"] >= 1 else f"{round(r['avg_hours']*60)}m",
    }

# ── 8. PENDING ACTIVITIES FOR ADMIN DASHBOARD ───────────────────────────
@router.get("/admin/pending")
def get_pending_activities():

    # 1️⃣ Workers waiting verification
    pending_verifications = collection_worker.count_documents({
        "status": "pending"
    })

    # 2️⃣ Reports waiting admin action
    pending_reports = collection_reports.count_documents({
        "status": "pending"
    })

    # 3️⃣ Overdue tasks (ongoing tasks that exceeded estimated duration)
    now = datetime.utcnow()

    overdue_tasks = collection_task.count_documents({
        "status": "ongoing",
        "estimatedCompletion": {"$lt": now}
    })

    # 4️⃣ Tasks completed but payment not released to worker
    pending_worker_payments = collection_task.count_documents({
        "status": "completed",
        "payment_status": "paid",
        "escrow_status": "held"
    })

    return {
        "pending_verifications": pending_verifications,
        "pending_reports": pending_reports,
        "overdue_tasks": overdue_tasks,
        "pending_worker_payments": pending_worker_payments
    }