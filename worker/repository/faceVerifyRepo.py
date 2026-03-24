# app/repositories/face_repository.py
from typing import Dict

# Dummy in-memory repository (replace with DB later)
verification_db: Dict[str, dict] = {}

class FaceRepository:

    @staticmethod
    def save_verification(user_id: str, result: dict):
        verification_db[user_id] = result
        return verification_db[user_id]

    @staticmethod
    def get_verification(user_id: str):
        return verification_db.get(user_id)
