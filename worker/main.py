from fastapi import FastAPI, APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Request




from .router import registerCustomer, refund, updateProfile, skillVerification, faceVerify, adminPayout, registerWorker, login, otp, createTask, chat, duplicateCheck, faceVerify, recommend_router, esewaVerify, predictTask, review_route, search_router, image_classify_router, report, adminReviewAI, pendingActivities, notifications
from .schemas.schemas import WorkerCreateSchema, WorkerResponseSchema, WorkerStatsResponse
from worker.config.database import collection, collection_worker, chat_collection, collection_reviews, collection_task, collection_reports
from .services.hashing import Hash
from fastapi.middleware.cors import CORSMiddleware
from .services import auth
from .manager.websocket_manager import manager
import asyncio
import json
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from .config import database
# Create FastAPI app instance
app = FastAPI()

# Add CORS middleware to allow requests from frontend apps
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from datetime import datetime
from bson import ObjectId



@app.get("/api/worker/category/{category}/subcategory/{subcategory}")
async def get_workers_by_subcategory(category: str, subcategory: str):
    try:
        # Find workers where taskType matches category AND skills contain subcategory
        workers = list(collection_worker.find({
            "taskType": category.lower(),
            "skills.name": {"$regex": subcategory, "$options": "i"}  # Case-insensitive match
        }))
        
        if not workers:
            return []
        
        return workers
    except Exception as e:
        print(f"Error fetching workers by subcategory: {e}")
        raise HTTPException(status_code=500, detail=str(e))
 
@app.get("/api/noOfComlpetedJobs/{worker_id}", tags=["dashboard"])
async def getNoOfCompletedJobs(worker_id:str):
    try:
        worker=collection_worker.find_one({
            "_id":(worker_id)
        })
        return worker['noOfCompletedTask']
    except Exception as e:
        print(f"Error fetching workers: {e}")
        raise HTTPException(status_code=500, detail=str(e))     

@app.get("/api/recentReviews/{worker_id}")
async def getRecentReviewsByWorker(worker_id):
    try:
        worker_id=collection_worker.find_one({
            "_id":ObjectId(worker_id)
        })
        review=collection_reviews.find_one({
            "workerId":worker_id
        })   
        return review
    except Exception as e:
        print(f"Error fetching workers: {e}")
        raise HTTPException(status_code=500, detail=str(e))     

@app.post("/api/updateCompleteedTask/{worker_id}/{task_id}")
async def updateCompletedTask(worker_id, task_id):
    try:
        worker=collection_worker.find_one(
            {
                "_id":worker_id,
            }
        )
        task=collection_task.find_one({
            "_id":task_id
        })
        task_status=task['status']
        print(task_status)
        if task_status=='completed':
            collection_worker.update_one(
                {
                    "_id":worker_id},
                     {"$inc": {"noOfCompletedTasks": 1}}
            )
    except Exception as e:
        print(f"Error fetching workers: {e}")
        raise HTTPException(status_code=500, detail=str(e))   


@app.websocket("/ws/task-updates/{user_id}")
async def task_websocket(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            await asyncio.sleep(25)  # ping every 25 seconds
            await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        await manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"⚠️ Task WS error for {user_id}: {e}")
        await manager.disconnect(user_id, websocket)





from bson import ObjectId
import json
from datetime import datetime

# Add this helper at the top of main.py
import json
from datetime import datetime
from bson import ObjectId

class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

@app.patch("/api/taskStatus/update/{task_id}")
async def update_task_status(task_id: str, body: dict):
    try:
        status = body.get("status")
        task = collection_task.find_one({"_id": ObjectId(task_id)})

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        # ── Escrow guard: block starting task if payment not secured ──
        if status == "in_progress":
            if task.get("payment_status") != "paid":
                raise HTTPException(
                    status_code=400,
                    detail="Customer has not paid yet. Task cannot be started."
                )
            if task.get("escrow_status") != "held":
                raise HTTPException(
                    status_code=400,
                    detail="Payment is not secured in escrow. Task cannot be started."
                )

        result = collection_task.find_one_and_update(
            {"_id": ObjectId(task_id)},
            {"$set": {
                "status": status,
                # stamp started_at when worker begins
                **({"started_at": datetime.utcnow()} if status == "in_progress" else {})
            }},
            return_document=True
        )

        user_id   = result.get("userId")
        worker_id = result.get("assignedWorkerId")

        notification = json.dumps({
            "type":   "task_status",
            "taskId": task_id,
            "status": status,
        })

        await manager.send_to_user(user_id, notification)
        await manager.send_to_user(worker_id, notification)

        return {"message": "Status updated", "status": status}

    except HTTPException:
        raise  # re-raise our own errors cleanly
    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────────────────────────
# REPLACE your existing get_worker_stats function with this.
# Only ONE thing changed from your original:
#   def get_worker_stats(worker_id: str)   ← was wrong (didn't match path)
#   def get_worker_stats(workerId: str)    ← correct (matches {workerId})
#
# Everything else is IDENTICAL to your original code.
# ─────────────────────────────────────────────────────────────────

from datetime import datetime, timedelta

def get_date_range(option: str):
    now = datetime.utcnow()
    
    if option == "today":
        start = datetime(now.year, now.month, now.day)
        end = start + timedelta(days=1)
    elif option == "tomorrow":
        start = datetime(now.year, now.month, now.day) + timedelta(days=1)
        end = start + timedelta(days=1)
    elif option == "next_week":
        # next 7 days from today
        start = datetime(now.year, now.month, now.day)
        end = start + timedelta(days=7)
    else:
        raise ValueError("Invalid option")
    
    return start, end
from collections import defaultdict
from datetime import datetime

from collections import defaultdict
from datetime import datetime, timedelta
from dateutil import parser as dateutil_parser

