import os
import json
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId

from ..config.database import (
    collection_reports,
    collection,
    collection_worker,
    collection_reviews,
    collection_task,
    chat_collection,
    ai_review_collection,  # <-- import db so we can create the new collection
)
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
router = APIRouter(tags=["ai-review"])

# ─── New collection ────────────────────────────────────────────────────────────
# Each document shape:
# {
#   _id:         ObjectId  (auto)
#   report_id:   str       (the report this review belongs to)
#   ai_result:   dict      (full JSON returned by the LLM)
#   context:     dict      (snapshot of all gathered context at review time)
#   reviewed_by: str       (admin user id — pass in header or hardcode for now)
#   created_at:  datetime
# }


# Groq API config
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

# Schemas
class DraftRequest(BaseModel):
    target:          str            # "reporter" | "reported"
    suggestedAction: Optional[str] = "under review"
    summary:         Optional[str] = ""

# Helpers
def _sid(doc: dict) -> dict:
    if not doc: return None
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc

def _safe_oid(val: str):
    try:
        return ObjectId(val)
    except:
        return None

def _calculate_refund(task: dict) -> dict:
    """
    Deterministic refund calculation (NOT AI).
    Returns: { refund_amount, penalty_amount, refund_type, note }
    """
    from datetime import datetime, timezone
    total_cost   = task.get("totalCost") or task.get("basePrice") or 0
    created_at   = task.get("createdAt")
    cancelled_at = task.get("cancelledAt")
    status       = task.get("status")
    escrow       = task.get("escrow_status")
    
    if not total_cost:
        return {
            "refund_amount": 0,
            "penalty_amount": 0,
            "refund_type": "none",
            "note": "No cost found"
        }
    
    # ── If already refunded ─────────────────────────
    if escrow == "refunded":
        return {
            "refund_amount": total_cost,
            "penalty_amount": 0,
            "refund_type": "already_refunded",
            "note": "Already refunded"
        }
    
    # ── If escrow released → risky ──────────────────
    if escrow == "released":
        return {
            "refund_amount": 0,
            "penalty_amount": 0,
            "refund_type": "blocked",
            "note": "Funds already released to worker"
        }
    
    # ── Cancelled case ──────────────────────────────
    if status == "cancelled" and created_at and cancelled_at:
        try:
            def _dt(v):
                if isinstance(v, str):
                    v = datetime.fromisoformat(v.replace("Z", "+00:00"))
                if v.tzinfo is None:
                    v = v.replace(tzinfo=timezone.utc)
                return v
            diff_hours = (_dt(cancelled_at) - _dt(created_at)).total_seconds() / 3600
            
            # FULL REFUND
            if diff_hours >= 4:
                return {
                    "refund_amount": total_cost,
                    "penalty_amount": 0,
                    "refund_type": "full",
                    "note": "Cancelled 4+ hrs before"
                }
            # PARTIAL REFUND (75%)
            elif diff_hours >= 2:
                refund = round(total_cost * 0.75, 2)
                penalty = round(total_cost * 0.25, 2)
                return {
                    "refund_amount": refund,
                    "penalty_amount": penalty,
                    "refund_type": "partial",
                    "note": "2–4 hrs cancellation"
                }
            # LATE → manual
            else:
                return {
                    "refund_amount": 0,
                    "penalty_amount": 0,
                    "refund_type": "manual",
                    "note": "Late cancellation (<2 hrs)"
                }
        except Exception as e:
            return {
                "refund_amount": 0,
                "penalty_amount": 0,
                "refund_type": "error",
                "note": str(e)
            }
    
    # ── Mid-task / other cases ──────────────────────
    if status in ("in_progress", "confirmed"):
        return {
            "refund_amount": 0,
            "penalty_amount": 0,
            "refund_type": "manual",
            "note": "Mid-task — requires admin review"
        }
    
    return {
        "refund_amount": 0,
        "penalty_amount": 0,
        "refund_type": "none",
        "note": "No refund condition met"
    }

def _get_user(user_id: str) -> dict:
    if not user_id:
        return {}
    oid = _safe_oid(user_id)
    for col, name in [(collection, "customer"), (collection_worker, "worker")]:
        doc = col.find_one({"$or": [{"_id": oid}, {"email": user_id}]})
        if doc:
            return {"collection": name, **_sid(doc)}
    return {}

