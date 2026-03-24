import os
import json
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId

from ..config.database import (
    collection_reports,
    collection,   # adjust to your actual collection names
    collection_worker,
    collection_reviews,
    collection_task,
    chat_collection,
)

router = APIRouter(tags=["ai-review"])

# Groq config
# Free at: https://console.groq.com → API Keys → Create API Key
# No credit card needed. Add to your .env:  GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

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
    try: return ObjectId(val)
    except: return None

def _get_user(user_id: str) -> dict:
    """Try customers first, then workers. Returns {} if user_id is None or not found."""
    if not user_id:
        return {}

    oid_query = {"_id": _safe_oid(user_id)} if len(user_id) == 24 else {"_id": None}

    doc = collection.find_one({"$or": [oid_query, {"email": user_id}]})
    if doc: return {"collection": "customer", **_sid(doc)}

    doc = collection_worker.find_one({"$or": [oid_query, {"email": user_id}]})
    if doc: return {"collection": "worker", **_sid(doc)}
    return {}

async def _call_llm(prompt: str) -> str:
    """Call Groq API and return raw text response."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=30) as client:
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

    if res.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Groq error: {res.text}")

    data = res.json()
    return data["choices"][0]["message"]["content"]

def _gather_context(report_id: str) -> dict:
    """Fetch all data needed for AI review — shared by both endpoints."""
    report = collection_reports.find_one({"_id": _safe_oid(report_id)})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report = _sid(report)

    reporter_id = report.get("reporterId") or ""
    reported_id = report.get("reportedId") or ""

    # Reporter profile
    rr = _get_user(reporter_id)
    reporter_profile = {
        "id":             reporter_id,
        "name":           f"{rr.get('first_name') or rr.get('firstName','')} {rr.get('last_name') or rr.get('lastName','')}".strip(),
        "email":          rr.get("email", reporter_id),
        "role":           rr.get("role") or rr.get("collection", "unknown"),
        "status":         rr.get("status", "active"),
        "ratings":        rr.get("ratings"),
        "completedTasks": rr.get("noOfCompletedTask"),
    }

    # Reported user profile
    rd = _get_user(reported_id)
    reported_profile = {
        "id":             reported_id,
        "name":           f"{rd.get('first_name') or rd.get('firstName','')} {rd.get('last_name') or rd.get('lastName','')}".strip(),
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

    # Prior reports against reported user
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

    # Reviews (workers only)
    reviews = []
    if rd.get("collection") == "worker" or rd.get("role") == "worker":
        for rv in collection_reviews.find({"workerId": reported_id}).sort("createdAt", -1).limit(10):
            reviews.append({
                "stars":     rv.get("stars"),
                "text":      (rv.get("text", ""))[:200],
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
    }).sort("timestamp", 1).limit(50):
        messages.append({
            "sender":    "reporter" if msg.get("sender_id") == reporter_id else "reported",
            "message":   msg.get("message", ""),
            "timestamp": str(msg.get("timestamp", "")),
        })

    return {
        "report":          report,
        "reporterProfile": reporter_profile,
        "reportedProfile": reported_profile,
        "priorReports":    prior_summary,
        "reviews":         reviews,
        "jobs":            jobs,
        "chat":            {"total": len(messages), "messages": messages},
    }

def _build_review_prompt(ctx: dict) -> str:
    r   = ctx["report"]
    rpr = ctx["reporterProfile"]
    rpd = ctx["reportedProfile"]
    pri = ctx["priorReports"]
    rvs = ctx["reviews"]
    jbs = ctx["jobs"]
    cht = ctx["chat"]

    chat_lines   = "\n".join(f"  [{m['sender'].upper()}]: {m['message']}" for m in cht["messages"]) or "  No conversation history."
    prior_lines  = "\n".join(f"  - {r['reason']} -> {r['status']} ({r['createdAt'][:10]})" for r in pri["reports"]) or "  No prior reports."
    review_lines = "\n".join(f"  - {rv['stars']} stars: \"{rv['text']}\"" for rv in rvs) or "  No reviews."
    job_lines    = "\n".join(f"  - {j['taskType']} | {j['status']} | payment:{j['paymentStatus']} | escrow:{j['escrowStatus']}" for j in jbs) or "  No job history."

    return f"""You are a senior trust & safety analyst for a TaskRabbit-style gig platform. Analyze this report using ALL provided context. Return ONLY valid JSON with no markdown fences, no extra text, just the raw JSON object.

REPORT
Reason: {r.get("reason")}
Description: "{r.get("description") or "None provided"}"

REPORTER
Name: {rpr["name"] or "Unknown"}
Role: {rpr["role"]}
Status: {rpr["status"]}
Rating: {rpr["ratings"] or "N/A"}
Jobs completed: {rpr["completedTasks"] or "N/A"}

