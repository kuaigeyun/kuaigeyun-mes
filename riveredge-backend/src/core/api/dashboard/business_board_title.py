"""
运营看板外观 API

按租户持久化至 infra_tenant_configs（config_key=dashboard.business_board_title）。
含顶栏标题、中间配图、参观模式及手填指标。
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User
from infra.services.tenant_service import TenantService

BUSINESS_BOARD_TITLE_CONFIG_KEY = "dashboard.business_board_title"
# 历史品牌默认文案残留：这些值应视为“未自定义”，读取时自动清理配置。
LEGACY_DEFAULT_TITLES = {
    "快格云制造运营看板",
}

VISIT_METRIC_KEYS = (
    "today_output",
    "qualified_rate",
    "in_progress_wo",
    "pending_schedule",
    "avg_cycle",
    "on_time_delivery",
    "rework_count",
    "repairing_count",
)

router = APIRouter(prefix="/dashboard", tags=["Core - Dashboard"])


class BusinessBoardVisitMetrics(BaseModel):
    today_output: Optional[float] = Field(None, ge=0)
    qualified_rate: Optional[float] = Field(None, ge=0, le=100)
    in_progress_wo: Optional[float] = Field(None, ge=0)
    pending_schedule: Optional[float] = Field(None, ge=0)
    avg_cycle: Optional[float] = Field(None, ge=0)
    on_time_delivery: Optional[float] = Field(None, ge=0, le=100)
    rework_count: Optional[float] = Field(None, ge=0)
    repairing_count: Optional[float] = Field(None, ge=0)


class BusinessBoardTitleResponse(BaseModel):
    title: Optional[str] = None
    hero_image_uuid: Optional[str] = Field(None, description="中间配图文件 UUID，空表示使用系统默认图")
    visit_mode: bool = Field(False, description="参观模式：中心指标用手填值展示")
    visit_metrics: BusinessBoardVisitMetrics = Field(default_factory=BusinessBoardVisitMetrics)


class BusinessBoardTitleBody(BaseModel):
    title: Optional[str] = Field(None, max_length=80, description="为空表示恢复默认标题")
    hero_image_uuid: Optional[str] = Field(
        None,
        max_length=40,
        description="中间配图文件 UUID，空或省略表示使用系统默认图",
    )
    visit_mode: Optional[bool] = Field(
        None,
        description="参观模式开关；仅组织管理员 / 平台管理员可写",
    )
    visit_metrics: Optional[BusinessBoardVisitMetrics] = Field(
        None,
        description="参观模式手填指标；仅组织管理员 / 平台管理员可写",
    )


def _normalize_config_value(config_value: Any) -> Optional[Dict[str, Any]]:
    if not config_value:
        return None
    if isinstance(config_value, str):
        import json

        try:
            config_value = json.loads(config_value)
        except Exception:
            return None
    if not isinstance(config_value, dict):
        return None
    return config_value


def _extract_title(config_value: Optional[dict]) -> Optional[str]:
    cv = _normalize_config_value(config_value)
    if not cv:
        return None
    raw = cv.get("title")
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _extract_hero_image_uuid(config_value: Optional[dict]) -> Optional[str]:
    cv = _normalize_config_value(config_value)
    if not cv:
        return None
    raw = cv.get("hero_image_uuid")
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _extract_visit_mode(config_value: Optional[dict]) -> bool:
    cv = _normalize_config_value(config_value)
    if not cv:
        return False
    return bool(cv.get("visit_mode"))


def _extract_visit_metrics(config_value: Optional[dict]) -> BusinessBoardVisitMetrics:
    cv = _normalize_config_value(config_value)
    if not cv:
        return BusinessBoardVisitMetrics()
    raw = cv.get("visit_metrics")
    if not isinstance(raw, dict):
        return BusinessBoardVisitMetrics()
    cleaned: Dict[str, float] = {}
    for key in VISIT_METRIC_KEYS:
        if key not in raw or raw[key] is None:
            continue
        try:
            cleaned[key] = float(raw[key])
        except (TypeError, ValueError):
            continue
    return BusinessBoardVisitMetrics(**cleaned)


def _visit_metrics_to_dict(metrics: BusinessBoardVisitMetrics) -> Dict[str, float]:
    out: Dict[str, float] = {}
    for key in VISIT_METRIC_KEYS:
        val = getattr(metrics, key, None)
        if val is None:
            continue
        out[key] = float(val)
    return out


def _is_system_admin(auth: AuthContext) -> bool:
    return bool(auth.is_tenant_admin or auth.is_infra_admin)


def _build_response(config_value: Any) -> BusinessBoardTitleResponse:
    return BusinessBoardTitleResponse(
        title=_extract_title(config_value),
        hero_image_uuid=_extract_hero_image_uuid(config_value),
        visit_mode=_extract_visit_mode(config_value),
        visit_metrics=_extract_visit_metrics(config_value),
    )


@router.get("/business-board-title", response_model=BusinessBoardTitleResponse)
async def get_business_board_title(
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    """获取当前租户运营看板外观（未设置则 title 为 null，前端用 i18n 默认）。"""
    svc = TenantService()
    row = await svc.get_tenant_config(tenant_id, BUSINESS_BOARD_TITLE_CONFIG_KEY)
    raw_val = row.config_value if row else None
    title = _extract_title(raw_val)
    hero_uuid = _extract_hero_image_uuid(raw_val)
    visit_mode = _extract_visit_mode(raw_val)
    visit_metrics = _extract_visit_metrics(raw_val)
    if row and title in LEGACY_DEFAULT_TITLES:
        # 兼容历史版本：旧品牌默认文案不应覆盖当前 i18n 默认标题。
        keep: Dict[str, Any] = {}
        if hero_uuid:
            keep["hero_image_uuid"] = hero_uuid
        if visit_mode:
            keep["visit_mode"] = True
        metrics_dict = _visit_metrics_to_dict(visit_metrics)
        if metrics_dict:
            keep["visit_metrics"] = metrics_dict
        if keep:
            await svc.set_tenant_config(
                tenant_id,
                BUSINESS_BOARD_TITLE_CONFIG_KEY,
                keep,
                description="运营看板外观（租户级）",
            )
            return _build_response(keep)
        await row.delete()
        return BusinessBoardTitleResponse()
    return BusinessBoardTitleResponse(
        title=title,
        hero_image_uuid=hero_uuid,
        visit_mode=visit_mode,
        visit_metrics=visit_metrics,
    )


@router.put("/business-board-title", response_model=BusinessBoardTitleResponse)
async def put_business_board_title(
    body: BusinessBoardTitleBody,
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
    auth: AuthContext = Depends(get_auth_context),
):
    """保存运营看板顶栏标题、中间配图与参观模式（租户级）。"""
    touches_visit = body.visit_mode is not None or body.visit_metrics is not None
    if touches_visit and not _is_system_admin(auth):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="仅系统管理员可配置参观模式",
        )

    svc = TenantService()
    existing = await svc.get_tenant_config(tenant_id, BUSINESS_BOARD_TITLE_CONFIG_KEY)
    prev = _normalize_config_value(existing.config_value if existing else None) or {}

    title_val = (body.title or "").strip() or None
    hero_raw = (body.hero_image_uuid or "").strip() or None
    if hero_raw:
        try:
            UUID(hero_raw)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="hero_image_uuid 不是有效的 UUID",
            )

    new_cfg: Dict[str, Any] = {}
    if title_val:
        new_cfg["title"] = title_val
    if hero_raw:
        new_cfg["hero_image_uuid"] = hero_raw

    if touches_visit:
        visit_mode = bool(body.visit_mode) if body.visit_mode is not None else bool(prev.get("visit_mode"))
        if body.visit_metrics is not None:
            metrics_dict = _visit_metrics_to_dict(body.visit_metrics)
        else:
            metrics_dict = _visit_metrics_to_dict(_extract_visit_metrics(prev))
        if visit_mode:
            new_cfg["visit_mode"] = True
        if metrics_dict:
            new_cfg["visit_metrics"] = metrics_dict
    else:
        if prev.get("visit_mode"):
            new_cfg["visit_mode"] = True
        prev_metrics = _visit_metrics_to_dict(_extract_visit_metrics(prev))
        if prev_metrics:
            new_cfg["visit_metrics"] = prev_metrics

    if not new_cfg:
        if existing:
            await existing.delete()
        return BusinessBoardTitleResponse()

    await svc.set_tenant_config(
        tenant_id,
        BUSINESS_BOARD_TITLE_CONFIG_KEY,
        new_cfg,
        description="运营看板外观（租户级）",
    )
    return _build_response(new_cfg)