@app.get("/api/stats/{workerId}")
def get_worker_stats(workerId: str):
    try:
        now = datetime.utcnow()

        # ===== TASKS =====
        tasks = list(collection_task.find({"assignedWorkerId": workerId}))
        total_tasks = len(tasks)
        tasks_completed  = len([t for t in tasks if t.get("status", "").lower() == "completed"])
        tasks_pending    = len([t for t in tasks if t.get("status", "").lower() == "pending"])
        tasks_accepted   = len([t for t in tasks if t.get("status", "").lower() == "accepted"])
        tasks_inprogress = len([t for t in tasks if t.get("status", "").lower() == "in_progress"])
        tasks_cancelled  = len([t for t in tasks if t.get("status", "").lower() == "cancelled"])

        completion_rate  = (tasks_completed / total_tasks * 100) if total_tasks > 0 else 0
        total_earnings   = sum(t.get("totalCost", 0) for t in tasks if t.get("status", "").lower() == "completed")

        # ===== REVIEWS =====
        reviews        = list(collection_reviews.find({"workerId": workerId}))
        total_reviews  = len(reviews)
        average_rating = (sum(r.get("stars", 0) for r in reviews) / total_reviews) if total_reviews > 0 else 0
        recent_review  = list(collection_reviews.find({"workerId": workerId}).sort("createdAt", -1).limit(5))

        # ===== HELPER: parse serviceDate safely =====
        def parse_service_date(service_date):
            if isinstance(service_date, datetime):
                return service_date
            if isinstance(service_date, str):
                try:
                    return dateutil_parser.parse(service_date)
                except Exception as ex:
                    print(f"❌ Failed to parse date: '{service_date}' → {ex}")
                    return None
            return None

        # ===== TASKS BY DATE RANGE =====
        def fetch_tasks_for_range(start: datetime, end: datetime):
            all_tasks = collection_task.find({"assignedWorkerId": workerId})
            result = []
            for t in all_tasks:
                service_date = parse_service_date(t.get("serviceDate"))
                if not service_date:
                    continue
                if start <= service_date < end:
                    result.append({
                        "_id": str(t["_id"]),
                        "title": t.get("taskName"),
                        "status": t.get("status"),
                        "serviceDate": service_date.strftime("%Y-%m-%d %H:%M:%S"),
                        "totalCost": t.get("totalCost", 0)
                    })
            return result

        # ===== DATE RANGES =====
        today_start    = datetime(now.year, now.month, now.day)
        tomorrow_start = today_start + timedelta(days=1)
        next_week_end  = today_start + timedelta(days=7)

        tasks_today     = fetch_tasks_for_range(today_start, tomorrow_start)
        tasks_tomorrow  = fetch_tasks_for_range(tomorrow_start, tomorrow_start + timedelta(days=1))
        tasks_next_week = fetch_tasks_for_range(today_start, next_week_end)

        # ===== EARNINGS GRAPH =====
        daily_earnings = defaultdict(float)
        for t in tasks:
            if t.get("status", "").lower() == "completed":
                service_date = parse_service_date(t.get("serviceDate"))
                if service_date:
                    date_str = service_date.strftime("%Y-%m-%d")
                    daily_earnings[date_str] += t.get("totalCost", 0)

        earnings_graph = [{"date": d, "earned": daily_earnings[d]} for d in sorted(daily_earnings)]

        # ===== RETURN =====
        return JSONResponse(
            content=json.loads(json.dumps({
                "tasksCompleted":  tasks_completed,
                "tasksPending":    tasks_pending,
                "tasksAccepted":   tasks_accepted,
                "tasksInProgress": tasks_inprogress,
                "tasksCancelled":  tasks_cancelled,
                "totalTasks":      total_tasks,
                "completionRate":  round(completion_rate, 2),
                "totalEarnings":   total_earnings,
                "averageRating":   round(average_rating, 2),
                "totalReviews":    total_reviews,
                "recentReviews":   recent_review,
                "tasksToday":      tasks_today,
                "tasksTomorrow":   tasks_tomorrow,
                "tasksNextWeek":   tasks_next_week,
                "earningsGraph":   earnings_graph
            }, cls=MongoJSONEncoder))
        )

    except Exception as e:
        print(f"❌ Error fetching worker stats: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 
from fastapi import FastAPI, HTTPException
from datetime import datetime, timedelta
from bson import ObjectId


from datetime import datetime, timedelta
from fastapi import HTTPException

@app.get("/worker/earning/{worker_id}", tags=["worker"])
def calculate_worker_earnings(worker_id: str):
    from dateutil import parser
    now = datetime.utcnow()

    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_today   = start_today + timedelta(days=1)
    start_week  = start_today - timedelta(days=now.weekday())
    end_week    = start_week + timedelta(days=7)
    start_month = start_today.replace(day=1)
    end_month   = (start_month.replace(month=start_month.month + 1)
                   if start_month.month < 12
                   else start_month.replace(year=start_month.year + 1, month=1))

    # ✅ assignedWorkerId is an email string — query directly, no ObjectId
    completed_tasks = list(collection_task.find({
        "assignedWorkerId": worker_id,
        "status": "completed"
    }))

    def parse_completed_at(task):
        completed_at = task.get("completedAt")
        if not completed_at:
            # fallback to serviceDate if completedAt missing
            completed_at = task.get("serviceDate")
        if not completed_at:
            return None
        if isinstance(completed_at, datetime):
            return completed_at
        if isinstance(completed_at, str):
            try:
                return parser.isoparse(completed_at)
            except Exception as e:
                print(f"Failed to parse date '{completed_at}': {e}")
                return None
        return None

    def earnings_in_range(start, end):
        return sum(
            t.get("totalCost", 0)
            for t in completed_tasks
            if (dt := parse_completed_at(t)) and start <= dt < end
        )

    return {
        "worker_id":      worker_id,
        "todayEarnings":  earnings_in_range(start_today, end_today),
        "weekEarnings":   earnings_in_range(start_week, end_week),
        "monthEarnings":  earnings_in_range(start_month, end_month),
        "totalEarnings":  sum(t.get("totalCost", 0) for t in completed_tasks),
        "completedTasks": len(completed_tasks)
    }

@app.patch("/api/admin/user/{user_id}/status")
def update_user_status(user_id: str, body: dict):
    status = body.get("status")  # 'active' or 'inactive'
    result = collection_worker.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": status}})
    if result.matched_count == 0:
        result = collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": status}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User status updated to {status}"}

