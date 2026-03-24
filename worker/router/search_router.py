# router.py
from fastapi import APIRouter, Query
from typing import List
from ..repository.search_repo import load_tasks
from ..services.search_service import SearchService
from ..schemas.schemas import SearchSchema
import asyncio

router = APIRouter(prefix="/search", tags=["Search"])

JSON_PATH = "/Users/dixitabajracharya/kaam-ly/search_recommendation.json"

# ── Build trie on startup ──
tasks = load_tasks(JSON_PATH)
SearchService.build(tasks)


@router.get("/", response_model=List[SearchSchema])
def search_tasks(q: str = Query(..., min_length=1), limit: int = 5):
    return SearchService.search(q, limit)


# ── Nightly rebuild endpoint (call this from a cron job) ──
@router.post("/rebuild")
def rebuild_index():
    """
    Rebuilds the trie from the JSON file.
    Call this nightly via cron or whenever you update the JSON:
      curl -X POST http://localhost:8000/search/rebuild
    """
    fresh_tasks = load_tasks(JSON_PATH)
    SearchService.build(fresh_tasks)
    return {"message": f"Index rebuilt with {len(fresh_tasks)} tasks"}