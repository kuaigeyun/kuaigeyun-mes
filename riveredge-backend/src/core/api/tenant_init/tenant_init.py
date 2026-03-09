"""
租户初始化 API 路由

提供统一初始化数据加载接口，供各页面「加载初始」按钮及新建租户时调用。
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status

from pydantic import BaseModel, Field

from core.services.tenant.tenant_init_data_service import TenantInitDataService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as get_current_user_dep
from infra.models.user import User

router = APIRouter(prefix="/tenant-init", tags=["TenantInit"])


class RunInitRequest(BaseModel):
    """执行初始化请求"""
    keys: List[str] = Field(..., description="要执行的初始化项 key 列表")


class RunInitResponse(BaseModel):
    """执行初始化响应"""
    results: dict = Field(..., description="各初始化项执行结果")
    message: str = Field(default="执行完成", description="提示信息")


@router.get("/config")
async def get_init_config(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取初始化项配置

    返回必选和可选的初始化项列表，供前端展示多选。
    """
    return TenantInitDataService.get_init_items_config()


@router.post("/run", response_model=RunInitResponse)
async def run_init_items(
    data: RunInitRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user_dep),
):
    """
    执行选中的初始化项

    用于各页面「加载初始」按钮或批量执行。仅支持可选初始化项。
    """
    valid_optional = {i["key"] for i in TenantInitDataService.INIT_ITEMS_OPTIONAL}
    invalid_keys = [k for k in data.keys if k not in valid_optional]
    if invalid_keys:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的初始化项或必选项不可单独执行: {invalid_keys}",
        )

    results = await TenantInitDataService.run_optional(
        tenant_id=tenant_id,
        selected_keys=data.keys,
        current_user_id=current_user.id,
    )
    success_count = sum(1 for r in results.values() if r.get("success"))
    return RunInitResponse(
        results=results,
        message=f"执行完成，成功 {success_count}/{len(data.keys)} 项",
    )