DISTRICTS = [
    "Achham", "Arghakhanchi", "Baglung", "Baitadi", "Bajhang", "Bajura",
    "Banke", "Bara", "Bardiya", "Bhaktapur", "Bhojpur", "Chitwan",
    "Dadeldhura", "Dailekh", "Dang", "Darchula", "Dhading", "Dhankuta",
    "Dhanusa", "Dolakha", "Dolpa", "Doti", "Eastern Rukum", "Gorkha",
    "Gulmi", "Humla", "Ilam", "Jajarkot", "Jhapa", "Jumla", "Kailali",
    "Kalikot", "Kanchanpur", "Kapilvastu", "Kaski", "Kathmandu", "Kavrepalanchok",
    "Khotang", "Lalitpur", "Lamjung", "Mahottari", "Makwanpur", "Manang",
    "Morang", "Mugu", "Mustang", "Myagdi", "Nawalpur", "Nuwakot", "Okhaldhunga",
    "Palpa", "Panchthar", "Parasi", "Parbat", "Parsa", "Pyuthan", "Ramechhap",
    "Rasuwa", "Rautahat", "Rolpa", "Rukum Paschim", "Rupandehi", "Salyan",
    "Sankhuwasabha", "Saptari", "Sarlahi", "Sindhuli", "Sindhupalchok",
    "Siraha", "Solukhumbu", "Sunsari", "Surkhet", "Syangja", "Tanahun",
    "Taplejung", "Terhathum", "Udayapur"
]

@app.get("/api/admin/stats",  tags=["admin-dashboard"])
def get_admin_stats():
    total_customer=collection.count_documents({})
    total_worker = collection_worker.count_documents({})
    total_user=int(total_customer) + int(total_worker)
    total_completed_task=collection_task.count_documents({"status":"completed"})
    revenue_result = list(collection_task.aggregate([
        {"$match":  {"status": "completed"}},
        {"$group":  {"_id": None, "totalRevenue": {"$sum": "$totalCost"}}}
    ]))
    total_revenue = revenue_result[0]["totalRevenue"] if revenue_result else 0
    platform_fees = round(total_revenue * 0.05, 2)
    pending_report=collection_reports.count_documents({"status":"pending"})
    resolved_report=collection_reports.count_documents({"status":"resolved"})
    declined_report=collection_reports.count_documents({"status":"declined"})
    return {"total user":total_user, 
            "total customer": total_customer, 
            "total worker": total_worker, 
            "total completed task": total_completed_task, 
            "platform_fees":platform_fees, 
            "pending reports": pending_report,
            "resolved report": resolved_report,
            "declined report": declined_report}

@app.get("/api/admin/revenue/location", tags=["admin-dashboard"])
async def get_top_locations():
    
    pipeline = [
        {
            "$match": {
                "status": "completed",
                "payment_status": "paid"
            }
        },
        {
            "$lookup": {
                "from": "worker",
                "localField": "assignedWorkerId",
                "foreignField": "_id",
                "as": "worker"
            }
        },
        { "$unwind": "$worker" },

        {
            "$group": {
                "_id": "$worker.serviceArea.primaryCity",
                "revenue": { "$sum": "$totalCost" }
            }
        },

        { "$sort": { "revenue": -1 } }
    ]

    results = list(collection_task.aggregate(pipeline))

    total = sum(r["revenue"] for r in results)

    colors = ["#f59e0b","#3b82f6","#10b981","#8b5cf6","#ef4444"]

    data = []
    for i, r in enumerate(results):
        percent = round((r["revenue"] / total) * 100, 1) if total else 0

        data.append({
            "name": r["_id"],
            "percent": percent,
            "amount": r["revenue"],
            "color": colors[i % len(colors)]
        })

    return data
 


def format_time(timestamp):
    from datetime import datetime

    if not timestamp:
        return {"time": "unknown", "time_raw": datetime.utcnow()}

    now = datetime.utcnow()
    diff = now - timestamp

    if diff.total_seconds() < 60:
        t = f"{int(diff.total_seconds())} sec ago"
    elif diff.total_seconds() < 3600:
        t = f"{int(diff.total_seconds()/60)} min ago"
    elif diff.total_seconds() < 86400:
        t = f"{int(diff.total_seconds()/3600)} hr ago"
    else:
        t = f"{diff.days} day ago"

    return {"time": t, "time_raw": timestamp}

@app.get("/api/admin/alert")
def get_alert():
    from datetime import datetime, timedelta

    now = datetime.utcnow()

    # ── 1. Workers waiting for skill OR face verification ─────────────────────
    worker_verification = collection_worker.count_documents({
        "$or": [
            {"skill_verified": False},
            {"face_verified":  False},
        ]
    })

    # ── 2. Workers reported 3+ times (pending reports) ────────────────────────
    # Fix: your schema uses "reportedType" not "reportedRole"
    flagged_workers = list(collection_reports.aggregate([
        {
            "$match": {
                "status":       "pending",
                "reportedType": "worker"        # fixed field name
            }
        },
        {
            "$group": {
                "_id":   "$reportedId",
                "count": {"$sum": 1}
            }
        },
        {
            "$match": {"count": {"$gte": 3}}
        }
    ]))

    # ── 3. Pending payments (customer hasn't paid yet) ────────────────────────
    pending_payment = collection_task.count_documents({
        "escrow_status": "pending"
    })

    # ── 4. Declined / cancelled tasks ─────────────────────────────────────────
    task_cancelled = collection_task.count_documents({
        "status": "declined"
    })

    # ── 5. Tasks ongoing for more than 7 days ─────────────────────────────────
    overdue_tasks = collection_task.count_documents({
        "status":    "ongoing",
        "createdAt": {"$lte": now - timedelta(days=7)}
    })

    # ── 6. Workers with poor rating (min 5 tasks to be fair) ─────────────────
    low_rated = collection_worker.count_documents({
        "ratings":          {"$lte": 2.0},
        "noOfCompletedTask":{"$gte": 5}
    })

    # ── 8. Escrow stuck for more than 3 days after task completion ────────────
    # Money is held but worker hasn't been paid out
    stuck_escrow = collection_task.count_documents({
        "status":        "completed",
        "payment_status":"paid",
        "escrow_status": "held",
    })

    # ── 9. Workers inactive for 30+ days but still marked available ───────────
    # These clog up search results for customers
    inactive_available = collection_worker.count_documents({
        "isAvailable":          True,
        "availability_updated_at": {"$lte": now - timedelta(days=30)}
    })

    # ── 10. High cancellation rate workers (3+ declined tasks this month) ─────
    month_ago = now - timedelta(days=30)
    high_cancel_workers = list(collection_task.aggregate([
        {
            "$match": {
                "status":    "declined",
                "createdAt": {"$gte": month_ago},
                "assignedWorkerId": {"$nin": [None, "", "null"]}
            }
        },
        {
            "$group": {
                "_id":   "$assignedWorkerId",
                "count": {"$sum": 1}
            }
        },
        {
            "$match": {"count": {"$gte": 3}}
        }
    ]))


    # ── 12. Tasks paid but service date already passed with no status update ──
    # Customer paid, service date came and went, task still "pending"
    missed_service = collection_task.count_documents({
        "escrow_status": "held",
        "status":         "pending",
        "serviceDate":    {"$lte": now.strftime("%Y-%m-%d")}   # serviceDate is stored as string
    })

  

    return {
        # Existing keys (keep same names — your frontend depends on these)
        "pending verification process": worker_verification,
        "flagged_workers":              len(flagged_workers),
        "declined task":                task_cancelled,
        "pending payment":              pending_payment,
        "overdue tasks":                overdue_tasks,
        "low rated workers":            low_rated,

        # New keys
        "stuck escrow":                 stuck_escrow,           # frontend already expects this
        "inactive available workers":   inactive_available,
        "high cancellation workers":    len(high_cancel_workers),
        "missed service date":          missed_service
    }

