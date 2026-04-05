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
    db,  # <-- import db so we can create the new collection
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
ai_review_history = db["ai_review_history"]

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

    rr = _get_user(reporter_id)
    rd = _get_user(reported_id)

    reporter_profile = {
        "id":             reporter_id,
        "name":           f"{rr.get('first_name') or rr.get('firstName','')} {rr.get('last_name') or rr.get('lastName','')}".strip(),
        "email":          rr.get("email", reporter_id),
        "role":           rr.get("role") or rr.get("collection", "unknown"),
        "status":         rr.get("status", "active"),
        "ratings":        rr.get("ratings"),
        "completedTasks": rr.get("noOfCompletedTask"),
    }

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

    chat_lines   = "\n".join(f"  [{m['sender'].upper()}]: {m['message']}" for m in cht["messages"]) or "  No conversation history."
    prior_lines  = "\n".join(f"  - {r['reason']} -> {r['status']} ({r['createdAt'][:10]})" for r in pri["reports"]) or "  No prior reports."
    review_lines = "\n".join(f"  - {rv['stars']} stars: \"{rv['text']}\"" for rv in rvs) or "  No reviews."
    job_lines    = "\n".join(f"  - {j['taskType']} | {j['status']} | payment:{j['paymentStatus']} | escrow:{j['escrowStatus']}" for j in jbs) or "  No job history."

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
  "profileInsight": ""
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
        "report_id":  report_id,
        "ai_result":  result,
        "context":    ctx,
        "created_at": datetime.now(timezone.utc),
    }
    inserted = ai_review_history.insert_one(history_doc)
    history_id = str(inserted.inserted_id)
    # ──────────────────────────────────────────────────────────────────────────

    return {
        "historyId": history_id,   # frontend can store this if needed
        "aiResult":  result,
        "context":   ctx,
    }


@router.get("/reports/{report_id}/ai-review/history")
def get_review_history(report_id: str):
    """Return all past AI reviews for a given report, newest first."""
    docs = list(
        ai_review_history
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
        ai_review_history
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

    total = ai_review_history.count_documents({})
    return {"total": total, "limit": limit, "skip": skip, "reviews": docs}


@router.delete("/ai-review/history/{history_id}")
def delete_review_history(history_id: str):
    """Delete a single history entry by its own id."""
    oid = _safe_oid(history_id)
    if not oid:
        raise HTTPException(status_code=400, detail="Invalid history id")
    result = ai_review_history.delete_one({"_id": oid})
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