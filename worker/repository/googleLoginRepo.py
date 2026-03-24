from ..schemas.schemas import GoogleLogin
from datetime import datetime, timedelta
from jose import jwt
from ..config.database import collection, collection_worker
from fastapi import HTTPException

def GoogleLoginRepo(data: GoogleLogin):
    existing_user = collection.find_one({"email": data.email})

    # Split name into first/last upfront since schema only has 'name'
    name_parts = (data.name or "").split(" ", 1)
    data_first = name_parts[0] if len(name_parts) > 0 else ""
    data_last  = name_parts[1] if len(name_parts) > 1 else ""

    # Check if email belongs to a worker
    if not existing_user:
        existing_worker = collection_worker.find_one({"email": data.email})
        if existing_worker:
            raise HTTPException(
                status_code=400,
                detail="This email is registered as a worker account. Please log in with your password."
            )

    if existing_user:
        # Block if registered normally with password
        if existing_user.get("password") and not existing_user.get("oauth_provider"):
            raise HTTPException(
                status_code=400,
                detail="This email is already registered. Please log in with your password."
            )
        user_id    = str(existing_user["_id"])
        role       = existing_user.get("role", "customer")
        first_name = existing_user.get("first_name", data_first)  # ← fixed
        last_name  = existing_user.get("last_name",  data_last)   # ← fixed
        phone      = existing_user.get("phoneNo", None)
    else:
        new_user = {
            "email":           data.email,
            "first_name":      data_first,                         # ← fixed
            "last_name":       data_last,                          # ← fixed
            "password":        None,
            "google_id":       data.google_id,
            "profile_picture": data.picture,
            "role":            "customer",
            "phoneNo":         None,
            "oauth_provider":  "google",
            "registeredAt":    datetime.utcnow(),
        }
        result     = collection.insert_one(new_user)
        user_id    = str(result.inserted_id)
        role       = "customer"
        first_name = data_first
        last_name  = data_last
        phone      = None

    access_token = jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=7)},
        "your-secret-key",
        algorithm="HS256"
    )

    return {
        "_id":          user_id,
        "email":        data.email,
        "first_name":   first_name,
        "last_name":    last_name,
        "picture":      data.picture,
        "role":         role,
        "access_token": access_token,
        "phoneNo":      phone,
    }