# admin_router.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from datetime import datetime
import json
import asyncio
from .manager.websocket_manager import manager

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ───── MODELS ─────
class StatusUpdate(BaseModel):
    status: str

class Notification(BaseModel):
    message: str
    userIds: Optional[List[str]] = None  # None means broadcast to all

class AdminNote(BaseModel):
    note: str

# ───── USER / WORKER MANAGEMENT ─────
@app.patch("/user/{user_id}/status")
def update_user_status(user_id: str, body: StatusUpdate):
    # Update worker first
    result = collection_worker.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": body.status}})
    if result.matched_count == 0:
        # Update customer
        result = collection.update_one({"_id": ObjectId(user_id)}, {"$set": {"status": body.status}})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"User status updated to {body.status}"}

@app.patch("/worker/{worker_id}/approval")
def approve_worker(worker_id: str, body: StatusUpdate):
    result = collection_worker.update_one({"_id": ObjectId(worker_id)}, {"$set": {"approvalStatus": body.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"message": f"Worker approval status updated to {body.status}"}

# ───── TASK MANAGEMENT ─────
@app.patch("/task/{task_id}/status")
def force_update_task_status(task_id: str, body: StatusUpdate):
    result = collection_task.update_one({"_id": ObjectId(task_id)}, {"$set": {"status": body.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": f"Task status forcibly updated to {body.status}"}

@app.patch("/task/{task_id}/reassign")
def reassign_task(task_id: str, body: dict):
    new_worker_id = body.get("workerId")
    if not new_worker_id:
        raise HTTPException(status_code=400, detail="workerId required")
    result = collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {"assignedWorkerId": new_worker_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task reassigned successfully"}

@app.delete("/task/{task_id}")
def delete_task(task_id: str):
    result = collection_task.delete_one({"_id": ObjectId(task_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted successfully"}



@app.get("/dashboard/earnings", tags=["admin-dashboard"])
def admin_earnings_summary():
    completed_tasks = list(collection_task.find({"status": "completed"}))
    total_earnings = sum(t.get("totalCost", 0) for t in completed_tasks)
    
    from collections import defaultdict
    earnings_by_day = defaultdict(float)
    for t in completed_tasks:
        date_str = t.get("serviceDate")
        if date_str:
            earnings_by_day[date_str] += t.get("totalCost", 0)
    
    return {"totalEarnings": total_earnings, "dailyEarnings": dict(earnings_by_day)}


@app.get("/api/admin/growth/{period}", tags=["admin-dashboard"])
def get_growth_data(period: str = "month"):
    now = datetime.utcnow()
    worker_map = defaultdict(int)
    customer_map = defaultdict(int)
    period       = period.strip().lower()
    print("period:", period)

    # ── DAY: last 24 hours ──
    if period == "day":
        labels = [(now - timedelta(hours=i)).strftime("%H:00") for i in range(23, -1, -1)]
        worker_map = {l: 0 for l in labels}
        customer_map = {l: 0 for l in labels}

        for w in collection_worker.find({"registeredAt": {"$gte": now - timedelta(hours=24)}}, {"registeredAt": 1}):
            if w.get("registeredAt"):
                label = w["registeredAt"].strftime("%H:00")
                worker_map[label] += 1

        for c in collection.find({"registeredAt": {"$gte": now - timedelta(hours=24)}}, {"registeredAt": 1}):
            if c.get("registeredAt"):
                label = c["registeredAt"].strftime("%H:00")
                customer_map[label] += 1

    # ── WEEK: last 7 days ──
    elif period == "week":
        labels = [(now - timedelta(days=i)).strftime("%a %d") for i in range(6, -1, -1)]
        worker_map = {l: 0 for l in labels}
        customer_map = {l: 0 for l in labels}

        for w in collection_worker.find({"registeredAt": {"$gte": now - timedelta(days=7)}}, {"registeredAt": 1}):
            if w.get("registeredAt"):
                label = w["registeredAt"].strftime("%a %d")
                worker_map[label] += 1

        for c in collection.find({"registeredAt": {"$gte": now - timedelta(days=7)}}, {"registeredAt": 1}):
            if c.get("registeredAt"):
                label = c["registeredAt"].strftime("%a %d")
                customer_map[label] += 1

    # ── MONTH: last 12 months ──
    elif period == "month":
        labels = [(now - timedelta(days=30 * i)).strftime("%b %Y") for i in range(11, -1, -1)]
        worker_map = {l: 0 for l in labels}
        customer_map = {l: 0 for l in labels}

        for w in collection_worker.find({}, {"registeredAt": 1}):
            if w.get("registeredAt"):
                label = w["registeredAt"].strftime("%b %Y")
                if label in worker_map:
                    worker_map[label] += 1

        for c in collection.find({}, {"registeredAt": 1}):
            if c.get("registeredAt"):
                label = c["registeredAt"].strftime("%b %Y")
                if label in customer_map:
                    customer_map[label] += 1

    # ── YEAR: last 5 years ──
    elif period == "year":
        current_year = now.year
        labels = [str(current_year - i) for i in range(4, -1, -1)]  # last 5 years
        worker_map = {l: 0 for l in labels}
        customer_map = {l: 0 for l in labels}

        for w in collection_worker.find({}, {"registeredAt": 1}):
            if w.get("registeredAt"):
                label = str(w["registeredAt"].year)
                if label in worker_map:
                    worker_map[label] += 1

        for c in collection.find({}, {"registeredAt": 1}):
            if c.get("registeredAt"):
                label = str(c["registeredAt"].year)
                if label in customer_map:
                    customer_map[label] += 1

    else:
        return {"error": "Invalid period"}

    # ── Prepare final data for chart ──
    return [{"label": l, "workers": worker_map[l], "customers": customer_map[l]} for l in labels]
import os
import uuid
import base64
import hashlib
import hmac
import requests
import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from datetime import datetime, timedelta
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

from worker.config.database import collection, collection_worker, collection_task, collection_reports

load_dotenv()


# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────
BASE_URL            = os.getenv("BASE_URL", "http://localhost:5173")
ESEWA_MERCHANT_CODE = os.getenv("ESEWA_MERCHANT_CODE", "EPAYTEST")
ESEWA_SECRET_KEY    = os.getenv("ESEWA_SECRET_KEY", "8gBm/:&EnhH.1/q")
ESEWA_BASE_URL      = "https://rc-epay.esewa.com.np"  # change to https://epay.esewa.com.np in production


# ─────────────────────────────────────────────────────────────
# PYDANTIC MODELS
# ─────────────────────────────────────────────────────────────
class VerifyEsewa(BaseModel):
    task_id: str
    transaction_uuid: str
    total_amount: float

class VerifyExtraEsewa(BaseModel):
    task_id: str
    transaction_uuid: str
    total_amount: float

class FinishTask(BaseModel):
    worker_id: str
    final_price: float

class RenegotiateRequest(BaseModel):
    worker_id: str
    new_price: float
    reason: str

class RenegotiateRespond(BaseModel):
    user_id: str
    decision: str         # "accept" or "reject"

class WorkerAfterRejection(BaseModel):
    worker_id: str
    decision: str         # "proceed" or "cancel"

class DisputeRequest(BaseModel):
    user_id: str
    reason: str

class ResolveDispute(BaseModel):
    decision: str         # "release" or "refund"

class CompleteTask(BaseModel):
    user_id: str


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────
def generate_esewa_signature(message: str) -> str:
    key       = ESEWA_SECRET_KEY.encode("utf-8")
    msg_bytes = message.encode("utf-8")
    sig       = hmac.new(key, msg_bytes, hashlib.sha256).digest()
    return base64.b64encode(sig).decode("utf-8")


def get_task_or_404(task_id: str):
    task = collection_task.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def build_esewa_form(task_id: str, amount: float, success_path: str) -> dict:
    total_amount = int(amount)  # ← cast HERE, before building the message
    transaction_uuid = str(uuid.uuid4())
    
    # ← signature must use the SAME value as the form (int, not float)
    message   = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature = generate_esewa_signature(message)
    
    return {
        "esewa_url": f"{ESEWA_BASE_URL}/api/epay/main/v2/form",
        "form_data": {
            "amount":                  str(total_amount),
            "tax_amount":              "0",
            "total_amount":            str(total_amount),
            "transaction_uuid":        transaction_uuid,
            "product_code":            ESEWA_MERCHANT_CODE,
            "product_service_charge":  "0",
            "product_delivery_charge": "0",
            "success_url":             f"http://localhost:8000/payment/verify/esewa/{task_id}",
            "failure_url":             f"{BASE_URL}/payment/failed",
            "signed_field_names":      "total_amount,transaction_uuid,product_code",
            "signature":               signature
        }
    }


from fastapi import Depends, HTTPException
from datetime import datetime
from bson import ObjectId

from .services.OAuth2 import get_current_user

@app.patch("/customer/release/{task_id}", tags=["payment"])
def release_to_worker(task_id: str, current_user=Depends(get_current_user)):
    """
    Securely releases escrowed funds to worker.
    Only the task owner (customer) can release.
    """

    # ───────────────────────────────
    # 1️⃣ Fetch Task
    # ───────────────────────────────
    task = get_task_or_404(task_id)

    # ───────────────────────────────
    # 2️⃣ Authorization Check
    # ───────────────────────────────
    if current_user["user_id"] != task.get("userId"):
        print("current_user user_id:", current_user["user_id"])
        print("task userId:", task.get("userId"))
        raise HTTPException(status_code=403, detail="Not authorized to release this payment")

    # ───────────────────────────────
    # 3️⃣ Task Must Be Completed
    # ───────────────────────────────
    if task.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Task is not marked as completed")

    # ───────────────────────────────
    # 4️⃣ Payment Must Be Paid
    # ───────────────────────────────
    if task.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Payment not completed")

    # ───────────────────────────────
    # 5️⃣ Escrow Must Still Be Held
    # ───────────────────────────────
    if task.get("escrow_status") != "held":
        raise HTTPException(status_code=400, detail="Escrow already released or refunded")
    print("Task fetched:", task)
    print("esewa_ref_id:", task.get("esewa_ref_id"))
    # ───────────────────────────────
    # 6️⃣ Validate Payment Reference
    # ───────────────────────────────
    if not task.get("esewa_ref_id"):
        raise HTTPException(status_code=400, detail="Missing eSewa transaction reference")

    # ───────────────────────────────
    # 7️⃣ Calculate Payout
    # ───────────────────────────────
    final_price = task.get("final_price", task.get("totalCost", 0))
    if final_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid task amount")

    platform_fee  = round(final_price * 0.05, 2)
    worker_payout = round(final_price - platform_fee, 2)

    # ───────────────────────────────
    # 8️⃣ Find Worker
    # ───────────────────────────────
    worker = collection_worker.find_one({"email": task.get("assignedWorkerId")})
    if not worker:
        raise HTTPException(status_code=404, detail="Assigned worker not found")

    # ───────────────────────────────
    # 9️⃣ Update Worker Earnings
    # ───────────────────────────────
    collection_worker.update_one(
        {"email": task.get("assignedWorkerId")},
        {"$inc": {"total_earnings": worker_payout}}
    )

    # ───────────────────────────────
    # 🔟 Update Task Escrow Status
    # ───────────────────────────────
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "escrow_status": "released",
            "released_at": datetime.utcnow(),
            "platform_fee": platform_fee,
            "worker_payout": worker_payout
        }}
    )

    return {
        "success": True,
        "message": "Payment released successfully",
        "worker_payout": worker_payout,
        "platform_fee": platform_fee
    }
# ─────────────────────────────────────────────────────────────
# 1. INITIATE PAYMENT — eSewa
# ─────────────────────────────────────────────────────────────
@app.post("/task/{task_id}/pay/esewa", tags=["payment"])
def pay_via_esewa(task_id: str):
    task = get_task_or_404(task_id)
    if task.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Task already paid")

    total_amount     = int(task["totalCost"])  # ← cast to int first
    transaction_uuid = str(uuid.uuid4())
    message          = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={ESEWA_MERCHANT_CODE}"
    signature        = generate_esewa_signature(message)

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "esewa_transaction_uuid": transaction_uuid,
            "payment_method":         "esewa",
            "payment_status":         "unpaid",
            "escrow_status":          "pending"
        }}
    )

    return {
        "esewa_url": f"{ESEWA_BASE_URL}/api/epay/main/v2/form",
        "form_data": {
            "amount":                  str(total_amount),
            "tax_amount":              "0",
            "total_amount":            str(total_amount),
            "transaction_uuid":        transaction_uuid,
            "product_code":            ESEWA_MERCHANT_CODE,
            "product_service_charge":  "0",
            "product_delivery_charge": "0",
            "success_url":             f"http://localhost:8000/payment/verify/esewa/{task_id}",
            "failure_url":             f"{BASE_URL}/payment/failed",
            "signed_field_names":      "total_amount,transaction_uuid,product_code",
            "signature":               signature
        }
    }


# ─────────────────────────────────────────────────────────────
# 2a. VERIFY PAYMENT — eSewa redirect (GET from eSewa)
# ─────────────────────────────────────────────────────────────
from fastapi import Query

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from datetime import datetime
from bson import ObjectId

BASE_URL = "http://localhost:5173"  # React frontend URL
@app.get("/payment/verify/esewa/{task_id}")
def verify_esewa_redirect(
    task_id: str,
    data: Optional[str] = Query(None),
):
    if not data:
        raise HTTPException(status_code=400, detail="Missing data param from eSewa")

    try:
        # ── Decode the base64 data eSewa sends ──
        decoded = json.loads(base64.b64decode(data).decode("utf-8"))
        print("✅ eSewa decoded data:", decoded)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode eSewa data: {e}")

    if decoded.get("status") != "COMPLETE":
        return RedirectResponse(url=f"{BASE_URL}/payment/failed")

    # ── NOW you have the ref_id ──
    ref_id = decoded.get("transaction_code")   # ← this is the real ref id
    amount = decoded.get("total_amount")

    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "payment_status": "paid",
            "escrow_status":  "held",
            "esewa_ref_id":   ref_id,   # ← now properly saved
            "paid_at":        datetime.utcnow()
        }}
    )

    task = collection_task.find_one({"_id": ObjectId(task_id)})
    user_email = task.get("userEmail", "Sitalll@gmail.com")
    user_id = str(task.get("userId", "unknown"))
    role    = "customer"

    return RedirectResponse(
        url=f"{BASE_URL}/customer/pay/{task_id}/{user_email}/{user_id}/{role}?payment=success"
    )
