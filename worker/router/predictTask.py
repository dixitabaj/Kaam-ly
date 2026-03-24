from fastapi import APIRouter
from ..schemas.schemas import TextInput, PredictionResponse
from ..services.taskClassPred import run_prediction

router = APIRouter()

@router.post("/predict", response_model=PredictionResponse)
def predict(input: TextInput):
    return run_prediction(input.text)