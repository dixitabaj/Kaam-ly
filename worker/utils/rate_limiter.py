"""Async Redis-backed rate limiter utility for FastAPI.

Usage (decorator):
    from worker.utils.rate_limiter import rate_limit

    @router.post("/login")
    @rate_limit("login")
    async def login(...):
        ...

Usage (dependency):
    from fastapi import Depends
    from worker.utils.rate_limiter import rate_limit_dep

    @router.post("/some")
    async def view(dep=Depends(rate_limit_dep("general"))):
        ...

Design notes:
- Redis configuration is read from environment variables: `REDIS_URL` or
    `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_PASSWORD`.
- Per-policy limits are configurable via environment variables:
    `RATE_LIMIT_{POLICY}_LIMIT`, `RATE_LIMIT_{POLICY}_WINDOW` (seconds),
    and `RATE_LIMIT_{POLICY}_FAIL_OPEN` (true/false).
- Default policies provided for `general`, `login`, `registration`,
    `password_reset`, and `payment`.
- The dependency `rate_limit_dep` is the primary recommended integration
    (use `Depends(rate_limit_dep("policy"))`). A decorator wrapper is also
    provided but does not bypass FastAPI dependency injection.

Fail-open vs fail-closed strategy:
- For `payment` and authentication-related endpoints (login, registration,
    password_reset), the implementation defaults to *fail-closed*: if
    Redis is unavailable the dependency returns HTTP 503 to avoid allowing
    unbounded auth/payment attempts during an outage. This is a security-first
    posture. For general API endpoints the default is *fail-open* (allow)
    to preserve availability.

IP extraction and trusted proxies:
- To avoid trusting client-supplied headers, this limiter only uses the
    `X-Forwarded-For` header when the deployment sets `TRUSTED_PROXY_COUNT`
    (an integer) to indicate how many reverse proxies are in front of the app.
    If `TRUSTED_PROXY_COUNT` is 0 or unset, the limiter uses `request.client.host`.
    Deployments behind proxies should configure Starlette/ProxyHeadersMiddleware
    and set `TRUSTED_PROXY_COUNT` accordingly.

Fixed-window rate limiting:
- This implementation uses a fixed-window algorithm (counter + TTL).

The implementation avoids logging or exposing secrets.
"""

from __future__ import annotations

import os
import functools
import logging
from dataclasses import dataclass
from typing import Optional, Tuple

from fastapi import Request, HTTPException, Depends
from starlette.status import HTTP_429_TOO_MANY_REQUESTS, HTTP_503_SERVICE_UNAVAILABLE

try:
    import redis.asyncio as redis_async
except Exception:
    redis_async = None

logger = logging.getLogger("worker.utils.rate_limiter")


class RedisUnavailable(Exception):
    """Raised when Redis operations fail or Redis client is not available."""


@dataclass
class Policy:
    limit: int
    window: int  # seconds
    fail_open: bool


# Default policies (can be overridden via env vars)
DEFAULT_POLICIES = {
    "general": Policy(limit=100, window=60, fail_open=True),
    "login": Policy(limit=5, window=60, fail_open=False),
    "registration": Policy(limit=3, window=600, fail_open=False),
    "password_reset": Policy(limit=3, window=900, fail_open=False),
    "payment": Policy(limit=10, window=60, fail_open=False),
}


def _env_policy(policy_name: str) -> Optional[Policy]:
    """Read per-policy configuration from environment variables.

    Expected env vars (example for policy `login`):
      RATE_LIMIT_LOGIN_LIMIT=5
      RATE_LIMIT_LOGIN_WINDOW=60
      RATE_LIMIT_LOGIN_FAIL_OPEN=false
    """
    key = policy_name.upper()
    limit = os.getenv(f"RATE_LIMIT_{key}_LIMIT")
    window = os.getenv(f"RATE_LIMIT_{key}_WINDOW")
    fail_open = os.getenv(f"RATE_LIMIT_{key}_FAIL_OPEN")
    if limit is None and window is None and fail_open is None:
        return None
    try:
        limit_val = int(limit) if limit is not None else DEFAULT_POLICIES.get(policy_name, Policy(100, 60, True)).limit
        window_val = int(window) if window is not None else DEFAULT_POLICIES.get(policy_name, Policy(100, 60, True)).window
        fail_open_val = (
            str(fail_open).lower() in ("1", "true", "yes") if fail_open is not None else DEFAULT_POLICIES.get(policy_name, Policy(100, 60, True)).fail_open
        )
    except Exception:
        return None
    return Policy(limit=limit_val, window=window_val, fail_open=fail_open_val)