# ─────────────────────────────────────────────────────────────
# 2b. VERIFY PAYMENT — eSewa manual (POST for Swagger testing)
# ─────────────────────────────────────────────────────────────
@app.post("/payment/verify/esewa", tags=["payment"])
def verify_esewa_manual(body: VerifyEsewa):
    """Manual verification for Swagger/Postman testing"""
    resp = requests.get(
        f"{ESEWA_BASE_URL}/api/epay/transaction/status/",
        params={
            "product_code":     ESEWA_MERCHANT_CODE,
            "total_amount":     body.total_amount,
            "transaction_uuid": body.transaction_uuid
        }
    )
    data = resp.json()

    if data.get("status") == "COMPLETE":
        collection_task.update_one(
            {"_id": ObjectId(body.task_id)},
            {"$set": {
                "payment_status": "paid",
                "escrow_status":  "held",
                "esewa_ref_id":   body.transaction_uuid,
                "paid_at":        datetime.utcnow()
            }}
        )
        return {"message": "Payment verified. Funds held in escrow.", "status": "success"}

    return {"message": "Payment not completed", "status": data.get("status")}


# ─────────────────────────────────────────────────────────────
# 3. CUSTOMER MARKS TASK COMPLETE → AUTO RELEASE TO WORKER
# ─────────────────────────────────────────────────────────────


