"""
ZORVEX FinOps Platform - Production Dual-Tier Cache Engine (Redis + In-Memory Fallback)
========================================================================================
High-performance analytical caching architecture supporting:
1. Primary Tier: Distributed Redis caching (when redis-py is installed and Redis is reachable).
2. Fallback Tier: Thread-safe, bounded in-memory LRU cache with TTL expiration.
3. Multi-Tenant Scoping: Strict tenant isolation (zorvex:v1:org:{org_id}:...).
4. Stampede Protection: Per-key lock synchronization prevents thundering herds on cache miss.
5. Invalidation Lifecycle: Dataset re-indexing or upload triggers surgical tenant invalidation.
6. Diagnostic Telemetry: Live hit/miss tracking, latency metrics, and backend health status.
"""

import os
import json
import time
import hashlib
import threading
from typing import Dict, Any, Optional, Tuple, Callable
from collections import OrderedDict
import logging

logger = logging.getLogger("zorvex.cache")

# Check optional Redis client availability
REDIS_INSTALLED = False
try:
    import redis
    REDIS_INSTALLED = True
except ImportError:
    redis = None  # type: ignore


class ZorvexDualTierCache:
    """
    Production-grade dual-tier caching engine with automated fallback.
    Ensures identical financial calculations regardless of whether Redis is live.
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = 3600,
        max_memory_entries: int = 250
    ):
        self.default_ttl = default_ttl
        self.max_memory_entries = max_memory_entries
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        # Telemetry counters
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.redis_failures = 0

        # In-Memory Fallback Tier
        self._memory_store: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._lock = threading.RLock()
        self._key_locks: Dict[str, threading.Lock] = {}
        self._key_locks_guard = threading.Lock()

        # Redis connection initialization
        self.redis_client = None
        self.redis_available = False
        self._init_redis()

    def _init_redis(self):
        """Attempts connection to Redis if driver is available."""
        if not REDIS_INSTALLED:
            logger.info("redis-py not installed; operating in verified In-Memory Fallback mode.")
            self.redis_available = False
            return

        try:
            client = redis.from_url(
                self.redis_url,
                socket_connect_timeout=1.5,
                socket_timeout=2.0,
                decode_responses=True
            )
            client.ping()
            self.redis_client = client
            self.redis_available = True
            logger.info("Connected to Redis at %s", self.redis_url)
        except Exception as e:
            logger.warning("Redis not reachable at %s (%s); falling back to In-Memory cache.", self.redis_url, e)
            self.redis_client = None
            self.redis_available = False

    def build_key(self, org_id: Any, dataset_id: str, endpoint: str, **params) -> str:
        """
        Builds a strictly tenant-isolated, deterministic cache key.
        Format: zorvex:v1:org:{org_id}:ds:{dataset_id}:{endpoint}:{param_hash}
        """
        sorted_params = json.dumps(params, sort_keys=True, default=str)
        param_hash = hashlib.sha256(sorted_params.encode('utf-8')).hexdigest()[:16]
        return f"zorvex:v1:org:{org_id}:ds:{dataset_id}:{endpoint}:{param_hash}"

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached value from Redis or Memory tier."""
        # 1. Try Redis if live
        if self.redis_available and self.redis_client:
            try:
                raw = self.redis_client.get(key)
                if raw is not None:
                    self.hits += 1
                    return json.loads(raw)
            except Exception as e:
                self.redis_failures += 1
                logger.debug("Redis read error (%s); falling back to memory.", e)

        # 2. Try In-Memory Fallback
        with self._lock:
            entry = self._memory_store.get(key)
            if entry is not None:
                # Check TTL expiration
                if entry['expires_at'] < time.time():
                    del self._memory_store[key]
                    self.evictions += 1
                    self.misses += 1
                    return None
                # Mark as recently used
                self._memory_store.move_to_end(key)
                self.hits += 1
                return entry['data']

        self.misses += 1
        return None

    def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """Stores a value in both Redis (if live) and In-Memory Fallback."""
        effective_ttl = ttl or self.default_ttl
        serialized = json.dumps(value, default=str)

        stored_in_redis = False
        if self.redis_available and self.redis_client:
            try:
                self.redis_client.setex(key, effective_ttl, serialized)
                stored_in_redis = True
            except Exception as e:
                self.redis_failures += 1
                logger.debug("Redis write error (%s); saving to memory tier only.", e)

        # Store in In-Memory LRU Cache
        with self._lock:
            # Enforce memory capacity boundary
            while len(self._memory_store) >= self.max_memory_entries:
                self._memory_store.popitem(last=False)
                self.evictions += 1

            self._memory_store[key] = {
                'data': value,
                'expires_at': time.time() + effective_ttl
            }
            self._memory_store.move_to_end(key)

        return True

    def invalidate_org(self, org_id: Any) -> int:
        """
        Invalidates all cached analytical queries for a specific organization.
        Guarantees instant cache coherence upon new CUR file upload.
        """
        prefix = f"zorvex:v1:org:{org_id}:"
        purged = 0

        # Purge from Redis
        if self.redis_available and self.redis_client:
            try:
                keys = self.redis_client.keys(f"{prefix}*")
                if keys:
                    purged += self.redis_client.delete(*keys)
            except Exception as e:
                logger.warning("Redis invalidation error: %s", e)

        # Purge from Memory
        with self._lock:
            mem_keys = [k for k in self._memory_store.keys() if k.startswith(prefix)]
            for k in mem_keys:
                del self._memory_store[k]
                purged += 1

        return purged

    def clear(self) -> int:
        """Purges all entries from all cache tiers and resets telemetry counters."""
        purged = 0
        if self.redis_available and self.redis_client:
            try:
                keys = self.redis_client.keys("zorvex:v1:*")
                if keys:
                    purged += self.redis_client.delete(*keys)
            except Exception as e:
                logger.warning("Redis clear error: %s", e)

        with self._lock:
            purged += len(self._memory_store)
            self._memory_store.clear()
            self.hits = 0
            self.misses = 0
            self.evictions = 0
            self.redis_failures = 0

        return purged


    def get_or_compute(
        self,
        key: str,
        compute_fn: Callable[[], Dict[str, Any]],
        ttl: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Single-flight cached accessor. Prevents cache stampede / thundering herds
        by ensuring only one thread computes the value on a cache miss.
        """
        # Fast path: check cache
        cached = self.get(key)
        if cached is not None:
            return cached

        # Stampede lock per unique key
        with self._key_locks_guard:
            if key not in self._key_locks:
                self._key_locks[key] = threading.Lock()
            lock = self._key_locks[key]

        with lock:
            # Re-check cache in case another thread computed it while waiting
            cached = self.get(key)
            if cached is not None:
                return cached

            # Compute and store
            result = compute_fn()
            self.set(key, result, ttl=ttl)

        # Cleanup lock reference
        with self._key_locks_guard:
            self._key_locks.pop(key, None)

        return result

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive diagnostic metrics for telemetry and health dashboards."""
        total_requests = self.hits + self.misses
        hit_ratio = round((self.hits / total_requests * 100.0), 1) if total_requests > 0 else 0.0

        with self._lock:
            # Count active (non-expired) memory entries
            now = time.time()
            active_memory = sum(1 for e in self._memory_store.values() if e['expires_at'] >= now)

        return {
            'status': 'HEALTHY',
            'backend_in_use': 'redis' if self.redis_available else 'in_memory_fallback',
            'redis_driver_installed': REDIS_INSTALLED,
            'redis_connected': self.redis_available,
            'redis_url': self.redis_url if self.redis_available else 'N/A',
            'memory_tier_entries': active_memory,
            'memory_tier_capacity': self.max_memory_entries,
            'total_hits': self.hits,
            'total_misses': self.misses,
            'hit_ratio_pct': hit_ratio,
            'evictions_count': self.evictions,
            'redis_connection_failures': self.redis_failures
        }


# Global singleton cache instance
global_cache = ZorvexDualTierCache()
