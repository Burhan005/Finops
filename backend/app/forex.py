"""
Live Foreign Exchange (Forex) Rate Ingestion Module
Fetches real-time USD to INR exchange rates with in-memory caching and resilient fallback.
"""

import time
import json
import urllib.request
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Fallback default rate if offline or API unreachable
FALLBACK_USD_TO_INR = 95.32
CACHE_TTL_SECONDS = 900  # 15 minutes cache

_FOREX_CACHE: Dict[str, Any] = {
    "base": "USD",
    "target": "INR",
    "currency_pair": "USD/INR",
    "rate": FALLBACK_USD_TO_INR,
    "formatted": f"₹{FALLBACK_USD_TO_INR:.2f}",
    "provider": "Offline Reference Baseline",
    "source": "offline_reference",
    "rate_status": "OFFLINE_REFERENCE",
    "last_fetched": 0,
    "last_updated_utc": "2026-10-15T00:00:00Z",
    "is_live": False,
    "freshness_seconds": 0
}


def fetch_live_usd_to_inr() -> Dict[str, Any]:
    """
    Fetches real-time USD to INR exchange rate from Open Exchange Rates API.
    Returns dictionary with rate, status, timestamp, provider, and source.
    """
    global _FOREX_CACHE
    now = time.time()

    # Return cached rate if within TTL
    if now - _FOREX_CACHE.get("last_fetched", 0) < CACHE_TTL_SECONDS and _FOREX_CACHE.get("is_live"):
        res = dict(_FOREX_CACHE)
        res["freshness_seconds"] = int(now - _FOREX_CACHE.get("last_fetched", now))
        res["rate_status"] = "CACHED"
        return res

    url = "https://open.er-api.com/v6/latest/USD"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "ZorvexFinOps/2.0 (Enterprise Cloud Intelligence)"}
        )
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                payload = json.loads(response.read().decode("utf-8"))
                rates = payload.get("rates", {})
                inr_rate = rates.get("INR")
                if inr_rate and isinstance(inr_rate, (int, float)) and inr_rate > 0:
                    val = round(float(inr_rate), 4)
                    _FOREX_CACHE = {
                        "base": "USD",
                        "target": "INR",
                        "currency_pair": "USD/INR",
                        "rate": val,
                        "formatted": f"₹{val:.2f}",
                        "provider": "Open Exchange Rates",
                        "source": "open_er_api_live",
                        "rate_status": "LIVE",
                        "last_fetched": now,
                        "last_updated_utc": payload.get("time_last_update_utc", ""),
                        "is_live": True,
                        "freshness_seconds": 0
                    }
                    logger.info("Successfully fetched live USD to INR rate: %s", inr_rate)
                    return _FOREX_CACHE
    except Exception as exc:
        logger.warning("Could not fetch live forex rate from %s: %s. Using cached rate.", url, exc)

    # If fetch failed, return existing cached rate (or fallback)
    res = dict(_FOREX_CACHE)
    if not res.get("is_live"):
        res["provider"] = "Offline Reference Baseline"
        res["source"] = "offline_reference"
        res["rate_status"] = "OFFLINE_REFERENCE"
        res["is_live"] = False
    else:
        res["rate_status"] = "STALE_CACHE"
    res["freshness_seconds"] = int(now - _FOREX_CACHE.get("last_fetched", now)) if _FOREX_CACHE.get("last_fetched") else 0
    return res


def get_live_usd_to_inr_rate() -> float:
    """Convenience accessor for the numeric live USD to INR rate."""
    data = fetch_live_usd_to_inr()
    return float(data.get("rate", FALLBACK_USD_TO_INR))