@app.post("/task/{task_id}/complete", tags=["payment"])
def complete_task(task_id: str, body: CompleteTask):
    task = get_task_or_404(task_id)

    # ── Auth check ────────────────────────────────────────────
    if task.get("userId") != body.user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # ── Status check ──────────────────────────────────────────
    if task.get("status") != "in_progress":
        raise HTTPException(
            status_code=400,
            detail=f"Task is not in progress (current status: '{task.get('status')}')"
        )

    # ── Payment checks ────────────────────────────────────────
    if task.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Customer has not paid yet")

    if task.get("escrow_status") != "held":
        raise HTTPException(
            status_code=400,
            detail=f"No funds held in escrow (escrow_status: '{task.get('escrow_status')}')"
        )

    # ── Calculate payout ──────────────────────────────────────
    final_price = task.get("final_price") or task.get("totalCost") or 0
    if not final_price or final_price <= 0:
        raise HTTPException(status_code=400, detail="Invalid task amount")

    platform_fee  = round(final_price * 0.05, 2)
    worker_payout = round(final_price - platform_fee, 2)

    # ── Atomic update: complete + release in ONE operation ────
    # This prevents the race condition where status=completed but escrow
    # is still "held" if the second update fails
    collection_task.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": {
            "status":         "completed",
            "escrow_status":  "released",
            "payment_status": "released",
            "platform_fee":   platform_fee,
            "worker_payout":  worker_payout,
            "completed_at":   datetime.utcnow(),
            "released_at":    datetime.utcnow(),
        }}
    )

    # ── Notify both parties via WebSocket ─────────────────────
    import asyncio, json as _json
    notification = _json.dumps({
        "type":   "task_status",
        "taskId": task_id,
        "status": "completed",
    })
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(manager.send_to_user(task.get("userId"),           notification))
        loop.run_until_complete(manager.send_to_user(task.get("assignedWorkerId"), notification))
    except Exception as ws_err:
        print(f"⚠️ WS notify failed (non-critical): {ws_err}")

    return {
        "message":       "Task completed! Payment released to worker.",
        "worker_payout": worker_payout,
        "platform_fee":  platform_fee,
        "task_id":       task_id,
    }

