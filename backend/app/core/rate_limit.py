"""
Sliding-window rate limiter.
Thread-safe request rate tracking with automated eviction of stale IP records.
"""

import time
import threading
from typing import Dict, List, Optional
from collections import defaultdict
from fastapi import Request, HTTPException, status

_LOCK = threading.Lock()
_IP_TIMESTAMPS: Dict[str, List[float]] = defaultdict(list)
_LAST_PRUNE_TIME = time.time()
_PRUNE_INTERVAL = 300  # Prune dead IP keys every 5 minutes


def _extract_client_ip(request: Request) -> str:
    """
    Extracts canonical client IP from headers, accounting for trusted reverse proxies.
    Falls back safely to request.client.host or localhost.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First entry in X-Forwarded-For is client origin
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip
    
    real_ip = request.headers.get("X-Real-IP")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def enforce_rate_limit(
    request: Request,
    action: str,
    max_requests: int = 30,
    window_seconds: int = 60
) -> None:
    """
    Enforces a thread-safe sliding window rate limit for a specific action per client IP.
    Raises HTTP 429 with Retry-After header if the request threshold is exceeded.
    """
    global _LAST_PRUNE_TIME
    client_ip = _extract_client_ip(request)
    key = f"{action}:{client_ip}"
    now = time.time()

    with _LOCK:
        # Periodic dead-key garbage collection
        if now - _LAST_PRUNE_TIME > _PRUNE_INTERVAL:
            dead_keys = [
                k for k, timestamps in _IP_TIMESTAMPS.items()
                if not timestamps or (now - timestamps[-1] > 600)
            ]
            for dk in dead_keys:
                _IP_TIMESTAMPS.pop(dk, None)
            _LAST_PRUNE_TIME = now

        # Filter valid timestamps within the current sliding window
        valid_timestamps = [t for t in _IP_TIMESTAMPS[key] if now - t < window_seconds]

        if len(valid_timestamps) >= max_requests:
            oldest_valid = valid_timestamps[0]
            retry_after = max(1, int(window_seconds - (now - oldest_valid)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for action '{action}'. Too many requests. Please retry in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)}
            )

        valid_timestamps.append(now)
        _IP_TIMESTAMPS[key] = valid_timestamps
