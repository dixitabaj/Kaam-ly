from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi 
import os
from dotenv import load_dotenv

# database.py is in worker/config/, so .. goes up to worker/ where .env is
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGO_URI = os.getenv("MONGO_URI")
print("MONGO_URI:", MONGO_URI)  # Add this to confirm it loads

client = MongoClient(MONGO_URI, server_api=ServerApi('1'))

db = client['user']
collection = db['customer']
collection_worker = db['worker']
collection_task = db['task']
chat_collection = db["chats"]
collection_notification = db['notification']
interactions_col = db["interactions"]
collection_reviews = db['reviews']
collection_reports = db['report']
worker_calendar = db['worker_calendar']
refund_collection = db["refunds"]
collection_payment = db["payments"]
ai_review_collection = db["ai_review_history"]
