# services/search_service.py
from rapidfuzz import fuzz, process
from ..schemas.schemas import SearchSchema
from .trie import Trie
import re

class SearchService:
    _trie: Trie = None
    _tasks: dict[str, SearchSchema] = {}  # id → task lookup

    @classmethod
    def build(cls, tasks: list[SearchSchema]):
        """Build trie + lookup map. Call this on startup and nightly."""
        cls._tasks = {task.id: task for task in tasks}
        cls._trie = Trie()
        cls._trie.build_from_tasks(tasks)
        print(f"✅ Trie built with {len(tasks)} tasks")

    import re

    @classmethod
    def search(cls, q: str, limit: int = 5) -> list[SearchSchema]:
        if not cls._trie:
            return []

        # ← clean query the same way as keywords
        q = re.sub(r'[^a-zA-Z0-9\s]', '', q.strip().lower())
        words = q.split()
        seen_ids = set()
        results = []

        if words:
            matched_ids = set(cls._trie.search(words[0]))
            for word in words[1:]:
                matched_ids &= set(cls._trie.search(word))

            for tid in matched_ids:
                if tid not in seen_ids:
                    seen_ids.add(tid)
                    results.append(cls._tasks[tid])

        if len(results) < limit:
            all_names = [t.name for t in cls._tasks.values()]
            fuzzy_matches = process.extract(
                q,
                all_names,
                scorer=fuzz.WRatio,
                limit=limit * 2,
                score_cutoff=45,
            )
            for match_name, score, _ in fuzzy_matches:
                for task in cls._tasks.values():
                    if task.name == match_name and task.id not in seen_ids:
                        seen_ids.add(task.id)
                        results.append(task)

        return results[:limit]