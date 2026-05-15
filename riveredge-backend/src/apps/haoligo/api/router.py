"""
好力GO — 主路由

契约见本地 `riveredge-adapt/haoli-go/PLAN.md` §9（默认 gitignore）。设备/模具/巡查业务 **单独在本应用实现**，不复用 `kuaizhizao`；路由按 PLAN §5、§6 迭代挂载。
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from apps.haoligo.api.routes_equipment import router as equipment_router
from apps.haoligo.api.routes_equipment_documents import router as equipment_documents_router
from apps.haoligo.api.routes_equipment_upkeep_complete_sheet import (
    router as equipment_upkeep_complete_sheet_router,
)
from apps.haoligo.api.routes_equipment_upkeep_sheet import router as equipment_upkeep_sheet_router
from apps.haoligo.api.routes_mold import router as mold_router
from apps.haoligo.api.routes_mold_borrow_sheet import router as mold_borrow_sheet_router
from apps.haoligo.api.routes_mold_return_sheet import router as mold_return_sheet_router
from apps.haoligo.api.routes_mold_trial_sheet import router as mold_trial_sheet_router
from apps.haoligo.api.routes_mold_maintenance_complete_sheet import (
    router as mold_maintenance_complete_sheet_router,
)
from apps.haoligo.api.routes_mold_maintenance_sheet import router as mold_maintenance_sheet_router
from apps.haoligo.api.routes_mold_outsource_maintenance_sheet import (
    router as mold_outsource_maintenance_sheet_router,
)
from apps.haoligo.api.routes_mold_outsource_maintenance_complete_sheet import (
    router as mold_outsource_maintenance_complete_sheet_router,
)
from apps.haoligo.api.routes_patrol import router as patrol_router
from apps.haoligo.api.routes_patrol_reports import router as patrol_reports_router

router = APIRouter(tags=["App · HaoliGO"])


class HaoligoMeta(BaseModel):
    """应用元信息（运维 / 移动端探测 base URL 与产品名）"""

    app_key: str = Field(description="URL 路径使用的应用键", examples=["haoligo"])
    display_name: str = Field(description="对用户展示的产品名称", examples=["好力GO"])
    api_prefix: str = Field(description="当前挂载的 API 前缀", examples=["/api/v1/apps/haoligo"])


@router.get("/meta", response_model=HaoligoMeta, summary="好力GO 元信息")
async def get_haoligo_meta() -> HaoligoMeta:
    return HaoligoMeta(
        app_key="haoligo",
        display_name="好力GO",
        api_prefix="/api/v1/apps/haoligo",
    )


router.include_router(equipment_router)
router.include_router(equipment_documents_router)
router.include_router(equipment_upkeep_sheet_router)
router.include_router(equipment_upkeep_complete_sheet_router)
router.include_router(mold_borrow_sheet_router)
router.include_router(mold_return_sheet_router)
router.include_router(mold_trial_sheet_router)
router.include_router(mold_outsource_maintenance_sheet_router)
router.include_router(mold_outsource_maintenance_complete_sheet_router)
router.include_router(mold_maintenance_sheet_router)
router.include_router(mold_maintenance_complete_sheet_router)
router.include_router(mold_router)
router.include_router(patrol_router)
router.include_router(patrol_reports_router)