class RateLimiter:
    """Async Redis-backed rate limiter.

    - Uses simple INCR + EXPIRE semantics to count requests in a rolling
      fixed window (per Redis key TTL).
    - Provides `enforce(policy_name, request)` to be called from a
      FastAPI dependency.
    """

    # Lua script for atomic increment + set expire when first created.
    _INCR_LUA = (
        "local v = redis.call('INCR', KEYS[1])\n"
        "if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end\n"
        "local ttl = redis.call('TTL', KEYS[1])\n"
        "return {v, ttl}"
    )

    def __init__(self) -> None:
        # redis client or None
        self._redis = None
        # sha of the loaded script, or None
        self._script_sha = None
        # lock for initialization attempts
        self._init_lock = None

    async def _ensure_redis(self):
        """Lazy init Redis client. Safe to call multiple times.

        If Redis cannot be contacted the limiter will mark itself as
        disabled and raise `RedisUnavailable` for callers that require
        strict behavior.
        """
        # Always attempt initialization if no healthy client exists.
        # This allows recovery after transient Redis outages.
        # simple guard to avoid races during startup
        if self._init_lock is None:
            import asyncio

            self._init_lock = asyncio.Lock()

        async with self._init_lock:
            # if we already have a client try a ping to validate health
            if self._redis is not None:
                try:
                    await self._redis.ping()
                    return
                except Exception:
                    # drop unhealthy client and continue to re-init
                    try:
                        await self._redis.close()
                    except Exception:
                        pass
                    self._redis = None
                    self._script_sha = None

            if redis_async is None:
                logger.warning("redis.asyncio not available; rate limiter disabled")
                return

            redis_url = os.getenv("REDIS_URL")
            try:
                if redis_url:
                    client = redis_async.from_url(redis_url, decode_responses=True)
                else:
                    host = os.getenv("REDIS_HOST", "localhost")
                    port = int(os.getenv("REDIS_PORT", "6379"))
                    db = int(os.getenv("REDIS_DB", "0"))
                    password = os.getenv("REDIS_PASSWORD")
                    client = redis_async.Redis(host=host, port=port, db=db, password=password, decode_responses=True)

                # quick health check
                await client.ping()

                # load script and keep sha for efficient evalsha
                try:
                    sha = await client.script_load(self._INCR_LUA)
                except Exception:
                    sha = None

                self._redis = client
                self._script_sha = sha
                return
            except Exception as exc:  # pragma: no cover - infra dependent
                # Do not expose secrets in logs; log only that Redis is unreachable.
                logger.warning("Unable to connect to Redis for rate limiting")
                self._redis = None
                self._script_sha = None
                return

    async def _incr(self, key: str, window: int) -> Tuple[int, int]:
        """Atomically increment `key` and set TTL on first increment.

        Returns (count, ttl_seconds).
        Raises RedisUnavailable if Redis is down.
        """
        # Ensure a healthy redis client exists (attempt reconnect if needed)
        await self._ensure_redis()
        if self._redis is None:
            raise RedisUnavailable("Redis not available")

        try:
            # Use the atomic Lua script via EVALSHA if possible
            # Keys: [key], ARGV: [window]
            if self._script_sha:
                res = await self._redis.evalsha(self._script_sha, 1, key, window)
            else:
                res = await self._redis.eval(self._INCR_LUA, 1, key, window)

            # Expecting a two-element array: [count, ttl]
            if not res or len(res) < 2:
                raise RedisUnavailable("Unexpected Redis script response")
            val = int(res[0])
            ttl = int(res[1]) if res[1] is not None and int(res[1]) >= 0 else window
            return val, ttl
        except Exception:
            # Drop client so future calls will retry initialization
            try:
                if self._redis is not None:
                    await self._redis.close()
            except Exception:
                pass
            self._redis = None
            self._script_sha = None
            raise RedisUnavailable()

    async def enforce(self, policy_name: str, request: Request) -> None:
        """Enforce rate limit for `policy_name` on the given `request`.

        Determines an identifier: user-id (if present) else client IP.
        Raises HTTPException(429) when limit exceeded, or HTTPException(503)
        if Redis is unavailable and policy is configured to fail-closed.
        """
        # Resolve policy (env override or default)
        policy = _env_policy(policy_name) or DEFAULT_POLICIES.get(policy_name)
        if policy is None:
            # Unknown policy, fallback to a safe default
            policy = DEFAULT_POLICIES["general"]

        # Determine identifier: prefer request.state.user_id when populated by
        # trusted authentication middleware. Do NOT trust any client-supplied
        # user id header.
        user_id = getattr(getattr(request, "state", None), "user_id", None)

        if user_id:
            key = f"rl:{policy_name}:user:{user_id}"
        else:
            # derive client IP in a proxy-safe way. Only use X-Forwarded-For
            # when deployment config indicates how many proxies are trusted
            # (TRUSTED_PROXY_COUNT). If not set or zero, use request.client.host
            trusted_count = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))
            ip = None
            xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
            if xff and trusted_count > 0:
                # XFF is a comma-separated list: client, proxy1, proxy2
                parts = [p.strip() for p in xff.split(",") if p.strip()]
                # index from right: the client is at -(trusted_count+1)
                idx = - (trusted_count + 1)
                try:
                    ip = parts[idx]
                except Exception:
                    ip = None

            if not ip:
                client = getattr(request, "client", None)
                ip = client.host if client is not None else "unknown"

            key = f"rl:{policy_name}:ip:{ip}"

        try:
            count, ttl = await self._incr(key, policy.window)
        except RedisUnavailable:
            # Redis outage handling: fail-open or fail-closed depending on policy
            if policy.fail_open:
                # allow requests for availability
                logger.debug("Redis unavailable; allowing request due to fail-open policy: %s", policy_name)
                return
            # fail-closed: deny safely with 503
            logger.warning("Redis unavailable; failing closed for policy: %s", policy_name)
            raise HTTPException(status_code=HTTP_503_SERVICE_UNAVAILABLE, detail="Rate limiter temporarily unavailable")

        if count > policy.limit:
            # Exceeded limit
            retry_after = ttl if ttl and ttl > 0 else policy.window
            headers = {"Retry-After": str(retry_after)}
            raise HTTPException(status_code=HTTP_429_TOO_MANY_REQUESTS, detail="Too Many Requests", headers=headers)


