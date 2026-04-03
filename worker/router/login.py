
from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from ..schemas import schemas
from ..repository import loginRepo

router = APIRouter()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@router.post("/login", tags=["login"])
async def loginuser(request: schemas.LoginSchema,  http_request: Request):
    return await loginRepo.loginUser(request, http_request)

@router.post("/reset-password")
def reset_password(request: schemas.ResetPasswordSchema):
    return loginRepo.resetPassword(request)

@router.post("/logout", tags=["login"])
def logoutuser(token: str = Depends(oauth2_scheme)):
    return loginRepo.logoutUser(token)