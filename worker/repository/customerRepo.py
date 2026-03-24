from bson import ObjectId
from fastapi import HTTPException, status
from ..config.database import collection, collection_worker
from ..services.hashing import Hash
from datetime import datetime

def addCustomer(request):
    if collection.find_one({"email": request.email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    if collection_worker.find_one({"email": request.email}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered"
        )
    
    
    if collection.find_one({"phoneNo": request.phoneNo}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already registered"
        )
    
    hashed_password = Hash.bcrypt(request.password)
    
    user = {
        "first_name": request.first_name,
        "last_name":request.last_name, 
        "email": request.email,
        "password": hashed_password,
        "phoneNo":request.phoneNo,
        'role': 'customer'
    }
    user["registeredAt"]=datetime.utcnow()
    collection.insert_one(user)
    return {"message": "User created"}


def showCustomer():
    users = list(collection.find({}, {"password": 0}))
    for user in users:
        user["id"] = str(user["_id"])  # convert ObjectId to string
        del user["_id"]  # optional, remove original _id
    return users


def showCustomerByID(id: str):
    user = None

    # Try ObjectId lookup first (normal customer _id)
    try:
        obj_id = ObjectId(id)
        user = collection.find_one({"_id": obj_id})
    except Exception:
        pass

    # Fall back to email lookup (in case email was passed instead)
    if not user:
        user = collection.find_one({"email": id})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user["id"] = str(user["_id"])
    del user["_id"]

    return user

from bson import ObjectId

# ── Delete ──────────────────────────────────────────────────────
def deleteCustomerByID(id: str):
    result = collection.delete_one({"_id": ObjectId(id)})  # 👈 needs ObjectId()
    return result.deleted_count > 0

# ── Update status ────────────────────────────────────────────────
def updateCustomerByID(id: str, status: str):
    result = collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": status}}
    )
    return result.modified_count > 0

def update_phone(id: str, body: dict):
    result=collection.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"phoneNo": body["phoneNo"]}}
    )
    return result
