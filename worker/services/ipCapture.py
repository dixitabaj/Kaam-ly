from fastapi import Request
from datetime import datetime


async def capture_ip_middleware(request: Request, call_next):
    """
    Middleware that passively captures IPs on every request.
    Actual storage is handled at the route level (login/signup)
    since we need the authenticated user_id.
    """
    response = await call_next(request)
    return response


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP, respecting X-Forwarded-For
    for deployments behind a reverse proxy / load balancer.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can be a comma-separated list; first entry is the client
        return forwarded_for.split(",")[0].strip()
    return request.client.host


def store_user_ip(db, user_id: str, request: Request) -> str:
    """
    Persist the current request IP for a given user.
    Call this inside your login / signup route after authenticating.

    Returns the captured IP string.
    """
    ip = get_client_ip(request)

    db.user_ips.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"ips": ip},        # set of unique IPs ever seen
            "$push": {
                "ip_log": {                  # full timestamped history
                    "ip": ip,
                    "at": datetime.utcnow(),
                    "ua": request.headers.get("User-Agent"),
                }
            },
            "$set": {
                "last_ip": ip,
                "last_seen": datetime.utcnow(),
            },
        },
        upsert=True,
    )

    return ip