from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordBearer
from ..schemas import schemas
from ..repository import loginRepo

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@router.post("/login", tags=["login"])
def loginuser(request: schemas.LoginSchema):
    return loginRepo.loginUser(request)

@router.post("/reset-password")
def reset_password(request: schemas.ResetPasswordSchema):
    return loginRepo.resetPassword(request)

@router.post("/logout", tags=["login"])
def logoutuser(token: str = Depends(oauth2_scheme)):
    return loginRepo.logoutUser(token)