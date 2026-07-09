"""
好力GO — 主路由

契约见本地 `riveredge-adapt/haoli-go/PLAN.md` §9（默认 gitignore）。设备/模具/巡查业务 **单独在本应用实现**，不复用 `kuaizhizao`；路由按 PLAN §5、§6 迭代挂载。
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

import apps.haoligo.services.haoligo_business_notification  # noqa: F401 — 注册消息收件范围
from apps.haoligo.api.routes_equipment import router as equipment_router
from apps.haoligo.api.routes_equipment_upkeep import router as equipment_upkeep_router
from apps.haoligo.api.routes_equipment_documents import router as equipment_documents_router
from apps.haoligo.api.routes_equipment_reports import router as equipment_reports_router
from apps.haoligo.api.routes_equipment_acceptance_sheet import router as equipment_acceptance_sheet_router
from apps.haoligo.api.routes_equipment_status_adjustment import router as equipment_status_adjustment_router
from apps.haoligo.api.routes_equipment_upkeep_complete_sheet import (
    router as equipment_upkeep_complete_sheet_router,
)
from apps.haoligo.api.routes_equipment_upkeep_sheet import router as equipment_upkeep_sheet_router
from apps.haoligo.api.routes_mobile import router as mobile_router
from apps.haoligo.api.routes_mold import router as mold_router
from apps.haoligo.api.routes_mold_upkeep import router as mold_upkeep_router
from apps.haoligo.api.routes_mold_warehouse import router as mold_warehouse_router
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
from apps.haoligo.api.routes_notify_users import router as notify_users_router
from apps.haoligo.api.routes_mold_reports import router as mold_reports_router
from apps.haoligo.api.routes_patrol import router as patrol_router
from apps.haoligo.api.routes_patrol_reports import router as patrol_reports_router
from apps.haoligo.api.routes_quality import router as quality_router
from apps.haoligo.api.routes_quality_reports import router as quality_reports_router
from apps.haoligo.api.routes_print import router as print_router
from apps.haoligo.api.routes_config import router as config_router
from apps.haoligo.api.routes_finance_supplier import router as finance_supplier_router
from apps.haoligo.api.routes_finance_supplier_prices import router as finance_supplier_prices_router
from apps.haoligo.api.routes_finance_invoice import router as finance_invoice_router
from apps.haoligo.api.routes_finance_acceptance import router as finance_acceptance_router
from apps.haoligo.api.routes_finance_payment import router as finance_payment_router
from apps.haoligo.api.routes_finance_reports import monthly_router as finance_monthly_report_router
from apps.haoligo.api.routes_finance_reports import payable_router as finance_payable_report_router

router = APIRouter(tags=["App · HaoliGO"])


class HaoligoMeta(BaseModel):
    """应用元信息（运维 / 移动端探测 base URL 与产品名）"""

    app_key: str = Field(description="URL 路径使用的应用键", examples=["haoligo"])
    display_name: str = Field(description="对用户展示的产品名称", examples=["好力GO"])
    api_prefix: str = Field(description="当前挂载的 API 前缀", examples=["/api/v1/apps/haoligo"])
    min_supported_version_code: int | None = Field(
        default=None,
        description="当前 active 发布要求的最低 Android versionCode（无发布时为 null）",
    )


@router.get("/meta", response_model=HaoligoMeta, summary="好力GO 元信息")
async def get_haoligo_meta() -> HaoligoMeta:
    from core.config.client_product_registry import CLIENT_KEY_HAOLIGO
    from core.services.client_release_service import get_active_release

    active = await get_active_release(CLIENT_KEY_HAOLIGO, "android")
    min_vc = active.min_version_code if active else None
    return HaoligoMeta(
        app_key="haoligo",
        display_name="好力GO",
        api_prefix="/api/v1/apps/haoligo",
        min_supported_version_code=min_vc,
    )


router.include_router(equipment_router)
router.include_router(equipment_upkeep_router)
router.include_router(equipment_documents_router)
router.include_router(equipment_upkeep_sheet_router)
router.include_router(equipment_upkeep_complete_sheet_router)
router.include_router(equipment_acceptance_sheet_router)
router.include_router(equipment_status_adjustment_router)
router.include_router(equipment_reports_router)
router.include_router(mold_borrow_sheet_router)
router.include_router(mold_return_sheet_router)
router.include_router(mold_trial_sheet_router)
router.include_router(mold_outsource_maintenance_sheet_router)
router.include_router(mold_outsource_maintenance_complete_sheet_router)
router.include_router(mold_maintenance_sheet_router)
router.include_router(mold_maintenance_complete_sheet_router)
router.include_router(mold_reports_router)
# 须在 mold_router 之前：后者含 /molds/{row_id}，否则会误把 /molds/warehouses 等当成模具 id
router.include_router(mold_warehouse_router)
router.include_router(mold_upkeep_router)
router.include_router(mold_router)
router.include_router(notify_users_router)
router.include_router(mobile_router)
router.include_router(patrol_router)
router.include_router(patrol_reports_router)
router.include_router(quality_router)
router.include_router(quality_reports_router)
router.include_router(finance_supplier_router)
router.include_router(finance_supplier_prices_router)
router.include_router(finance_invoice_router)
router.include_router(finance_acceptance_router)
router.include_router(finance_payment_router)
router.include_router(finance_payable_report_router)
router.include_router(finance_monthly_report_router)
router.include_router(print_router)
router.include_router(config_router)
