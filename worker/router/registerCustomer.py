# routers/registerCustomer.py
from fastapi import APIRouter, HTTPException
from datetime import timedelta
from ..schemas import schemas
from ..schemas.schemas import GoogleLogin, GoogleLoginResponse, StatusUpdate
from ..repository import customerRepo
from ..repository.googleLoginRepo import GoogleLoginRepo
from ..services.auth import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter()

@router.post('/customer', tags=['customer'])
def addCustomer(request: schemas.CustomerSchema):
    return customerRepo.addCustomer(request)

@router.get('/customer/all', tags=['customer'])
def showCustomer():
    return customerRepo.showCustomer()

@router.get('/customer/{id}', tags=['customer'])
def showCustomerById(id: str):
    return customerRepo.showCustomerByID(id)

@router.post("/google-login")
def google_login(data: GoogleLogin):
    return GoogleLoginRepo(data)

@router.delete("/customer/{id}")
async def delete_customer(id: str):
    success = customerRepo.deleteCustomerByID(id)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted successfully"}

@router.patch("/customer/{id}/status")
async def update_customer_status(id: str, body: StatusUpdate):
    success = customerRepo.updateCustomerByID(id, body.status)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Status updated successfully"}

@router.patch('/customer/{id}/phone')
def update_phone(id: str, body: dict):
    phone = body.get("phoneNo")
    if not phone:
        raise HTTPException(status_code=400, detail="Phone number is required")

    # Check duplicate in customers
    from ..config.database import collection, collection_worker
    from bson import ObjectId

    existing_customer = collection.find_one({
        "phoneNo": phone,
        "_id": {"$ne": ObjectId(id)}   # exclude the current user
    })
    if existing_customer:
        raise HTTPException(status_code=400, detail="This phone number is already registered")

    # Check duplicate in workers
    existing_worker = collection_worker.find_one({"phoneNo": phone})
    if existing_worker:
        raise HTTPException(status_code=400, detail="This phone number is already registered")

    success = customerRepo.update_phone(id, body)
    if not success:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Phone updated"}