async def _call_llm(prompt: str) -> str:
    """Call Groq API safely and return text."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            res = await client.post(
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model":       GROQ_MODEL,
                    "messages":    [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens":  1600,
                },
            )
            res.raise_for_status()
        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Groq request failed: {str(e)}")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=502, detail=f"Groq error: {res.text}")

    data = res.json()
    return data["choices"][0]["message"]["content"]

# Gather full context
def _gather_context(report_id: str) -> dict:
    report = collection_reports.find_one({"_id": _safe_oid(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report = _sid(report)

    reporter_id = report.get("reporterId") or ""
    reported_id = report.get("reportedId") or ""
    
    # ── Fetch task if taskId is present ────────────────────────────────────
    task = {}
    task_id = report.get("taskId")
    if task_id:
        task_doc = collection_task.find_one({"_id": _safe_oid(task_id)})
        if task_doc:
            task = _sid(task_doc)
    
    # ── Calculate refund ───────────────────────────────────────────────────
    refund_calc = _calculate_refund(task) if task else {
        "refund_amount": 0,
        "penalty_amount": 0,
        "refund_type": "none",
        "note": "No task found"
    }

    rr = _get_user(reporter_id)
    rd = _get_user(reported_id)

    reporter_profile = {
        "id":             reporter_id,
        "name":           f"{rr.get('first_name') or rr.get('firstName','')} {rr.get('last_name') or rr.get('lastName','')}".strip() or f"Customer {reporter_id[:8]}",
        "email":          rr.get("email", reporter_id),
        "role":           rr.get("role") or rr.get("collection", "unknown"),
        "status":         rr.get("status", "active"),
        "ratings":        rr.get("ratings"),
        "completedTasks": rr.get("noOfCompletedTask"),
    }

    reported_profile = {
        "id":             reported_id,
        "name":           f"{rd.get('first_name') or rd.get('firstName','')} {rd.get('last_name') or rd.get('lastName','')}".strip() or f"Worker {reported_id[:8]}",
        "email":          rd.get("email", reported_id),
        "role":           rd.get("role") or rd.get("collection", "unknown"),
        "status":         rd.get("status", "active"),
        "ratings":        rd.get("ratings"),
        "reviewCount":    rd.get("reviewCount"),
        "completedTasks": rd.get("noOfCompletedTask"),
        "description":    rd.get("description"),
        "faceVerified":   rd.get("face_verified", False),
        "skillVerified":  rd.get("skill_verified", False),
        "taskType":       rd.get("taskType"),
    }

    # Prior reports
    prior_raw = list(collection_reports.find(
        {"reportedId": reported_id, "_id": {"$ne": _safe_oid(report_id)}}
    ).sort("createdAt", -1).limit(10))
    prior_reports = [{"reason": r.get("reason"), "status": r.get("status"), "createdAt": str(r.get("createdAt"))} for r in prior_raw]
    prior_summary = {
        "total":    len(prior_reports),
        "pending":  sum(1 for r in prior_reports if r["status"] == "pending"),
        "resolved": sum(1 for r in prior_reports if r["status"] == "resolved"),
        "declined": sum(1 for r in prior_reports if r["status"] == "declined"),
        "reports":  prior_reports,
    }

    # Reviews
    reviews = []
    if rd.get("collection") == "worker" or rd.get("role") == "worker":
        for rv in collection_reviews.find({"workerId": reported_id}).sort("createdAt", -1).limit(10):
            reviews.append({
                "stars":     rv.get("stars"),
                "text":      (rv.get("text", "") or "")[:200],
                "createdAt": str(rv.get("createdAt")),
            })

    # Jobs
    jobs = []
    for j in collection_task.find(
        {"$or": [{"userId": reported_id}, {"assignedWorkerId": reported_id}]}
    ).sort("createdAt", -1).limit(10):
        jobs.append({
            "taskType":      j.get("taskType"),
            "status":        j.get("status"),
            "paymentStatus": j.get("payment_status"),
            "escrowStatus":  j.get("escrow_status"),
            "totalCost":     j.get("totalCost"),
        })

    # Chat
    messages = []
    for msg in chat_collection.find({
        "$or": [
            {"sender_id": reporter_id, "receiver_id": reported_id},
            {"sender_id": reported_id, "receiver_id": reporter_id},
        ]
    }).sort("timestamp", 1).limit(20):
        messages.append({
            "sender":    "reporter" if msg.get("sender_id") == reporter_id else "reported",
            "message":   (msg.get("message") or "")[:200],
            "timestamp": str(msg.get("timestamp", "")),
        })

    return {
        "report":          report,
        "task":            task,
        "refundCalc":      refund_calc,
        "reporterProfile": reporter_profile,
        "reportedProfile": reported_profile,
        "priorReports":    prior_summary,
        "reviews":         reviews,
        "jobs":            jobs,
        "chat":            {"total": len(messages), "messages": messages},
    }

# Build LLM prompt
def _build_review_prompt(ctx: dict) -> str:
    r   = ctx["report"]
    rpr = ctx["reporterProfile"]
    rpd = ctx["reportedProfile"]
    pri = ctx["priorReports"]
    rvs = ctx["reviews"]
    jbs = ctx["jobs"]
    cht = ctx["chat"]
    task = ctx.get("task", {})
    refund = ctx.get("refundCalc", {})

    chat_lines   = "\n".join(f"  [{m['sender'].upper()}]: {m['message']}" for m in cht["messages"]) or "  No conversation history."
    prior_lines  = "\n".join(f"  - {r['reason']} -> {r['status']} ({r['createdAt'][:10]})" for r in pri["reports"]) or "  No prior reports."
    review_lines = "\n".join(f"  - {rv['stars']} stars: \"{rv['text']}\"" for rv in rvs) or "  No reviews."
    job_lines    = "\n".join(f"  - {j['taskType']} | {j['status']} | payment:{j['paymentStatus']} | escrow:{j['escrowStatus']}" for j in jbs) or "  No job history."

    # ── Task details ──────────────────────────────────────────────────────────
    escrow      = task.get("escrow_status", "unknown")
    pay_status  = task.get("payment_status", "unknown")
    task_status = task.get("status", "unknown")
    total_cost  = task.get("totalCost") or task.get("basePrice") or 0
    created_at  = task.get("createdAt")
    cancelled_at = task.get("cancelledAt")
    paid_at     = task.get("paid_at")

    # ── Compute cancellation window ───────────────────────────────────────────
    cancellation_note = ""
    refund_policy     = ""

    if created_at and cancelled_at:
        try:
            from datetime import timezone
            # normalize to aware datetimes
            def _aware(dt):
                if isinstance(dt, str):
                    from datetime import datetime as _dt
                    dt = _dt.fromisoformat(dt.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt

            c_at  = _aware(created_at)
            ca_at = _aware(cancelled_at)
            diff_hours = (ca_at - c_at).total_seconds() / 3600

            cancellation_note = f"Task created at {c_at.isoformat()}, cancelled at {ca_at.isoformat()} — {diff_hours:.1f} hours after creation."

            if diff_hours >= 4:
                refund_policy = "FULL REFUND eligible — cancelled 4+ hours before task start. No penalty to worker."
            elif diff_hours >= 3:
                refund_policy = "PARTIAL REFUND — cancelled 3–4 hours before task start. Worker charged 25% penalty; customer refunded 75% of total cost."
            elif diff_hours >= 2:
                refund_policy = "PARTIAL REFUND — cancelled 2–3 hours before task start. Worker charged 25% penalty; customer refunded 75% of total cost."
            else:
                refund_policy = "LATE CANCELLATION — cancelled less than 2 hours before task start. Refund policy at admin discretion."
        except Exception as e:
            cancellation_note = f"Could not compute cancellation window: {str(e)}"
            refund_policy     = "Manual review required."
    elif task_status == "cancelled" and not cancelled_at:
        cancellation_note = "Task is cancelled but no cancelledAt timestamp found — manual review required."
        refund_policy     = "Cannot determine refund eligibility without cancellation timestamp."

    # ── Escrow / refund feasibility ───────────────────────────────────────────
    if escrow == "held":
        escrow_note = "Escrow is HELD — refund is fully possible. Funds have not been released to worker."
    elif escrow == "released":
        escrow_note = "Escrow is RELEASED — funds already sent to worker. Refund is highly unlikely without worker cooperation or admin override."
    elif escrow == "refunded":
        escrow_note = "Escrow already REFUNDED — no further action needed."
    elif escrow == "pending":
        escrow_note = "Escrow is PENDING — payment may not have completed. Verify payment status before processing refund."
    else:
        escrow_note = f"Escrow status unknown: {escrow}."

    # ── Mid-task cancellation ─────────────────────────────────────────────────
    mid_task_note = ""
    if task_status in ("in_progress", "confirmed") and r.get("reason"):
        mid_task_note = f"""
