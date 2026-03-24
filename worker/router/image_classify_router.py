# routers/image_router.py
from fastapi import APIRouter, File, UploadFile, HTTPException
from ..services.image_classification import classify_image

router = APIRouter(prefix="/api/image", tags=["image"])

@router.post("/predict")
async def predict_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        prediction = classify_image(file.file)
        return {"label": str(prediction)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
