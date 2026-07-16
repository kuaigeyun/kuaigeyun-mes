"""
运营看板顶栏标题 API

按租户持久化至 infra_tenant_configs（config_key=dashboard.business_board_title）。
"""

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User
from infra.services.tenant_service import TenantService

BUSINESS_BOARD_TITLE_CONFIG_KEY = "dashboard.business_board_title"
# 历史品牌默认文案残留：这些值应视为“未自定义”，读取时自动清理配置。
LEGACY_DEFAULT_TITLES = {
    "快格云制造运营看板",
}

router = APIRouter(prefix="/dashboard", tags=["Core - Dashboard"])


class BusinessBoardTitleResponse(BaseModel):
    title: Optional[str] = None
    hero_image_uuid: Optional[str] = Field(None, description="中间配图文件 UUID，空表示使用系统默认图")


class BusinessBoardTitleBody(BaseModel):
    title: Optional[str] = Field(None, max_length=80, description="为空表示恢复默认标题")
    hero_image_uuid: Optional[str] = Field(
        None,
        max_length=40,
        description="中间配图文件 UUID，空或省略表示使用系统默认图",
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


@router.get("/business-board-title", response_model=BusinessBoardTitleResponse)
async def get_business_board_title(
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    """获取当前租户在运营看板使用的顶栏标题（未设置则 title 为 null，前端用 i18n 默认）。"""
    svc = TenantService()
    row = await svc.get_tenant_config(tenant_id, BUSINESS_BOARD_TITLE_CONFIG_KEY)
    raw_val = row.config_value if row else None
    title = _extract_title(raw_val)
    hero_uuid = _extract_hero_image_uuid(raw_val)
    if row and title in LEGACY_DEFAULT_TITLES:
        # 兼容历史版本：旧品牌默认文案不应覆盖当前 i18n 默认标题。
        if hero_uuid:
            await svc.set_tenant_config(
                tenant_id,
                BUSINESS_BOARD_TITLE_CONFIG_KEY,
                {"hero_image_uuid": hero_uuid},
                description="运营看板外观（租户级）",
            )
            return BusinessBoardTitleResponse(title=None, hero_image_uuid=hero_uuid)
        await row.delete()
        return BusinessBoardTitleResponse(title=None, hero_image_uuid=None)
    return BusinessBoardTitleResponse(title=title, hero_image_uuid=hero_uuid)


@router.put("/business-board-title", response_model=BusinessBoardTitleResponse)
async def put_business_board_title(
    body: BusinessBoardTitleBody,
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    """保存或清空运营看板顶栏标题与中间配图（租户级）。"""
    svc = TenantService()
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

    new_cfg: Dict[str, str] = {}
    if title_val:
        new_cfg["title"] = title_val
    if hero_raw:
        new_cfg["hero_image_uuid"] = hero_raw

    if not new_cfg:
        existing = await svc.get_tenant_config(tenant_id, BUSINESS_BOARD_TITLE_CONFIG_KEY)
        if existing:
            await existing.delete()
        return BusinessBoardTitleResponse(title=None, hero_image_uuid=None)

    await svc.set_tenant_config(
        tenant_id,
        BUSINESS_BOARD_TITLE_CONFIG_KEY,
        new_cfg,
        description="运营看板外观（租户级）",
    )
    return BusinessBoardTitleResponse(
        title=title_val,
        hero_image_uuid=hero_raw,
    )
