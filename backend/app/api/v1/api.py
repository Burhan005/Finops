"""
ZORVEX API v1 Central Router Aggregation.
Mounts modular endpoint routers into /api prefix.
"""

from fastapi import APIRouter
from .endpoints.auth import router as auth_router
from .endpoints.datasets import router as datasets_router
from .endpoints.overview import router as overview_router
from .endpoints.analytics import router as analytics_router
from .endpoints.governance import router as governance_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(datasets_router)
api_v1_router.include_router(overview_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(governance_router)