@app.get("/task/{task_id}", tags=["payment"])
def get_task_by_id(task_id: str):
    try:
        task = collection_task.find_one({"_id": ObjectId(task_id)})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task["_id"] = str(task["_id"])
        return json.loads(json.dumps(task, cls=MongoJSONEncoder))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/payment/status/{task_id}")
def get_payment_status(task_id:str):
    try:
        task=collection_task.find_one({"_id":ObjectId(task_id)})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task_status=task.get("payment_status")
        return {"task_status":task_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import re as _re


@app.get("/api/payment/escrow/status/{taskId}", tags=["payment"])
def get_escorw_status(taskId:str):
    task=collection_task.find_one({"_id":ObjectId(taskId)})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found for escrow")
    status=task.get("escrow_status")
    return status

from bson import ObjectId
from datetime import datetime

# ── REPLACE THIS (was broken — used raw string as _id) ───────────────────────
@app.get("/worker/isavailable/status/{workerId}", tags=["worker"])
def is_available(workerId: str):
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(workerId)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": workerId})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"workerId": workerId, "isAvailable": worker.get("isAvailable", False)}


# ── REPLACE THIS (was broken — used raw string as _id) ───────────────────────
@app.patch("/worker/isavailable/update/status/{workerId}", tags=["worker"])
def update_availability(workerId: str, status: bool):
    worker_filter = {"email": workerId}
    try:
        worker_filter = {"_id": ObjectId(workerId)}
    except Exception:
        pass
    result = collection_worker.update_one(
        worker_filter,
        {"$set": {"isAvailable": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"workerId": workerId, "isAvailable": status}


@app.get("/worker/availability/{workerId}", tags=["worker"])
def get_worker_availability(workerId: str):
    worker = None
    try:
        worker = collection_worker.find_one({"_id": ObjectId(workerId)})
    except Exception:
        pass
    if not worker:
        worker = collection_worker.find_one({"email": workerId})
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # ✅ FIX: schema stores hours at worker.hours (top-level), NOT worker.availability.hours
    hours = worker.get("hours") or worker.get("availability", {}).get("hours", {})

    return {
        "isAvailable": worker.get("isAvailable", True),
        "hours":       hours,
        "workerId":    str(worker["_id"]),
    }
# server.py — Kaam-ly Full Backend
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os, asyncio, re, json

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate


client = AsyncIOMotorClient(MONGO_URI)
db = client.get_database("user")
workers_collection = db.get_collection("worker")


_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_dir, "faq.json"), "r") as f:
    faq_data = json.load(f)


class ChatRequest(BaseModel):
    message: str


async def retry_with_backoff(fn, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                delay = min(2 ** attempt, 30)
                await asyncio.sleep(delay)
                continue
            raise e
    raise Exception("Max retries exceeded")


def sanitize_response(text: str) -> str:
    text = re.sub(r'\b\d{7,15}\b', '[hidden]', text)
    text = re.sub(r'\S+@\S+\.\S+', '[hidden]', text)
    return text


async def search_workers_mongo(query: str, n: int = 5):
    try:
        results = await workers_collection.find({
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"service_type": {"$regex": query, "$options": "i"}},
            ]
        }).to_list(n)
        return [
            {
                "name": w.get("name", ""),
                "service_type": w.get("service_type", ""),
                "availability": w.get("availability", "Contact to check availability")
            }
            for w in results
        ]
    except Exception:
        return []


def search_faq_json(query: str, n: int = 5):
    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored = []
    for faq in faq_data:
        q_lower = faq["question"].lower()
        a_lower = faq["answer"].lower()
        # Score: word overlap across question + answer
        faq_words = set((q_lower + " " + a_lower).split())
        overlap = len(query_words & faq_words)
        if overlap > 0:
            scored.append((overlap, faq))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [faq for _, faq in scored[:n]]


async def call_agent(message: str):
    workers = await search_workers_mongo(message)
    faqs = search_faq_json(message)

    context_parts = []

    if faqs:
        faq_text = "\n".join([f"Q: {f['question']}\nA: {f['answer']}" for f in faqs])
        context_parts.append(f"RELEVANT FAQ ENTRIES:\n{faq_text}")

    if workers:
        worker_text = "\n".join([
            f"- {w['name']} ({w['service_type']}): {w['availability']}"
            for w in workers
        ])
        context_parts.append(f"RELEVANT WORKERS:\n{worker_text}")

    context_text = "\n\n".join(context_parts)
    has_context = bool(context_text.strip())

    model = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=GOOGLE_API_KEY,
        temperature=0
    )

    system_prompt = """You are Kaami, the friendly AI assistant for Kaam-ly — a platform for booking trusted home service workers in Nepal.

STRICT RULES — follow these exactly:
1. ONLY answer using the FAQ and worker information provided in the context below.
2. If the answer is NOT in the context, say exactly: "I don't have that information right now. Please contact our support team for help."
3. NEVER make up steps, phone numbers, emails, links, or instructions that aren't in the context.
4. NEVER tell users to navigate to sections or buttons that you haven't confirmed exist (e.g. don't say "go to Help & Support > Report a User" unless the FAQ says so).
5. For reporting a user or contacting support, tell the user to use the buttons provided in the chat widget — do not invent a process.
6. Keep answers concise, friendly, and clear.
7. Do not reveal any personal contact details.

CONTEXT:
{context}
"""

    if not has_context:
        system_prompt_filled = system_prompt.replace(
            "{context}",
            "No relevant FAQ or worker data found for this query."
        )
    else:
        system_prompt_filled = system_prompt.replace("{context}", context_text)

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt_filled),
        ("human", "{message}")
    ])

    async def run_model():
        formatted = prompt.format_messages(message=message)
        result = await model.agenerate([formatted])
        answer = result.generations[0][0].text
        return sanitize_response(answer)

    return await retry_with_backoff(run_model)


