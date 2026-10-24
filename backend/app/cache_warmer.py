"""
ZORVEX FinOps Platform - Pre-Emptive Redis Cache Warmer
======================================================
Asynchronous background pipeline to pre-calculate and warm Redis caches
for newly ingested, synchronized, or selected datasets.
"""
import logging
import threading
from typing import Optional, Dict, Any
from .cache import global_cache, get_dataset_cache_key
from .database import SessionLocal
from .models import DatasetRecord
from .repository import BillingRepository

logger = logging.getLogger("zorvex.cache_warmer")

class CacheWarmerService:
    """
    Background worker that pre-populates Redis cache with:
    - Overview summary
    - Trend analysis
    - Resource explorer default page & hierarchies
    Ensures 0ms cold-start latency when users navigate to dashboards.
    """

    @classmethod
    def warm_dataset_async(cls, org_id: int, dataset_id: Optional[int] = None, filename: Optional[str] = None):
        """Launches cache warming non-blockingly in a background daemon thread."""
        thread = threading.Thread(
            target=cls._warm_dataset_worker,
            args=(org_id, dataset_id, filename),
            daemon=True,
            name=f"CacheWarmer-Org{org_id}-Ds{dataset_id}"
        )
        thread.start()

    @classmethod
    def _warm_dataset_worker(cls, org_id: int, dataset_id: Optional[int] = None, filename: Optional[str] = None):
        db = SessionLocal()
        try:
            cls.warm_dataset_sync(db, org_id, dataset_id, filename)
        except Exception as e:
            logger.warning("CacheWarmer background worker error for org %s: %s", org_id, e)
        finally:
            db.close()

    @classmethod
    def warm_dataset_sync(cls, db, org_id: int, dataset_id: Optional[int] = None, filename: Optional[str] = None) -> Dict[str, Any]:
        """Synchronous cache warmer executing queries and populating Redis."""
        query = db.query(DatasetRecord).filter(DatasetRecord.organization_id == org_id)
        if dataset_id:
            d_rec = query.filter(DatasetRecord.id == dataset_id).first()
        elif filename:
            d_rec = query.filter(DatasetRecord.filename == filename).first()
        else:
            d_rec = query.filter(DatasetRecord.is_active == 1).first()

        if not d_rec:
            logger.debug("CacheWarmer: No active dataset found to warm for org %s", org_id)
            return {'status': 'SKIPPED', 'reason': 'DATASET_NOT_FOUND'}

        repo = BillingRepository(db, org_id=org_id, dataset_id=d_rec.id)
        repo.d_rec = d_rec
        if not repo.has_records():
            logger.debug("CacheWarmer: Dataset %s has no persisted records to warm", d_rec.id)
            return {'status': 'SKIPPED', 'reason': 'NO_RECORDS'}

        ds_key = get_dataset_cache_key(d_rec, repo)
        warmed = []

        # 1. Overview Dashboard
        ov_key = global_cache.build_key(org_id, ds_key, "overview", s=None, e=None, svc=None, acc=None)
        def _compute_ov():
            res = repo.get_overview()
            res['data_source'] = 'database'
            res['filename'] = d_rec.filename
            return res
        global_cache.get_or_compute(ov_key, _compute_ov, ttl=1800)
        warmed.append('overview')

        # 2. Trends Analysis
        trends_key = global_cache.build_key(org_id, ds_key, "trends", s=None, e=None)
        global_cache.get_or_compute(trends_key, lambda: repo.get_trend_data(start_date=None, end_date=None), ttl=1800)
        warmed.append('trends')

        # 3. Resource Hierarchies
        hier_key = global_cache.build_key(org_id, ds_key, "hierarchies")
        global_cache.get_or_compute(hier_key, lambda: repo.get_resource_hierarchies(), ttl=3600)
        warmed.append('resources_hierarchies')

        # 4. Resource Explorer Default Page
        res_key = global_cache.build_key(
            org_id, ds_key, "resources",
            q=None, svc="All", cat="ALL", acc="all", reg="all",
            min_c=None, s=None, e=None, sb="cost", so="desc",
            p=1, ps=25
        )
        global_cache.get_or_compute(
            res_key,
            lambda: repo.query_resources(
                query=None, service="All", category="ALL", account_id="all", region="all",
                min_cost=None, start_date=None, end_date=None,
                sort_by="cost", sort_order="desc", page=1, page_size=25
            ),
            ttl=600
        )
        warmed.append('resources_default_page')

        logger.info("CacheWarmer: Successfully pre-warmed Redis for org %s, dataset %s (%d endpoints)", org_id, ds_key, len(warmed))
        return {'status': 'SUCCESS', 'warmed_endpoints': warmed, 'dataset_key': ds_key}
