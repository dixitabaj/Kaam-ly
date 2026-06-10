from fastapi import HTTPException
from bson import ObjectId
from statistics import mean
from datetime import datetime
from ..config.database import collection_reviews, collection_worker, collection_task


def create_review(review_dict: dict):
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

    if task_id:
        try:
            task = collection_task.find_one({"_id": ObjectId(task_id)})
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid taskId format")
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.get("userId") != customer_id:
            raise HTTPException(status_code=403, detail="You cannot review this task")

    query = {"user_id": customer_id, "workerId": worker_id}
    if task_id:
        query["taskId"] = task_id

    existing = collection_reviews.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="You already reviewed this task")

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

    # ── Update worker average rating in DB ────────────────────────────────────
    update_worker_rating(worker_id)

    # ── Feed rating back into LinUCB model ────────────────────────────────────
    try:
        from ..router.recommend_router import (
            linucb,
            TASK_CATEGORIES,
            build_feature_vector,
            refresh_global_theta,
            save_model,
        )

        task_type = None
        if task_id:
            task = collection_task.find_one({"_id": ObjectId(task_id)})
            if task:
                task_type = task.get("taskType") or task.get("task_type")

        if linucb and task_type and task_type in TASK_CATEGORIES:
            worker = (
                collection_worker.find_one({"email": worker_id}) or
                collection_worker.find_one({"_id": worker_id})
            )
            if worker:
                arm    = TASK_CATEGORIES.index(task_type)
                x, _   = build_feature_vector(worker, task_type)
                reward = int(stars) / 5.0

                linucb.update(arm, x, reward)
                refresh_global_theta()
                save_model()
                print(f"✅ LinUCB updated — arm={arm} task={task_type} reward={reward:.2f}")
        else:
            print(f"⚠️  LinUCB skipped — task_type='{task_type}' not in TASK_CATEGORIES")

    except Exception as e:
        print(f"⚠️  LinUCB feedback update failed (non-critical): {e}")

    return result


def find_reviews_by_worker(workerId: str):
    reviews = list(collection_reviews.find({"workerId": workerId}))
    for r in reviews:
        r["id"]      = str(r["_id"])
        r["_id"]     = str(r["_id"])
        r["rating"]  = r.get("stars", 0)
        r["comment"] = r.get("text", "")
    return reviews


def calculate_average_rating(workerId: str):
    reviews = list(collection_reviews.find({"workerId": workerId}))
    if not reviews:
        return 0
    scores = [r.get("stars") or r.get("rating") or 0 for r in reviews]
    return round(mean(scores), 1)


def update_worker_rating(workerId: str):
    avg_rating = calculate_average_rating(workerId)
    updated = collection_worker.update_one(
        {"_id": (workerId)},
        {"$set": {"ratings": avg_rating}}
    )
    if updated.matched_count == 0:
        collection_worker.update_one(
            {"_id": workerId},
            {"$set": {"ratings": avg_rating}}
        )


def find_reviews_by_customer(customer_id: str):
    reviews = list(collection_reviews.find({"user_id": customer_id}))
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