MID-TASK DISPUTE DETECTED
Task status is '{task_status}' — work may have started or be ongoing.
Report reason: {r.get('reason')}
In mid-task cancellations, refund amount should be based on:
  - Evidence of work completed (photos, chat, job history)
  - Severity of the reported issue
  - Whether the worker was at fault (misconduct, no-show, fraud)
  - Admin should review chat and job history carefully before deciding refund amount.
"""

    # ── Refund section ────────────────────────────────────────────────────────
    refund_section = f"""
CALCULATED REFUND (Policy-Based, NON-AI)
Type: {refund.get('refund_type', 'unknown')}
Refund Amount: NPR {refund.get('refund_amount', 0)}
Worker Penalty: NPR {refund.get('penalty_amount', 0)}
Note: {refund.get('note', 'N/A')}
"""

    risk_score = 0
    if rpd.get("ratings") and rpd["ratings"] < 3:
        risk_score += 0.2
    risk_score += min(pri["pending"], 3) * 0.1
    risk_score += min(cht["total"], 20) * 0.01
    severity_hint = "High" if risk_score >= 0.6 else "Medium" if risk_score >= 0.3 else "Low"

    return f"""You are a senior trust & safety analyst for a TaskRabbit-style gig platform. Analyze this report using all provided context. Be fair and realistic; avoid exaggeration. Return ONLY valid JSON with no markdown or extra text.

