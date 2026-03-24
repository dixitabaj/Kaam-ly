import json
import re
from ..schemas.schemas import SearchSchema

def load_tasks(file_path: str) -> list[SearchSchema]:
    with open(file_path, "r") as f:
        data = json.load(f)
    
    tasks = []
    for i, task in enumerate(data):
        task_text = task.get("text", "")
        # ← strip punctuation before splitting keywords
        clean_text = re.sub(r'[^a-zA-Z0-9\s]', '', task_text).lower()
        tasks.append(SearchSchema(
            id=str(i + 1),
            name=task_text,  # keep original name for display
            category=task.get("broad_category", "General"),
            subcategory=task.get("subcategory", ""),
            keywords=clean_text.split()  # clean keywords
        ))
    return tasks