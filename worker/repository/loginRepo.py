from datetime import timedelta
from logging import config
from fastapi import HTTPException, Depends, Request
from fastapi.security import OAuth2PasswordBearer
from ..schemas import schemas
from ..services import auth
from ..services.hashing import Hash
from ..config.database import collection, collection_worker, db
"""
routes/auth.py  —  Example login/signup routes showing IP capture wiring.

Drop `store_user_ip()` and the background `enrich_ip()` call into your
existing auth routes — the rest of your logic stays unchanged.
"""

from fastapi import APIRouter, Request, HTTPException
from datetime import datetime

from ..services.ipCapture import store_user_ip
from ..services.ipLookUp import enrich_ip
import asyncio

router = APIRouter()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Token expiry durations
DEFAULT_EXPIRY     = timedelta(hours=12)   # normal login
REMEMBER_ME_EXPIRY = timedelta(days=30)    # remember me


async def loginUser(request: schemas.LoginSchema, http_request: Request):
    # ── Find user: customers first, then workers ──────────────────────────────
    user      = collection.find_one({"email": request.email})
    user_type = "customer"

    if not user:
        user      = collection_worker.find_one({"email": request.email})
        user_type = "worker"

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # ── Verify password ───────────────────────────────────────────────────────
    if not Hash.verify(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect password")

    # ── Pick expiry based on remember_me flag ─────────────────────────────────
    expiry = REMEMBER_ME_EXPIRY if request.remember_me else DEFAULT_EXPIRY

    # ── Create JWT ────────────────────────────────────────────────────────────
    token = auth.create_access_token(
        data={
            "sub":       user["email"],
            "user_id":   str(user["_id"]),
            "user_type": user_type,
        },
        expires_delta=expiry,
    )
    
    first_name = user.get("first_name") or user.get("firstName") or ""
    last_name  = user.get("last_name")  or user.get("lastName")  or ""

    ip = store_user_ip(db, user["_id"], http_request)
    asyncio.create_task(enrich_ip(ip, db))

    return {
        "message": "Login successful",
        "_id": str(user["_id"]),
        "access_token": token,
        "token_type": "bearer",
        "role": user.get("role", user_type),
        "expires_in": int(expiry.total_seconds()),

        # ✅ ALWAYS return consistent format
        "first_name": first_name,
        "last_name": last_name,
        "email": user.get("email", ""),
        "phoneNo": user.get("phoneNo", None),
    }

def resetPassword(request: schemas.ResetPasswordSchema):
    hashed = Hash.bcrypt(request.new_password)

    result = collection.update_one(
        {"email": request.email},
        {"$set": {"password": hashed}}
    )

    if result.matched_count == 0:
        result = collection_worker.update_one(
            {"email": request.email},
            {"$set": {"password": hashed}}
        )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "Password reset successful"}

def logoutUser(token: str = Depends(oauth2_scheme)):
    """
    Stateless JWT logout — the token is added to an in-memory denylist.
    On the frontend, also delete the token from localStorage / cookies.

    For production, swap `_denylist` for a Redis SET with TTL matching
    the token's own expiry so memory doesn't grow forever.
    """
    try:
        payload = auth.verify_access_token(token)
    except Exception:
        # Token already invalid or expired — treat as logged out
        return {"message": "Logged out"}

    _denylist.add(token)
    return {"message": "Logged out successfully"}


def is_token_revoked(token: str) -> bool:
    """Called inside verify_access_token / get_current_user to block denylisted tokens."""
    return token in _denylist


# ── In-memory denylist (replace with Redis in production) ────────────────────
_denylist: set[str] = set()