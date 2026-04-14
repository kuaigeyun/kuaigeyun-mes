"""
运营看板顶栏标题 API

按租户持久化至 infra_tenant_configs（config_key=dashboard.business_board_title）。
"""

from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User
from infra.services.tenant_service import TenantService

BUSINESS_BOARD_TITLE_CONFIG_KEY = "dashboard.business_board_title"
# 历史品牌默认文案残留：这些值应视为“未自定义”，读取时自动清理配置。
LEGACY_DEFAULT_TITLES = {
    "快格云制造运营看板",
}

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


class BusinessBoardTitleResponse(BaseModel):
    title: Optional[str] = None


class BusinessBoardTitleBody(BaseModel):
    title: Optional[str] = Field(None, max_length=80, description="为空表示恢复默认标题")


def _extract_title(config_value: Optional[dict]) -> Optional[str]:
    if not config_value or not isinstance(config_value, dict):
        return None
    raw = config_value.get("title")
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
    title = _extract_title(row.config_value if row else None)
    if row and title in LEGACY_DEFAULT_TITLES:
        # 兼容历史版本：旧品牌默认文案不应覆盖当前 i18n 默认标题。
        await row.delete()
        return BusinessBoardTitleResponse(title=None)
    return BusinessBoardTitleResponse(title=title)


@router.put("/business-board-title", response_model=BusinessBoardTitleResponse)
async def put_business_board_title(
    body: BusinessBoardTitleBody,
    tenant_id: int = Depends(get_current_tenant),
    _: User = Depends(get_current_user),
):
    """保存或清空运营看板顶栏标题（租户级，同一租户内所有用户看到同一标题）。"""
    svc = TenantService()
    raw = (body.title or "").strip()
    if raw:
        await svc.set_tenant_config(
            tenant_id,
            BUSINESS_BOARD_TITLE_CONFIG_KEY,
            {"title": raw},
            description="运营看板顶栏标题（租户级）",
        )
        return BusinessBoardTitleResponse(title=raw)

    existing = await svc.get_tenant_config(tenant_id, BUSINESS_BOARD_TITLE_CONFIG_KEY)
    if existing:
        await existing.delete()
    return BusinessBoardTitleResponse(title=None)
