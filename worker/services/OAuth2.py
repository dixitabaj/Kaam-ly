from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from .auth import verify_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")  # endpoint to fetch token

def get_current_user(token: str = Depends(oauth2_scheme)):
    print("Token received:", token)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    return verify_token(token, credentials_exception)