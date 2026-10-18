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
        max_memory_entries: int = 250,
        max_memory_bytes: int = 50 * 1024 * 1024
    ):
        self.default_ttl = default_ttl
        self.max_memory_entries = max_memory_entries
        self.max_memory_bytes = max_memory_bytes
        self.redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
        
        # Telemetry counters
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.redis_failures = 0

        # In-Memory Fallback Tier (bounded by count AND bytes)
        self._memory_store: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self._current_memory_bytes = 0
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
                decode_responses=True,
                protocol=2
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
                    self._current_memory_bytes -= entry.get('bytes', 0)
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
        entry_bytes = len(serialized.encode('utf-8'))

        # Sensible safety limit: 5MB per cached entry
        if entry_bytes > 5 * 1024 * 1024:
            logger.warning("Cache object for key %s exceeds 5MB size limit; skipping cache storage.", key)
            return False

        stored_in_redis = False
        if self.redis_available and self.redis_client:
            try:
                self.redis_client.set(key, serialized, ex=effective_ttl)
                stored_in_redis = True
            except Exception as e:
                self.redis_failures += 1
                logger.debug("Redis write error (%s); saving to memory tier only.", e)

        # Store in In-Memory LRU Cache with dual bound (entry count and byte budget)
        with self._lock:
            if key in self._memory_store:
                old_entry = self._memory_store.pop(key)
                self._current_memory_bytes -= old_entry.get('bytes', 0)

            while self._memory_store and (
                len(self._memory_store) >= self.max_memory_entries or
                (self._current_memory_bytes + entry_bytes > self.max_memory_bytes)
            ):
                _, popped_entry = self._memory_store.popitem(last=False)
                self._current_memory_bytes -= popped_entry.get('bytes', 0)
                self.evictions += 1

            self._memory_store[key] = {
                'data': value,
                'expires_at': time.time() + effective_ttl,
                'bytes': entry_bytes
            }
            self._current_memory_bytes += entry_bytes
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
                popped = self._memory_store.pop(k, None)
                if popped:
                    self._current_memory_bytes -= popped.get('bytes', 0)
                purged += 1

        return purged

    def invalidate_endpoint(self, org_id: Any, endpoint: str) -> int:
        """
        Surgically invalidates cached queries for a specific endpoint within an organization.
        E.g. Invalidate 'budgets' when a budget is created/deleted without clearing overview or trends.
        """
        pattern = f"zorvex:v1:org:{org_id}:*:{endpoint}:*"
        purged = 0

        # Purge from Redis
        if self.redis_available and self.redis_client:
            try:
                keys = self.redis_client.keys(pattern)
                if keys:
                    purged += self.redis_client.delete(*keys)
            except Exception as e:
                logger.warning("Redis endpoint invalidation error for %s: %s", pattern, e)

        # Purge from Memory
        prefix_org = f"zorvex:v1:org:{org_id}:"
        ep_tag = f":{endpoint}:"
        with self._lock:
            mem_keys = [k for k in self._memory_store.keys() if k.startswith(prefix_org) and ep_tag in k]
            for k in mem_keys:
                popped = self._memory_store.pop(k, None)
                if popped:
                    self._current_memory_bytes -= popped.get('bytes', 0)
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
            self._current_memory_bytes = 0
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
            'memory_tier_bytes': self._current_memory_bytes,
            'memory_tier_max_bytes': self.max_memory_bytes,
            'total_hits': self.hits,
            'total_misses': self.misses,
            'hit_ratio_pct': hit_ratio,
            'evictions_count': self.evictions,
            'redis_connection_failures': self.redis_failures
        }


# Global singleton cache instance
global_cache = ZorvexDualTierCache()


def get_dataset_cache_key(dataset: Optional[Dict[str, Any]] = None, repo: Optional[Any] = None) -> str:
    """
    Constructs a generation-aware versioned dataset cache namespace identifier.
    Format: {name_or_id}_v{revision}
    Guarantees that re-uploaded, superseded, or versioned datasets cannot collide with previous analytical results.
    """
    rev = 1
    ds_base = "default"
    if repo and getattr(repo, 'd_rec', None):
        rev = getattr(repo.d_rec, 'revision_version', 1) or 1
        ds_base = repo.d_rec.filename or f"active_{repo.dataset_id or 'default'}"
    elif dataset:
        rev = dataset.get('revision_version') or 1
        ds_base = dataset.get('filename') or (os.path.basename(dataset.get('filepath', '')) if dataset.get('filepath') else None) or f"active_{dataset.get('id', 'default')}"
    elif repo and getattr(repo, 'dataset_id', None):
        ds_base = f"active_{repo.dataset_id}"
    return f"{ds_base}_v{rev}"
