"""电子制造行业包 API。"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from core.services.application.industry_extension_runtime_service import (
    IndustryExtensionRuntimeService,
)
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

# 注册 OEM 扫码钩子（apps 路由加载时生效）
from apps.ind_electronics.services import label_oem_seed_service as _label_oem_hooks  # noqa: F401

router = APIRouter(prefix="", tags=["App - IndElectronics"])

class EsdProjectTypeUpdate(BaseModel):
    code: str = Field(..., max_length=64)
    label: Optional[str] = Field(None, max_length=200)
    active: Optional[bool] = None
    sort: Optional[int] = None
    value_type: Optional[str] = Field(None, max_length=32)
    method: Optional[str] = None
    judgment_standard: Optional[str] = None
    requirement: Optional[str] = None
    is_critical: Optional[bool] = None
    photo_required: Optional[bool] = None


class EsdCatalogUpdateRequest(BaseModel):
    project_types: List[EsdProjectTypeUpdate]


@router.get(
    "/health",
    summary="Industry module health",
    dependencies=[
        Depends(require_permission_codes("ind-electronics:entry:read"))
    ],
)
async def health(tenant_id: int = Depends(get_current_tenant)) -> dict:
    return {"ok": True, "app": "ind-electronics", "tenant_id": tenant_id}


@router.get(
    "/extensions/summary",
    summary="Industry extension summary for current tenant",
    dependencies=[
        Depends(require_permission_codes("ind-electronics:entry:read"))
    ],
)
async def extensions_summary(tenant_id: int = Depends(get_current_tenant)) -> dict:
    from apps.ind_electronics.services.license_catalog_seed_service import (
        get_license_catalog_summary,
    )

    decls = IndustryExtensionRuntimeService.declarations_for_module("ind-electronics")
    docs = await IndustryExtensionRuntimeService.list_active_document_replacements(tenant_id)
    license_catalog = await get_license_catalog_summary(tenant_id)
    from apps.ind_electronics.services.production_file_checklist_seed_service import (
        get_production_file_checklist_summary,
    )

    production_file_checklist = await get_production_file_checklist_summary(tenant_id)
    from apps.ind_electronics.services.supplier_eval_seed_service import (
        get_supplier_audit_plan_guide_summary,
    )
    from apps.ind_electronics.services.training_template_seed_service import (
        get_annual_training_plan_schema_summary,
    )

    annual_training_plan = await get_annual_training_plan_schema_summary(tenant_id)
    supplier_audit_plan = await get_supplier_audit_plan_guide_summary(tenant_id)
    return {
        "module": "ind-electronics",
        "declared": [
            {
                "id": d.id,
                "kind": d.kind,
                "strategy": d.strategy,
                "host_app": d.host_app,
                "menu_path": d.menu_path,
                "profile_key": d.profile_key,
                "replacement_path": d.replacement_path,
            }
            for d in decls
        ],
        "active_document_replacements": docs,
        "license_catalog": license_catalog,
        "production_file_checklist": production_file_checklist,
        "annual_training_plan": annual_training_plan,
        "supplier_audit_plan": supplier_audit_plan,
    }


@router.get(
    "/annual-training-plan-schema",
    summary="年度培训计划行字段对照（FND/R-04-01）",
    dependencies=[Depends(require_permission_codes("ind-electronics:entry:read"))],
)
async def get_annual_training_plan_schema(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.training_template_seed_service import (
        get_annual_training_plan_schema_summary,
    )

    return await get_annual_training_plan_schema_summary(tenant_id)


@router.get(
    "/supplier-audit-plan-guide",
    summary="供方年度监督审核计划排程对照",
    dependencies=[Depends(require_permission_codes("ind-electronics:entry:read"))],
)
async def get_supplier_audit_plan_guide(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.supplier_eval_seed_service import (
        get_supplier_audit_plan_guide_summary,
    )

    return await get_supplier_audit_plan_guide_summary(tenant_id)


@router.get(
    "/production-file-checklist",
    summary="电子制造 OA 上线资料清单（含生产文件对照）",
    dependencies=[Depends(require_permission_codes("ind-electronics:entry:read"))],
)
async def get_production_file_checklist(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.production_file_checklist_seed_service import (
        get_production_file_checklist_summary,
    )

    return await get_production_file_checklist_summary(tenant_id)


@router.get(
    "/license-catalog",
    summary="证照合规 15 类事项清单（行业预置）",
    dependencies=[Depends(require_permission_codes("ind-electronics:entry:read"))],
)
async def get_license_catalog(tenant_id: int = Depends(get_current_tenant)) -> Dict[str, Any]:
    from apps.ind_electronics.services.license_catalog_seed_service import (
        get_license_catalog_summary,
    )

    return await get_license_catalog_summary(tenant_id)


@router.post(
    "/license-catalog/apply-stubs",
    summary="按行业证照清单生成缺失台账占位",
    dependencies=[Depends(require_permission_codes("kuaioa:license:create"))],
)
async def apply_license_catalog_stubs(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.license_catalog_seed_service import (
        apply_license_catalog_stubs as apply_stubs,
    )

    result = await apply_stubs(tenant_id, current_user.id)
    return {"success": True, **result}


@router.get(
    "/esd/catalog",
    summary="ESD 项目清单与方案",
    dependencies=[Depends(require_permission_codes("ind-electronics:esd:read"))],
)
async def get_esd_catalog(tenant_id: int = Depends(get_current_tenant)) -> Dict[str, Any]:
    from apps.ind_electronics.services.esd_seed_service import get_esd_catalog_summary

    return await get_esd_catalog_summary(tenant_id)


@router.put(
    "/esd/catalog",
    summary="更新 ESD 项目清单并同步点检方案",
    dependencies=[Depends(require_permission_codes("ind-electronics:esd:update"))],
)
async def update_esd_catalog(
    body: EsdCatalogUpdateRequest,
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.esd_seed_service import (
        ensure_esd_catalog,
        get_esd_profile,
    )

    try:
        profile = await get_esd_profile(tenant_id)
        by_code = {
            str(x.get("code")): dict(x)
            for x in (profile.get("project_types") or [])
            if isinstance(x, dict) and x.get("code")
        }
        for item in body.project_types:
            current = by_code.get(item.code) or {"code": item.code, "sort": 0, "active": True}
            payload = item.model_dump(exclude_unset=True)
            current.update({k: v for k, v in payload.items() if v is not None or k == "active"})
            if "active" in item.model_fields_set:
                current["active"] = bool(item.active)
            by_code[item.code] = current
        profile["project_types"] = sorted(
            by_code.values(),
            key=lambda x: (int(x.get("sort") or 0), str(x.get("code") or "")),
        )
        result = await ensure_esd_catalog(tenant_id, profile=profile)
        return result
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.post(
    "/esd/catalog/ensure",
    summary="按行业包种子确保 ESD 点检项与方案存在",
    dependencies=[Depends(require_permission_codes("ind-electronics:esd:update"))],
)
async def ensure_esd_catalog_endpoint(
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.esd_seed_service import ensure_esd_catalog

    try:
        return await ensure_esd_catalog(tenant_id)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc


@router.get(
    "/esd/board/plants",
    summary="ESD 看板厂区列表",
    dependencies=[Depends(require_permission_codes("ind-electronics:esd:read"))],
)
async def esd_board_plants(tenant_id: int = Depends(get_current_tenant)) -> Dict[str, Any]:
    from apps.kuaizhizao.services.equipment_board_service import list_equipment_board_plants

    items = await list_equipment_board_plants(tenant_id)
    return {"items": items, "total": len(items)}


@router.get(
    "/esd/board",
    summary="ESD 总览/厂区看板",
    dependencies=[Depends(require_permission_codes("ind-electronics:esd:read"))],
)
async def esd_board(
    tenant_id: int = Depends(get_current_tenant),
    plant_id: Optional[int] = Query(None, description="厂区 ID；缺省总览"),
    alert_limit: int = Query(30, ge=1, le=100),
    visit_mode: bool = Query(False, description="参观展示模式"),
) -> Dict[str, Any]:
    from apps.kuaizhizao.services.equipment_board_service import get_equipment_board_with_visit

    return await get_equipment_board_with_visit(
        tenant_id,
        plant_id=plant_id,
        alert_limit=alert_limit,
        scheme_domain="esd",
        visit_mode=visit_mode,
    )


class LabelOemEnsureRequest(BaseModel):
    pack_codes: Optional[List[str]] = Field(
        None, description="仅确保指定签样包；空则全部抽象包"
    )


@router.get(
    "/label-oem/packs",
    summary="OEM 标签签样包目录与落地状态",
    dependencies=[Depends(require_permission_codes("ind-electronics:label-oem:read"))],
)
async def list_label_oem_packs(tenant_id: int = Depends(get_current_tenant)) -> Dict[str, Any]:
    from apps.ind_electronics.services.label_oem_seed_service import get_oem_pack_status

    return await get_oem_pack_status(tenant_id)


@router.post(
    "/label-oem/packs/ensure",
    summary="按行业抽象签样包种子确保型号配置存在",
    dependencies=[Depends(require_permission_codes("ind-electronics:label-oem:update"))],
)
async def ensure_label_oem_packs(
    body: LabelOemEnsureRequest = Body(default_factory=LabelOemEnsureRequest),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    from apps.ind_electronics.services.label_oem_seed_service import ensure_oem_label_packs

    try:
        return await ensure_oem_label_packs(
            tenant_id, current_user, pack_codes=body.pack_codes
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
