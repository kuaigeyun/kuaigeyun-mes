"""
平台专用应用绑定：仅平台超级管理员可维护。

绑定后，对应租户在应用中心才能看到 is_dedicated 应用。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.services.application.application_dedicated_binding_service import ApplicationDedicatedBindingService
from infra.api.deps.deps import get_current_infra_superadmin
from infra.exceptions.exceptions import ValidationError
from infra.models.infra_superadmin import InfraSuperAdmin

router = APIRouter(prefix="/application-dedicated-bindings", tags=["Platform - Dedicated Apps"])


class DedicatedBindingItem(BaseModel):
    id: int
    app_code: str
    tenant_id: int
    tenant_name: Optional[str] = None
    created_at: Any


class BindDedicatedBody(BaseModel):
    app_code: str = Field(..., min_length=1, max_length=50)
    tenant_id: int = Field(..., ge=1)


@router.get("", response_model=List[DedicatedBindingItem])
async def list_dedicated_bindings(
    app_code: Optional[str] = Query(None, description="按应用代码筛选"),
    _: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    rows = await ApplicationDedicatedBindingService.list_bindings(app_code=app_code)
    return [DedicatedBindingItem(**r) for r in rows]


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def bind_dedicated_app(
    body: BindDedicatedBody,
    _: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    try:
        await ApplicationDedicatedBindingService.bind(body.app_code.strip(), body.tenant_id)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def unbind_dedicated_app(
    app_code: str = Query(..., min_length=1),
    tenant_id: int = Query(..., ge=1),
    _: InfraSuperAdmin = Depends(get_current_infra_superadmin),
):
    await ApplicationDedicatedBindingService.unbind(app_code.strip(), tenant_id)
