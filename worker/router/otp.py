from fastapi import APIRouter, HTTPException
from ..schemas import schemas
from ..services import otp as otp_service  # rename module to avoid conflict
import time

router = APIRouter()

@router.post("/send-otp")
async def send_otp(request: schemas.EmailRequest):
    try:
        generated_otp = otp_service.generate_otp(request.email)  # OTP string
        otp_service.send_otp_email(request.email, generated_otp)
        print("OTP for testing:", generated_otp)  # remove in production
        return {"msg": "OTP sent successfully"}
    except Exception as e:
        print("Error sending OTP:", e)
        raise HTTPException(status_code=500, detail="Failed to send OTP")

@router.post("/verify-otp")
async def verify_otp(request: schemas.OTPRequest):
    record = otp_service.otp_store.get(request.email)
    if not record:
        raise HTTPException(status_code=400, detail="No OTP sent to this email")

    if time.time() > record["expires"]:
        otp_service.otp_store.pop(request.email, None)
        raise HTTPException(status_code=400, detail="OTP expired")

    if request.otp != record["otp"]:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # OTP verified, remove it
    otp_service.otp_store.pop(request.email)
    return {"msg": "OTP verified successfully"}