@app.post("/chatbot")
async def start_chat(request: ChatRequest):
    try:
        response = await call_agent(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/workers/search/")
async def search_workers_by_name(q: str, limit: int = 5):
    if not q or len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters.")
    
    try:
        tokens = [t for t in q.strip().split() if t]
        
        # Each token must match at least one field (AND across tokens, OR across fields)
        token_conditions = []
        for token in tokens:
            token_conditions.append({
                "$or": [
                    {"firstName":   {"$regex": token, "$options": "i"}},
                    {"lastName":    {"$regex": token, "$options": "i"}},
                    {"email":       {"$regex": token, "$options": "i"}},
                    {"taskType":    {"$regex": token, "$options": "i"}},
                    {"description": {"$regex": token, "$options": "i"}},
                ]
            })
        
        query = {"$and": token_conditions} if len(token_conditions) > 1 else token_conditions[0]
        
        results = await workers_collection.find(query).to_list(limit)

        return [
            {
                "id":           w.get("email") or str(w["_id"]),  # worker _id is email string
                "name":         f"{w.get('firstName', '')} {w.get('lastName', '')}".strip(),
                "service_type": w.get("taskType", "").capitalize(),
                "area":         (
                    w.get("serviceArea", {}).get("primaryCity")
                    or w.get("serviceArea", {}).get("city")
                    or w.get("serviceArea", {}).get("district")
                    or "Nepal"
                ),
                "rating":       w.get("ratings", None),
                "profile_pic":  w.get("profilePhoto", ""),
                "is_available": w.get("isAvailable", False),
                "status":       w.get("status", "active"),
            }
            for w in results
        ]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# main.py — add these imports at the top
from fastapi import Request
from fastapi.responses import JSONResponse
from .repository.fraud_engine import FraudScorer, RiskLevel
from .router.fraud_router import router as fraud_router

# ── After you create your `app = FastAPI(...)` ──────────────────────────

# Attach your existing MongoDB db to app.state so fraud router can access it
# (replace `your_db` with whatever your MongoDB db variable is called)
@app.on_event("startup")
async def startup():
    from worker.config.database import collection_task  # already imported at top
    from pymongo import MongoClient
    mongo_client = MongoClient("mongodb+srv://dixita1:Shuvechhya@cluster0.ue3kxzv.mongodb.net/?appName=Cluster0")
    app.state.db = mongo_client["user"]

# ── Fraud middleware — add BEFORE your other middleware ─────────────────

EXEMPT_PATHS = {"/api/auth/login", "/api/auth/register", "/docs", "/openapi.json", "/redoc"}

SENSITIVE_PATHS = {
    "/api/payments/withdraw",
    "/api/tasks",            # adjust to your actual routes
    "/api/reviews",
}

@app.middleware("http")
async def fraud_middleware(request: Request, call_next):
    EXEMPT_PATHS = {"/api/auth/login", "/api/auth/register", "/docs", "/openapi.json", "/redoc", "/chatbot"}

    SENSITIVE_PATHS = {
        "/customer/release",
        "/task",
        "/api/reviews",
    }

    if request.url.path in EXEMPT_PATHS:
        return await call_next(request)

    # ── Reuse your existing OAuth2 token extraction ──
    token = request.headers.get("Authorization", "").strip()
    if not token.startswith("Bearer "):
        return await call_next(request)
    token = token.removeprefix("Bearer ").strip()

    try:
        # ── Use the SAME secret/algorithm your OAuth2.py uses ──
        from jose import jwt
        from worker.services.OAuth2 import SECRET_KEY, ALGORITHM  # ← import your constants
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = str(payload.get("user_id") or payload.get("sub") or "")
        if not user_id:
            return await call_next(request)
    except Exception:
        return await call_next(request)   # invalid token — let the route handle it

    db     = request.app.state.db
    cached = db.fraud_reports.find_one({"user_id": user_id})

    # Block suspended accounts on every request
    if cached and cached.get("risk_level") == RiskLevel.SUSPEND.value:
        return JSONResponse(
            {"error": "Your account has been suspended. Contact support@kaamly.com"},
            status_code=403,
        )

    # Re-score on sensitive actions only
    is_sensitive = any(request.url.path.startswith(p) for p in SENSITIVE_PATHS)
    if is_sensitive:
        from .repository.fraud_engine import FraudScorer
        scorer = FraudScorer(db)
        report = scorer.score(user_id)
        if report.risk_level == RiskLevel.SUSPEND:
            return JSONResponse(
                {"error": "Action blocked due to suspicious activity."},
                status_code=403,
            )

    return await call_next(request)


# ── Register the fraud admin router ────────────────────────────────────
app.include_router(fraud_router)
app.include_router(recommend_router.router)
app.include_router(faceVerify.router, prefix="/api")
#include routers
app.include_router(registerCustomer.router, prefix="/api")
app.include_router(skillVerification.router, prefix="/api")
app.include_router(adminPayout.router)
app.include_router(registerWorker.router, prefix="/api")
app.include_router(login.router, prefix="/api")
app.include_router(otp.router, prefix='/api')
app.include_router(createTask.router, prefix='/api')
app.include_router(chat.router, prefix="/api")
app.include_router(duplicateCheck.router, prefix="/api")
app.include_router(predictTask.router, prefix='/api')
app.include_router(review_route.router, prefix='/api')
app.include_router(search_router.router, prefix='/api')
app.include_router(image_classify_router.router, prefix='/api')
app.include_router(report.router, prefix='/api')
app.include_router(adminReviewAI.router, prefix='/api')
app.include_router(pendingActivities.router, prefix='/api')
app.include_router(esewaVerify.router, prefix='/api')
app.include_router(updateProfile.router, prefix='/api')
app.include_router(refund.router, prefix="/api")
from .router import slots
app.include_router(slots.router)

from worker.router.notifications import notifications_router
from worker.router.taskActions  import tasks_router

app.include_router(notifications_router)
app.include_router(tasks_router)