REPORTED USER
Name: {rpd["name"] or "Unknown"}
Role: {rpd["role"]}
Status: {rpd["status"]}
Rating: {rpd["ratings"] or "N/A"} ({rpd["reviewCount"] or 0} reviews)
Jobs done: {rpd["completedTasks"] or "N/A"}
Verified: face={rpd["faceVerified"]}, skill={rpd["skillVerified"]}
Description: "{rpd["description"] or "None"}"

PRIOR REPORTS AGAINST REPORTED USER
Total: {pri["total"]} ({pri["resolved"]} resolved, {pri["declined"]} declined, {pri["pending"]} pending)
{prior_lines}

REVIEWS
{review_lines}

JOB HISTORY
{job_lines}

CHAT ({cht["total"]} messages)
{chat_lines}

INSTRUCTIONS
Cross-reference ALL sections. Look for: repeat offender patterns, contradictions between reviews and complaints, off-platform payment requests or threats in chat, escrow/payment anomalies, unverified profile with complaints, whether the description matches the actual chat.

Return exactly this JSON object and nothing else:
{{
  "summary": "3-4 sentences cross-referencing chat, prior history, and reviews",
  "severity": "Critical|High|Medium|Low",
  "severityReason": "One sentence with specific evidence from any data source",
  "suggestedAction": "Warn user|Suspend account|Permanent ban|Dismiss report",
  "actionReason": "One sentence referencing prior reports, chat, or reviews",
  "reporterCredibility": "High|Medium|Low",
  "credibilityNote": "Does the chat and job history support or contradict the reporter?",
  "keyEvidence": "The single most important piece of evidence across all sources",
  "redFlags": ["max 4 specific red flags found"],
  "chatInsight": "What the conversation reveals beyond the description, or N/A",
  "profileInsight": "Anything suspicious in profile, reviews, or job history, or N/A"
}}"""

# Endpoints

# GET /reports/{id}/ai-context
# Returns raw context only — used by frontend Context + Chat tabs
@router.get("/reports/{report_id}/ai-context")
def get_ai_context(report_id: str):
    return _gather_context(report_id)


# GET /reports/{id}/debug-prior  <-- TEMPORARY, remove after fixing
@router.get("/reports/{report_id}/debug-prior")
def debug_prior_reports(report_id: str):
    report = collection_reports.find_one({"_id": _safe_oid(report_id)})
    if not report:
        return {"error": "report not found"}
    reported_id = report.get("reportedId") or ""
    all_against = list(collection_reports.find({"reportedId": reported_id}))
    sample_fields = []
    for r in collection_reports.find().limit(5):
        sample_fields.append({
            "id":         str(r.get("_id")),
            "reportedId": r.get("reportedId"),
            "reporterId": r.get("reporterId"),
            "reason":     r.get("reason"),
            "status":     r.get("status"),
        })
    return {
        "current_report_id":  report_id,
        "reported_id_value":  reported_id,
        "reported_id_type":   type(reported_id).__name__,
        "total_found":        len(all_against),
        "matches": [{"id": str(r.get("_id")), "reportedId": r.get("reportedId"), "reason": r.get("reason"), "status": r.get("status")} for r in all_against],
        "sample_5_reports": sample_fields,
    }


# POST /reports/{id}/ai-review
# Gathers context + calls Groq server-side — returns AI analysis result
# API key stays on the server, never sent to browser
@router.post("/reports/{report_id}/ai-review")
async def run_ai_review(report_id: str):
    ctx    = _gather_context(report_id)
    prompt = _build_review_prompt(ctx)
    text   = await _call_llm(prompt)

    clean = text.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(clean)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail=f"LLM returned invalid JSON: {clean[:200]}")

    return {
        "aiResult": result,
        "context":  ctx,
    }


# POST /reports/{id}/ai-draft
# Generates a message draft for reporter or reported user
@router.post("/reports/{report_id}/ai-draft")
async def generate_draft(report_id: str, body: DraftRequest):
    ctx = _gather_context(report_id)

    is_reported   = body.target == "reported"
    reported_name = ctx["reportedProfile"]["name"] or "User"
    reporter_name = ctx["reporterProfile"]["name"] or "User"
    report_reason = ctx["report"].get("reason", "")

    target_desc = f"the reported user ({reported_name})" if is_reported else f"the reporter ({reporter_name})"
    instruction = "Do NOT reveal the reporter's identity. Reference only the report category." if is_reported else "Thank them for reporting. Share the outcome without confidential details about the other party."

    prompt = f"""You are a trust & safety admin on a gig-work platform.
Write a message to {target_desc}.
Report reason: {report_reason}
Action taken: {body.suggestedAction}
Summary: {body.summary}
Write 3-5 sentences. Professional and empathetic. {instruction}
No subject line. No sign-off. Return only the message text."""

    text = await _call_llm(prompt)
    return {
        "draft":  text.strip(),
        "target": body.target,
        "name":   reported_name if is_reported else reporter_name,
    }