# server.py — Kaam-ly Full Backend
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import os, time, asyncio, re
import json
# LangChain imports
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

#
MONGO_URI = "mongodb+srv://dixita1:dixita@cluster0.ue3kxzv.mongodb.net/?appName=Cluster0" #datatbase to connect to cluster0.ue3kxzv.mongodb.net, connection type: mongodb+srv(cloud cluster)

GOOGLE_API_KEY="AIzaSyAGHgJDlgax7llDHiU1NblWr2ZRezGSpn0"


if not MONGO_URI or not GOOGLE_API_KEY:
    raise ValueError("MONGO_URI or GOOGLE_API_KEY not set in .env")

# MongoDB
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_database("kaamly_database")
workers_collection = db.get_collection("workers")

# Load FAQ JSON
with open("faq.json", "r") as f:
    faq_data = json.load(f)

# FastAPI
app = FastAPI()

# Request schema
class ChatRequest(BaseModel):
    message: str

# Retry logic
async def retry_with_backoff(fn, max_retries=3):
    for attempt in range(1, max_retries + 1):
        try:
            return await fn()
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                delay = min(2 ** attempt, 30)
                print(f"Rate limit hit. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                continue
            raise e
    raise Exception("Max retries exceeded")

# Sanitize AI response
def sanitize_response(text: str) -> str:
    text = re.sub(r'\b\d{7,15}\b', '[hidden]', text)           # phone numbers
    text = re.sub(r'\S+@\S+\.\S+', '[hidden]', text)           # emails
    text = re.sub(r'\d{1,5}\s\w+(\s\w+)*', '[hidden]', text)   # addresses (basic)
    return text

# Search workers in MongoDB
async def search_workers_mongo(query: str, n: int = 10):
    results = await workers_collection.find({
        "$or": [
            {"name": {"$regex": query, "$options": "i"}},
            {"service_type": {"$regex": query, "$options": "i"}},
            {"availability": {"$regex": query, "$options": "i"}}
        ]
    }).to_list(n)
    # Return only safe fields
    safe_results = [{"name": w["name"], "service_type": w["service_type"], "availability": w.get("availability","Not available")} for w in results]
    return safe_results

# Search FAQ in JSON
def search_faq_json(query, n=5):
    query_lower = query.lower()
    results = [f for f in faq_data if query_lower in f["question"].lower()]
    return results[:n]

# AI agent
async def call_agent(message: str):
    workers = await search_workers_mongo(message)
    faqs = search_faq_json(message)

    context_text = ""
    if workers:
        context_text += "Workers info:\n" + "\n".join(
            [f"{w['name']} ({w['service_type']}): {w['availability']}" for w in workers]
        ) + "\n\n"
    if faqs:
        context_text += "FAQ info:\n" + "\n".join(
            [f"Q: {f['question']} A: {f['answer']}" for f in faqs]
        ) + "\n\n"

    # Gemini AI model
    model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",  # Matches the first item in your curl list!
    api_key=GOOGLE_API_KEY,
    temperature=0
)

    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are Kaam-ly AI assistant. NEVER reveal phone numbers, emails, or addresses. Use only provided worker info from MongoDB and FAQ info from JSON."),
        ("human", "{message}")
    ])

    async def run_model():
        formatted_prompt = prompt.format_messages(message=context_text + message)
        result = await model.agenerate([formatted_prompt])
        answer = result.generations[0][0].text
        return sanitize_response(answer)

    return await retry_with_backoff(run_model)

# Endpoints
@app.get("/")
async def root():
    return {"message": "Kaam-ly AI Server running"}

@app.post("/chat")
async def start_chat(request: ChatRequest):
    try:
        response = await call_agent(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))