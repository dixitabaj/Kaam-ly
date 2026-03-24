from fastapi import HTTPException
from bson import ObjectId
from statistics import mean
from datetime import datetime
from ..config.database import collection_reviews, collection_worker, collection_task


def create_review(review_dict: dict):
    # ── Normalize incoming fields ─────────────────────────────────────────────
    # Support both camelCase (frontend) and snake_case (DB) field names
    customer_id = review_dict.get("customerId") or review_dict.get("user_id")
    worker_id   = review_dict.get("workerId")   or review_dict.get("worker_id")
    task_id     = review_dict.get("taskId")     or review_dict.get("task_id")
    stars       = review_dict.get("rating")     or review_dict.get("stars")
    text        = review_dict.get("comment")    or review_dict.get("text") or ""

    if not worker_id:
        raise HTTPException(status_code=400, detail="workerId is required")
    if not stars:
        raise HTTPException(status_code=400, detail="rating is required")
    if not customer_id:
        raise HTTPException(status_code=400, detail="customerId is required")

    # ── Task validation (only if taskId provided) ─────────────────────────────
    if task_id:
        try:
            task = collection_task.find_one({"_id": ObjectId(task_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid taskId format")

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if task.get("userId") != customer_id:
            raise HTTPException(status_code=403, detail="You cannot review this task")

    # ── Duplicate check ───────────────────────────────────────────────────────
    query = {"user_id": customer_id, "workerId": worker_id}
    if task_id:
        query["taskId"] = task_id

    existing = collection_reviews.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this task")

    # ── Build doc matching your DB schema ─────────────────────────────────────
    doc = {
        "workerId":  worker_id,
        "user_id":   customer_id,
        "stars":     int(stars),
        "text":      text,
        "createdAt": review_dict.get("createdAt") or datetime.utcnow(),
    }
    if task_id:
        doc["taskId"] = task_id

    result = collection_reviews.insert_one(doc)

    # ── Update worker average rating ──────────────────────────────────────────
    update_worker_rating(worker_id)

    return result


def find_reviews_by_worker(workerId: str):
    reviews = list(collection_reviews.find({"workerId": workerId}))
    for r in reviews:
        r["id"]    = str(r["_id"])
        r["_id"]   = str(r["_id"])
        # Normalize to consistent shape for frontend
        r["rating"] = r.get("stars", 0)
        r["comment"] = r.get("text", "")
    return reviews


def calculate_average_rating(workerId: str):
    reviews = list(collection_reviews.find({"workerId": workerId}))
    if not reviews:
        return 0
    avg = mean([r.get("stars", 0) for r in reviews])
    return round(avg, 1)


def update_worker_rating(workerId: str):
    avg_rating = calculate_average_rating(workerId)
    collection_worker.update_one(
        {"_id": workerId},
        {"$set": {"ratings": avg_rating}}
    )


def find_reviews_by_customer(customer_id: str):
    # Try both ObjectId and string for customer lookup
    reviews = []

    # First try string match (your DB stores user_id as string)
    reviews = list(collection_reviews.find({"user_id": customer_id}))

    # Fallback: try ObjectId
    if not reviews:
        try:
            oid = ObjectId(customer_id)
            reviews = list(collection_reviews.find({"user_id": oid}))
        except Exception:
            pass

    for r in reviews:
        r["_id"]     = str(r["_id"])
        r["rating"]  = r.get("stars", 0)
        r["comment"] = r.get("text", "")
        if "customer_id" in r:
            r["customer_id"] = str(r["customer_id"])
        if "worker_id" in r:
            r["worker_id"] = str(r["worker_id"])

    return reviews