"""
ZORVEX Multi-Tenant In-Memory State & Cache Management
========================================================================================
Thread-safe LRU caching for parsed CUR datasets, per-organization dataset copies,
and per-tenant lock synchronization.
"""

import os
import glob
import logging
import threading
import asyncio
from typing import Dict, Any, Optional
from collections import OrderedDict

from .config import (
    SAMPLES_DIR,
    UPLOADS_DIR,
    MAX_PARSED_CACHE_ENTRIES,
    MAX_ORG_DATASETS_ENTRIES
)
from ..parser import parse_cur_file
from ..recommendations import generate_recommendations

logger = logging.getLogger("zorvex.state")

CURRENT_DATASET: Dict[str, Any] = {
    'filename': '',
    'filepath': '',
    'data': None
}

PARSED_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
ORG_DATASETS: OrderedDict[int, Dict[str, Any]] = OrderedDict()

_CACHE_LOCK = threading.Lock()
_ORG_DATASETS_LOCK = threading.Lock()
DATASET_LOCK = threading.Lock()
_UPLOAD_SEMAPHORE: Optional[asyncio.Semaphore] = None

_ORG_LOCKS: Dict[int, threading.Lock] = {}
_LOCKS_MUTEX = threading.Lock()

def get_org_lock(org_id: int) -> threading.Lock:
    """
    Returns a persistent per-organization mutex for the current process.
    Never clears active locks to guarantee mutual exclusion integrity.
    """
    with _LOCKS_MUTEX:
        if org_id not in _ORG_LOCKS:
            _ORG_LOCKS[org_id] = threading.Lock()
        return _ORG_LOCKS[org_id]

def cache_get_parsed(key: str) -> Optional[Dict[str, Any]]:
    """Retrieves an entry from PARSED_CACHE and refreshes LRU recency."""
    with _CACHE_LOCK:
        if key in PARSED_CACHE:
            PARSED_CACHE.move_to_end(key)
            return PARSED_CACHE[key]
        return None

def cache_put_parsed(key: str, data: Dict[str, Any]):
    """Inserts or updates an entry in PARSED_CACHE with genuine LRU eviction."""
    with _CACHE_LOCK:
        if key in PARSED_CACHE:
            PARSED_CACHE.move_to_end(key)
            PARSED_CACHE[key] = data
            return
        while len(PARSED_CACHE) >= MAX_PARSED_CACHE_ENTRIES:
            PARSED_CACHE.popitem(last=False)
        PARSED_CACHE[key] = data

def org_dataset_get(org_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves an entry from ORG_DATASETS and refreshes LRU recency."""
    with _ORG_DATASETS_LOCK:
        if org_id in ORG_DATASETS:
            ORG_DATASETS.move_to_end(org_id)
            return ORG_DATASETS[org_id]
        return None

def org_dataset_put(org_id: int, entry: Dict[str, Any]):
    """Inserts or updates an entry in ORG_DATASETS with genuine LRU eviction."""
    with _ORG_DATASETS_LOCK:
        if org_id in ORG_DATASETS:
            ORG_DATASETS.move_to_end(org_id)
            ORG_DATASETS[org_id] = entry
            return
        while len(ORG_DATASETS) >= MAX_ORG_DATASETS_ENTRIES:
            ORG_DATASETS.popitem(last=False)
        ORG_DATASETS[org_id] = entry

def org_dataset_del(org_id: int):
    """Evicts an entry from ORG_DATASETS."""
    with _ORG_DATASETS_LOCK:
        ORG_DATASETS.pop(org_id, None)

_RECS_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_RECS_LOCK = threading.Lock()
_LEDGER_SYNCED_SETS = set()
_LEDGER_SYNC_LOCK = threading.Lock()

def get_cached_recommendations(dataset_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Retrieves or calculates recommendations without mutating the shared dataset dictionary."""
    with _RECS_LOCK:
        if dataset_key in _RECS_CACHE:
            _RECS_CACHE.move_to_end(dataset_key)
            return _RECS_CACHE[dataset_key]
        recs = generate_recommendations(data)
        while len(_RECS_CACHE) >= 10:
            _RECS_CACHE.popitem(last=False)
        _RECS_CACHE[dataset_key] = recs
        return recs

def get_upload_semaphore() -> asyncio.Semaphore:
    global _UPLOAD_SEMAPHORE
    if _UPLOAD_SEMAPHORE is None:
        _UPLOAD_SEMAPHORE = asyncio.Semaphore(2)
    return _UPLOAD_SEMAPHORE

def load_initial_dataset():
    """
    Initializes global public demo dataset exclusively from curated sample catalog.
    Strict tenant boundary: Never loads private organization uploads from UPLOADS_DIR.
    """
    sample_path = os.path.join(SAMPLES_DIR, "aws_cur_production_exact.csv")
    if not os.path.exists(sample_path):
        candidates = glob.glob(os.path.join(SAMPLES_DIR, "*.csv"))
        if candidates:
            sample_path = candidates[0]

    if os.path.exists(sample_path):
        try:
            parsed = parse_cur_file(sample_path)
            CURRENT_DATASET['filename'] = os.path.basename(sample_path)
            CURRENT_DATASET['filepath'] = sample_path
            CURRENT_DATASET['data'] = parsed
            norm_path = os.path.abspath(sample_path)
            mtime = os.path.getmtime(sample_path)
            cache_put_parsed(sample_path, parsed)
            cache_put_parsed(norm_path, parsed)
            cache_put_parsed(f"{norm_path}_{mtime}", parsed)
            logger.info("Loaded public demo dataset: %s ($%s)", os.path.basename(sample_path), parsed.get('total_cost'))
        except Exception as e:
            logger.warning("Failed to load demo sample dataset %s: %s", sample_path, e)
    else:
        CURRENT_DATASET['filename'] = None
        CURRENT_DATASET['filepath'] = None
        CURRENT_DATASET['data'] = None
        logger.info("No sample dataset available in %s", SAMPLES_DIR)

load_initial_dataset()
