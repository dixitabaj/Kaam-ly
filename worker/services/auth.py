from typing import Optional
from datetime import timedelta, datetime
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Must match your existing values exactly ───────────────────────────────────
SECRET_KEY = "as"
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

security = HTTPBearer()


# ── Token creation (your existing function — unchanged) ───────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire    = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── Token verification (your existing function — unchanged) ───────────────────
def verify_token(token: str, credentials_exception):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        return {
            "email":     email,
            "user_id":   payload.get("user_id"),
            "user_type": payload.get("user_type"),  # "customer" | "worker" | "admin"
        }
    except JWTError:
        raise credentials_exception


# ── FastAPI dependency — use this on protected routes ─────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    return verify_token(credentials.credentials, credentials_exception)


# ── Role guards — use these on role-specific routes ───────────────────────────
def require_customer(user: dict = Depends(get_current_user)):
    if user.get("user_type") != "customer":
        raise HTTPException(status_code=403, detail="Customers only")
    return user

def require_worker(user: dict = Depends(get_current_user)):
    if user.get("user_type") != "worker":
        raise HTTPException(status_code=403, detail="Workers only")
    return user

def require_admin(user: dict = Depends(get_current_user)):
    if user.get("user_type") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


# ═════════════════════════════════════════════════════════════════════════════
# HOW TO USE
# ═════════════════════════════════════════════════════════════════════════════
#
# In your login endpoint — token creation stays the same as before:
#
#   token = create_access_token({
#       "sub":       user["email"],        # ← email goes in sub
#       "user_id":   str(user["_id"]),
#       "user_type": user["user_type"],    # ← "customer" | "worker" | "admin"
#   })
#
#
# Option A — protect a whole router at once (easiest):
#
#   from .auth import get_current_user
#
#   router = APIRouter(
#       prefix="/api/tasks",
#       dependencies=[Depends(get_current_user)]  # every route requires auth
#   )
#
#
# Option B — protect individual endpoints:
#
#   from .auth import require_worker
#
#   @router.patch("/tasks/{task_id}/confirm")
#   async def confirm_task(task_id: str, user = Depends(require_worker)):
#       print(user["email"])      # logged-in worker's email
#       print(user["user_id"])    # logged-in worker's id
#       ...
#
#
# ── Routes that MUST stay public (no Depends) ─────────────────────────────────
#   POST /api/login
#   POST /api/register
#   POST /api/send-otp
#   POST /api/verify-otp
#   POST /api/tasks/{id}/start-from-notification    ← called by service worker
#   POST /api/tasks/{id}/complete-from-notification ← called by service worker