REPORT
Reason: {r.get("reason")}
Description: "{r.get('description') or 'None provided'}"

{refund_section}

REPORTER
Name: {rpr['name'] or 'Unknown'}
Role: {rpr['role']}
Status: {rpr['status']}
Rating: {rpr['ratings'] or 'N/A'}
Jobs completed: {rpr['completedTasks'] or 'N/A'}

REPORTED USER
Name: {rpd['name'] or 'Unknown'}
Role: {rpd['role']}
Status: {rpd['status']}
Rating: {rpd['ratings'] or 'N/A'} ({rpd.get('reviewCount',0)} reviews)
Jobs done: {rpd.get('completedTasks','N/A')}
Verified: face={rpd.get('faceVerified',False)}, skill={rpd.get('skillVerified',False)}
Description: "{rpd.get('description','None')}"

TASK DETAILS
Status: {task_status}
Total Cost: NPR {total_cost}
Payment Status: {pay_status}
Created At: {created_at}
Paid At: {paid_at}
Cancelled At: {cancelled_at or 'N/A'}

ESCROW STATUS
{escrow_note}

CANCELLATION TIMELINE
{cancellation_note or 'No cancellation data available.'}

REFUND POLICY APPLICABLE
{refund_policy or 'N/A — task not cancelled.'}
{mid_task_note}

PRIOR REPORTS AGAINST REPORTED USER
Total: {pri['total']} ({pri['resolved']} resolved, {pri['declined']} declined, {pri['pending']} pending)
{prior_lines}

REVIEWS
{review_lines}

JOB HISTORY
{job_lines}

CHAT ({cht['total']} messages)
{chat_lines}

INSTRUCTIONS
- Consider frequency and recency of disputes/reports.
- Check chat for threats, off-platform requests, or inconsistencies.
- Weigh prior reports, ratings, verification, and reviews to assess risk.
- Use severity hint: {severity_hint}.
- Return balanced JSON reflecting realistic risk.
- Consider severity based on confirmed incidents, verified fraud reports, or clear evidence from chat.
- Treat minor disputes, repeated greetings, or slight pricing inconsistencies as Medium risk, not High.
- Only recommend permanent ban for repeated, confirmed fraud or scam.
- The refund calculation above is based on platform policy and is deterministic (not AI-generated).
- Use the calculated refund as your baseline recommendation.
- For "manual" refund types, recommend a specific percentage or amount based on evidence of work completed and fault.
- For "blocked" refund types (escrow released), note that refund is unlikely but can suggest admin review.
- Always include refundRecommendation, refundAmount, and refundReason in your response.
- Your refundRecommendation should match the calculated refund_type unless there's strong evidence to deviate.
- Your refundAmount should match the calculated refund_amount unless there's strong evidence to adjust.

