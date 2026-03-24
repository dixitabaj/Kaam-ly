from fastapi import APIRouter, status, Response
from ..schemas import schemas
from ..config import database

router = APIRouter()

@router.get('/api/checkEmailExists')
def checkEmailExists(email: str):
    exists = bool(
        database.collection.find_one({'email': email}) or
        database.collection_worker.find_one({'email': email})
    )
    return {"exists": exists}


@router.get('/api/checkCusPhone')
def checkPhoneExistsForCustomer(phoneNo:str):
    exists=database.collection.find_one({'phoneNo': phoneNo}) is not None
    return {"exists": exists}

@router.get('/api/checkWorkerPhone')
def checkPhoneExistsForWorker(phoneNo:str):
    exists=database.collection_worker.find_one({'phoneNo': phoneNo}) is not None
    return {"exists": exists}
