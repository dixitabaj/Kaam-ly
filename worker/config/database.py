from pymongo.mongo_client import MongoClient #allows your code to connect to mongodb
from pymongo.server_api import ServerApi 


client = MongoClient(MONGO_URI, server_api=ServerApi('1')) #tells to use server 1

db = client['user']   # worker is the name of the database
collection=db['customer'] #could be referred as tables
collection_worker=db['worker']
collection_task=db['task']
chat_collection = db["chats"]
collection_notification=db['notification']
interactions_col = db["interactions"]
collection_reviews=db['reviews']
collection_reports=db['report']
worker_calendar=db['worker_calendar']
refund_collection = db["refunds"]