FORMATTING REQUIREMENTS:
- summary: Write in third person. Use actual names provided above. Be specific about the dispute type and task. Example: "Customer Jane Doe reported payment dispute regarding plumbing service with worker John Smith."
- severity: One word only: "Low", "Medium", or "High"
- severityReason: 1-2 sentences explaining the severity rating
- suggestedAction: MUST contain TWO parts — a financial action AND an account action for both parties.

  FINANCIAL ACTION (always specify exact NPR amount):
  * "Issue full refund of NPR 1500 to customer"
  * "Issue partial refund of NPR 1125 (75%) to customer, deduct NPR 375 penalty from worker"
  * "Manual review required — suggest 50% refund (NPR 750) based on partial work completed"
  * "No refund — escrow already released to worker"

  ACCOUNT ACTION (REQUIRED — always recommend for BOTH reporter and reported):
  Use these rules:
  - 0 prior reports + Low severity → "Warn [Name]"
  - 1–2 prior reports OR Medium severity → "Suspend [Name] for 7 days" or "14 days"
  - 3+ prior reports OR High severity OR confirmed fraud → "Permanently ban [Name]"
  - Reporter filed false/malicious report → "Warn reporter" or "Suspend reporter"
  - Reporter is credible → "No action on reporter"

  COMBINE BOTH into one string. Examples:
  * "Issue full refund of NPR 1500 to customer. Warn worker John for first offence. No action on reporter."
  * "Issue partial refund of NPR 1125 to customer, deduct NPR 375 from worker. Suspend worker Jane for 14 days due to 3 prior complaints. No action on reporter."
  * "No refund — escrow released. Permanently ban worker Ahmed — confirmed fraud pattern across 5 reports. No action on reporter."
  * "No financial action. Warn customer for unsubstantiated claim. No action on worker."

  NEVER write vague actions like "take appropriate action" or "refund the customer".
  ALWAYS name the person. ALWAYS specify the exact account consequence.

- actionReason: 2-3 sentences — first explain the financial decision based on refund policy, then explain the account action based on prior history, severity, and evidence.
- reporterCredibility: One word: "High", "Medium", or "Low"
- credibilityNote: 1-2 sentences about the reporter's history and reliability
- keyEvidence: Bullet points of the most important facts supporting your assessment
- redFlags: Array of specific concerns (empty array if none). Examples: ["Multiple similar reports in past month", "Worker requested off-platform payment"]
- chatInsight: 1-2 sentences about what the chat history reveals
- profileInsight: 1-2 sentences about the reported user's profile and history
- refundRecommendation: Must match refund_type from calculation above: "full", "partial", "manual", "blocked", "already_refunded", or "none"
- refundAmount: Exact NPR amount as string number matching the calculated refund_amount (e.g., "1500" not "NPR 1500")
- refundReason: 1-2 sentences explaining the refund decision based on the cancellation timeline policy stated above

CRITICAL REFUND RULES:
- If refund_type is "full": suggestedAction MUST say "Issue full refund of NPR [refund_amount] to customer"
- If refund_type is "partial": suggestedAction MUST say "Issue partial refund of NPR [refund_amount] to customer, deduct NPR [penalty_amount] from worker"
- If refund_type is "manual": suggestedAction MUST recommend a specific percentage/amount with reasoning
- If refund_type is "blocked": suggestedAction MUST acknowledge escrow is released and refund is not possible without admin override
- If refund_type is "already_refunded": suggestedAction should note no further financial action needed
- If refund_type is "none": suggestedAction should explain why no refund is warranted

