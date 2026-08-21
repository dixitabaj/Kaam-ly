from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os, asyncio, re, json
from ..config.database import collection_worker

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from dotenv import load_dotenv
_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

load_dotenv(os.path.join(_dir, ".env"))  # ← explicit path

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
print("DEBUG KEY:", GOOGLE_API_KEY)  # ← add this

router = APIRouter()

# ── Load FAQ data ─────────────────────────────────────────────────────────────

_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

with open(os.path.join(_dir, "faq.json"), "r") as f:
    faq_data = json.load(f)

with open(os.path.join(_dir, "faq-worker.json"), "r") as f:
    worker_faq_data = json.load(f)


# ── Shared models & utilities ─────────────────────────────────────────────────

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
    support_number = "91283728362"
    text = re.sub(r'\b(?!' + support_number + r')\d{7,15}\b', '[hidden]', text)
    text = re.sub(r'\S+@\S+\.\S+', '[hidden]', text)
    return text

def search_faq(query: str, faq_list: list, n: int = 5):
    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored = []
    for faq in faq_list:
        q_lower = faq["question"].lower()
        a_lower = faq["answer"].lower()
        faq_words = set((q_lower + " " + a_lower).split())
        overlap = len(query_words & faq_words)
        if overlap > 0:
            scored.append((overlap, faq))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [faq for _, faq in scored[:n]]


async def search_workers_mongo(query: str, n: int = 5):
    try:
        results = await collection_worker.find({
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


def build_model():
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        api_key=GOOGLE_API_KEY,
        temperature=0
    )


# ── User chatbot ──────────────────────────────────────────────────────────────

async def call_agent(message: str):
    workers = await search_workers_mongo(message)
    faqs = search_faq(message, faq_data)

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

    system_prompt = """You are Kaami, the friendly AI assistant for Kaam-ly — a platform for booking trusted home service workers in Nepal.

STRICT RULES — follow these exactly:
1. ONLY answer using the FAQ and worker information provided in the context below.
2. If the answer is NOT in the context, say exactly: "I don't have that information right now. Please contact our support team for help at 91283728362."
3. NEVER make up steps, phone numbers, emails, links, or instructions that aren't in the context.
4. NEVER tell users to navigate to sections or buttons that you haven't confirmed exist (e.g. don't say "go to Help & Support > Report a User" unless the FAQ says so).
5. For reporting a user or contacting support, tell the user to use the buttons provided in the chat widget — do not invent a process.
6. Keep answers concise, friendly, and clear.
7. Do not reveal any personal contact details.

CONTEXT:
{context}
"""

    system_prompt_filled = system_prompt.replace(
        "{context}",
        context_text if has_context else "No relevant FAQ or worker data found for this query."
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt_filled),
        ("human", "{message}")
    ])

    async def run_model():
        formatted = prompt.format_messages(message=message)
        result = await build_model().agenerate([formatted])
        answer = result.generations[0][0].text
        return sanitize_response(answer)

    return await retry_with_backoff(run_model)


# ── Worker chatbot ────────────────────────────────────────────────────────────

async def call_worker_agent(message: str):
    faqs = search_faq(message, worker_faq_data)

    context_parts = []

    if faqs:
        faq_text = "\n".join([f"Q: {f['question']}\nA: {f['answer']}" for f in faqs])
        context_parts.append(f"RELEVANT FAQ ENTRIES:\n{faq_text}")

    context_text = "\n\n".join(context_parts)
    has_context = bool(context_text.strip())

    system_prompt = """You are Kaami, the friendly AI assistant for Kaam-ly — helping workers on the platform.

STRICT RULES — follow these exactly:
1. ONLY answer using the FAQ information provided in the context below.
2. If the answer is NOT in the context, say exactly: "I don't have that information right now. Please contact our support team for help."
3. NEVER make up steps, phone numbers, emails, links, or instructions that aren't in the context.
4. NEVER tell workers to navigate to sections or buttons you haven't confirmed exist.
5. For reporting issues or contacting support, tell the worker to use the buttons provided in the chat widget.
6. Keep answers concise, friendly, and clear.
7. Do not reveal any personal contact details.

CONTEXT:
{context}
"""

    system_prompt_filled = system_prompt.replace(
        "{context}",
        context_text if has_context else "No relevant FAQ data found for this query."
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt_filled),
        ("human", "{message}")
    ])

    async def run_model():
        formatted = prompt.format_messages(message=message)
        result = await build_model().agenerate([formatted])
        answer = result.generations[0][0].text
        return sanitize_response(answer)

    return await retry_with_backoff(run_model)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/chatbot")
async def user_chat(request: ChatRequest):
    try:
        response = await call_agent(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/worker/chatbot")
async def worker_chat(request: ChatRequest):
    try:
        response = await call_worker_agent(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))