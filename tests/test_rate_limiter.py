import asyncio
import types
import pytest
from types import SimpleNamespace

from fastapi import HTTPException

from worker.utils import rate_limiter


class DummyRequest:
    def __init__(self, ip="1.2.3.4", headers=None, user_id=None):
        self.headers = headers or {}
        self.state = SimpleNamespace()
        if user_id is not None:
            self.state.user_id = user_id
        self.client = SimpleNamespace(host=ip)


@pytest.mark.asyncio
async def test_below_limit(monkeypatch):
    req = DummyRequest()
    limiter = rate_limiter._get_limiter()

    async def fake_incr(key, window):
        return 1, window - 1

    monkeypatch.setattr(limiter, "_incr", fake_incr)

    # Should not raise
    await limiter.enforce("login", req)


@pytest.mark.asyncio
async def test_exceed_limit_raises_429(monkeypatch):
    req = DummyRequest()
    limiter = rate_limiter._get_limiter()

    async def fake_incr(key, window):
        return 6, 42

    monkeypatch.setattr(limiter, "_incr", fake_incr)

    with pytest.raises(HTTPException) as ei:
        await limiter.enforce("login", req)
    assert ei.value.status_code == 429
    assert ei.value.headers.get("Retry-After") == "42"


@pytest.mark.asyncio
async def test_ip_based_isolation(monkeypatch):
    limiter = rate_limiter._get_limiter()

    calls = {}

    async def fake_incr(key, window):
        # key will contain the IP or user id
        calls.setdefault(key, 0)
        calls[key] += 1
        return calls[key], window

    monkeypatch.setattr(limiter, "_incr", fake_incr)

    req1 = DummyRequest(ip="1.1.1.1")
    req2 = DummyRequest(ip="2.2.2.2")

    # first request from each IP should be allowed
    await limiter.enforce("general", req1)
    await limiter.enforce("general", req2)

    # ensure the keys are distinct
    assert any("ip:1.1.1.1" in k for k in calls.keys())
    assert any("ip:2.2.2.2" in k for k in calls.keys())


@pytest.mark.asyncio
async def test_user_based_isolation(monkeypatch):
    limiter = rate_limiter._get_limiter()

    calls = {}

    async def fake_incr(key, window):
        calls.setdefault(key, 0)
        calls[key] += 1
        return calls[key], window

    monkeypatch.setattr(limiter, "_incr", fake_incr)

    req1 = DummyRequest(user_id="alice")
    req2 = DummyRequest(user_id="bob")

    await limiter.enforce("general", req1)
    await limiter.enforce("general", req2)

    assert any("user:alice" in k for k in calls.keys())
    assert any("user:bob" in k for k in calls.keys())


@pytest.mark.asyncio
async def test_retry_after_header_provided(monkeypatch):
    limiter = rate_limiter._get_limiter()

    async def fake_incr(key, window):
        return 11, 13

    monkeypatch.setattr(limiter, "_incr", fake_incr)

    req = DummyRequest()
    with pytest.raises(HTTPException) as ei:
        await limiter.enforce("payment", req)
    assert ei.value.status_code == 429
    assert ei.value.headers.get("Retry-After") == "13"