Return exactly this JSON object:
{{
  "summary": "",
  "severity": "",
  "severityReason": "",
  "suggestedAction": "",
  "actionReason": "",
  "reporterCredibility": "",
  "credibilityNote": "",
  "keyEvidence": "",
  "redFlags": [],
  "chatInsight": "",
  "profileInsight": "",
  "refundRecommendation": "",
  "refundAmount": "",
  "refundReason": ""
}}"""

# ─── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/reports/{report_id}/ai-context")
def get_ai_context(report_id: str):
    return _gather_context(report_id)


@router.post("/reports/{report_id}/ai-review")
async def run_ai_review(report_id: str):
    ctx    = _gather_context(report_id)
    prompt = _build_review_prompt(ctx)
    text   = await _call_llm(prompt)

    clean = text.replace("```json", "").replace("```", "").strip()
    try:
        result = json.loads(clean)
    except json.JSONDecodeError:
        try:
            result = json.loads(clean.replace("'", '"'))
        except json.JSONDecodeError:
            raise HTTPException(status_code=502, detail=f"LLM returned invalid JSON: {clean[:300]}")

    # ── Save to history ────────────────────────────────────────────────────────
    history_doc = {
        "report_id":   report_id,
        "ai_result":   result,
        "refund_calc": ctx.get("refundCalc"),  # Save refund calculation
        "context":     ctx,
        "created_at":  datetime.now(timezone.utc),
    }
    inserted = ai_review_collection.insert_one(history_doc)
    history_id = str(inserted.inserted_id)
    # ──────────────────────────────────────────────────────────────────────────

    return {
        "historyId":   history_id,   # frontend can store this if needed
        "aiResult":    result,
        "refundCalc":  ctx.get("refundCalc"),  # Include calculated refund
        "task":        ctx.get("task"),        # Include task details
        "context":     ctx,
    }


@router.get("/reports/{report_id}/ai-review/history")
def get_review_history(report_id: str):
    """Return all past AI reviews for a given report, newest first."""
    docs = list(
        ai_review_collection
        .find({"report_id": report_id})
        .sort("created_at", -1)
    )
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
        # serialize datetime for JSON
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()

    return {"reportId": report_id, "total": len(docs), "reviews": docs}


@router.get("/ai-review/history")
def get_all_review_history(limit: int = 50, skip: int = 0):
    """Return all AI review history across all reports (admin dashboard use)."""
    docs = list(
        ai_review_collection
        .find()
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
        if isinstance(d.get("created_at"), datetime):
            d["created_at"] = d["created_at"].isoformat()

    total = ai_review_collection.count_documents({})
    return {"total": total, "limit": limit, "skip": skip, "reviews": docs}


@router.delete("/ai-review/history/{history_id}")
def delete_review_history(history_id: str):
    """Delete a single history entry by its own id."""
    oid = _safe_oid(history_id)
    if not oid:
        raise HTTPException(status_code=400, detail="Invalid history id")
    result = ai_review_collection.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"deleted": history_id}


@router.post("/reports/{report_id}/ai-draft")
async def generate_draft(report_id: str, body: DraftRequest):
    ctx = _gather_context(report_id)
    is_reported   = body.target == "reported"
    reported_name = ctx["reportedProfile"]["name"] or "User"
    reporter_name = ctx["reporterProfile"]["name"] or "User"
    report_reason = ctx["report"].get("reason", "")

    target_desc = f"the reported user ({reported_name})" if is_reported else f"the reporter ({reporter_name})"
    instruction = "Do NOT reveal the reporter's identity." if is_reported else "Thank them for reporting. Share outcome without confidential details."

    prompt = f"""You are a trust & safety admin on a gig-work platform.
Write a message to {target_desc}.
Report reason: {report_reason}
Action taken: {body.suggestedAction}
Summary: {body.summary}
Write 3-5 sentences. Professional and empathetic. {instruction}
No subject line. No sign-off. Return only the message text.
"""

    text = await _call_llm(prompt)
    return {"draft": text.strip(), "target": body.target, "name": reported_name if is_reported else reporter_name}


@router.get("/reports/{report_id}/refund-calculation")
def get_refund_calculation(report_id: str):
    """
    Standalone endpoint to get the refund calculation for a specific report.
    Useful for frontend to show refund details independently.
    """
    ctx = _gather_context(report_id)
    return {
        "reportId": report_id,
        "task": ctx.get("task"),
        "refundCalc": ctx.get("refundCalc"),
    }