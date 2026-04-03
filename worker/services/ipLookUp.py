"""
jobs/ip_lookup.py  —  Background IP reputation enrichment.

Fetches proxy/VPN/hosting flags from ip-api.com (free tier: 45 req/min).
For higher volume or richer signals, swap to ipqualityscore.com or
ipinfo.io — just update _fetch_ip_meta() accordingly.

Usage
-----
Standalone (manual / cron):
    python -m jobs.ip_lookup --ip 1.2.3.4

Via queue (recommended for production):
    await enrich_ip(ip, db)   ← call this from your worker consumer

Cron sweep (re-check IPs older than 7 days):
    await enrich_all_stale(db)
"""

import asyncio
import argparse
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx

log = logging.getLogger(__name__)

# ip-api.com returns these fields; "proxy" covers VPNs, "hosting" covers
# datacenter/cloud IPs that are rarely legitimate end-users.
_IP_API_URL = "http://ip-api.com/json/{ip}?fields=status,proxy,hosting,query,isp,country"
_STALE_AFTER_DAYS = 7


# ---------------------------------------------------------------------------
# Core enrichment function
# ---------------------------------------------------------------------------

async def enrich_ip(ip: str, db) -> dict:
    """
    Fetch reputation data for `ip` and upsert into the ip_reputation collection.
    Returns the stored document.
    """
    meta = await _fetch_ip_meta(ip)

    doc = {
        "ip":         ip,
        "is_proxy":   meta.get("proxy") or meta.get("hosting", False),
        "isp":        meta.get("isp"),
        "country":    meta.get("country"),
        "raw":        meta,
        "checked_at": datetime.utcnow(),
    }

    db.ip_reputation.update_one(
        {"ip": ip},
        {"$set": doc},
        upsert=True,
    )

    log.info("Enriched IP %s — is_proxy=%s country=%s", ip, doc["is_proxy"], doc["country"])
    return doc


# ---------------------------------------------------------------------------
# Stale-record sweep (run via cron or a scheduled task)
# ---------------------------------------------------------------------------

async def enrich_all_stale(db, batch_size: int = 100) -> int:
    """
    Re-enrich any IP that hasn't been checked in the last N days.
    Returns the number of IPs updated.
    """
    cutoff = datetime.utcnow() - timedelta(days=_STALE_AFTER_DAYS)
    stale_cursor = db.ip_reputation.find(
        {"checked_at": {"$lt": cutoff}},
        {"ip": 1},
    ).limit(batch_size)

    ips = [doc["ip"] for doc in stale_cursor]
    if not ips:
        log.info("No stale IPs to enrich.")
        return 0

    # Run enrichments concurrently (respect rate limits — 45 req/min free tier)
    semaphore = asyncio.Semaphore(10)

    async def guarded(ip):
        async with semaphore:
            try:
                await enrich_ip(ip, db)
            except Exception as exc:
                log.warning("Failed to enrich %s: %s", ip, exc)

    await asyncio.gather(*[guarded(ip) for ip in ips])
    log.info("Enriched %d stale IPs.", len(ips))
    return len(ips)


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

async def _fetch_ip_meta(ip: str) -> dict:
    """Call ip-api.com and return the parsed JSON payload."""
    url = _IP_API_URL.format(ip=ip)
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    if data.get("status") != "success":
        log.warning("ip-api.com returned non-success for %s: %s", ip, data)
        return {}

    return data


# ---------------------------------------------------------------------------
# CLI entrypoint  (python -m jobs.ip_lookup --ip 1.2.3.4)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, stream=sys.stdout)

    parser = argparse.ArgumentParser(description="Enrich a single IP address.")
    parser.add_argument("--ip", required=True, help="IPv4 address to look up")
    args = parser.parse_args()

    # For CLI use, print the result without a real DB — swap in your real db client.
    async def _main():
        meta = await _fetch_ip_meta(args.ip)
        print(meta)

    asyncio.run(_main())