# Singleton instance that will be shared across imports
_GLOBAL_LIMITER: Optional[RateLimiter] = None


def _get_limiter() -> RateLimiter:
    global _GLOBAL_LIMITER
    if _GLOBAL_LIMITER is None:
        _GLOBAL_LIMITER = RateLimiter()
    return _GLOBAL_LIMITER


def rate_limit_dep(policy_name: str):
    """Return a FastAPI dependency function enforcing `policy_name`.

    Example: `Depends(rate_limit_dep("general"))`.
    """

    async def _dep(request: Request):
        limiter = _get_limiter()
        await limiter.enforce(policy_name, request)

    return _dep


def rate_limit(policy_name: str):
    """Decorator factory to apply rate limiting to FastAPI endpoints.

    This decorator works by inserting a hidden dependency that runs the
    rate limiter before the wrapped endpoint. It preserves the wrapped
    function's signature and is FastAPI-compatible.

    Example:
        @router.post("/login")
        @rate_limit("login")
        async def login(...):
            ...
    """

    dep = rate_limit_dep(policy_name)

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, _rl_dependency=Depends(dep), **kwargs):
            # Note: _rl_dependency is intentionally unused; FastAPI will
            # execute the dependency before calling this wrapper.
            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Expose basic helper for tests
__all__ = ["rate_limit", "rate_limit_dep", "RateLimiter", "RedisUnavailable", "Policy"]
