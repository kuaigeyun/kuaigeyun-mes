"""
模具运营 API 路由聚合。
"""

from fastapi import APIRouter

from .master_data import router as master_data_router
from .documents import router as documents_router
from .scheme_bindings import router as scheme_bindings_router
from .reports import router as reports_router

router = APIRouter(tags=["App · Kuaige Zhizao · Mold Ops"])

router.include_router(master_data_router)
router.include_router(scheme_bindings_router)
router.include_router(documents_router)
router.include_router(reports_router)
