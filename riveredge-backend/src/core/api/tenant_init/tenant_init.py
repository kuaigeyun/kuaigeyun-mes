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

router = APIRouter(prefix="/tenant-init", tags=["Core - Tenant Init"])


class RunInitRequest(BaseModel):
    """执行初始化请求"""
    keys: List[str] = Field(..., description="要执行的初始化项 key 列表")


class RunIndustryPresetRequest(BaseModel):
    """执行行业预设请求"""
    industry_code: str = Field(..., description="行业预设代码 (如 sme_manufacturing)")


class RunInitResponse(BaseModel):
    """执行初始化响应"""
    results: dict = Field(..., description="各初始化项执行结果")
    message: str = Field(default="执行完成", description="提示信息")


class BootstrapStatusResponse(BaseModel):
    """首次引导初始化状态"""
    pending: bool = Field(..., description="是否仍需完成引导初始化")
    bootstrap_completed: bool = Field(..., description="是否已完成引导初始化")
    steps: list = Field(default_factory=list, description="引导步骤列表")


class RunBootstrapStepRequest(BaseModel):
    """执行单步引导初始化"""
    key: str = Field(..., description="步骤 key（application 或必备初始项 key）")


class RunBootstrapStepResponse(BaseModel):
    """单步引导初始化结果"""
    key: str
    success: bool
    created: Optional[int] = None
    error: Optional[str] = None


@router.get("/bootstrap-status", response_model=BootstrapStatusResponse)
async def get_bootstrap_status(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询组织是否仍需完成首次引导初始化（应用 + 必备系统初始项）。
    """
    return await TenantInitDataService.get_bootstrap_status(tenant_id)


@router.post("/run-bootstrap-step", response_model=RunBootstrapStepResponse)
async def run_bootstrap_step(
    data: RunBootstrapStepRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user_dep),
):
    """
    执行单步引导初始化（应用注册/启用，或一项必备系统初始项）。
    """
    try:
        result = await TenantInitDataService.run_bootstrap_step(
            tenant_id,
            data.key,
            current_user_id=current_user.id,
        )
        return RunBootstrapStepResponse(
            key=data.key,
            success=True,
            created=result.get("created"),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        return RunBootstrapStepResponse(
            key=data.key,
            success=False,
            error=str(e),
        )


@router.post("/complete-bootstrap")
async def complete_bootstrap(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    标记首次引导初始化完成（写入默认站点/向导设置）。
    """
    try:
        await TenantInitDataService.complete_bootstrap(tenant_id)
        return {"success": True, "message": "引导初始化完成"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/config")
async def get_init_config(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取初始化项配置

    返回必选和可选的初始化项列表，供前端展示多选。
    """
    return TenantInitDataService.get_init_items_config()


@router.post("/run-required", response_model=RunInitResponse)
async def run_required_init_items(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user_dep),
):
    """
    执行全部必备系统初始项（不含应用注册；应用安装/启用由平台管理员处理）。
    """
    results = await TenantInitDataService.run_required(tenant_id)

    success_count = sum(1 for r in results.values() if r.get("success"))
    total = len(results)
    return RunInitResponse(
        results=results,
        message=f"必备初始项执行完成，成功 {success_count}/{total} 项",
    )


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


@router.get("/industry-presets")
async def get_industry_presets(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取行业预设模板列表
    
    返回系统支持的所有行业预设模板（一键建账），供新建组织或初始化时选择。
    """
    return TenantInitDataService.get_industry_presets()


@router.post("/run-industry-preset", response_model=RunInitResponse)
async def run_industry_preset(
    data: RunIndustryPresetRequest,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user_dep),
):
    """
    执行行业预设初始化（一键建账）
    
    根据选定的行业类型，自动注入该行业对应的全套基础数据（部门、角色、仓库、工序等）。
    """
    try:
        results = await TenantInitDataService.run_industry_preset(
            tenant_id=tenant_id,
            industry_code=data.industry_code,
            current_user_id=current_user.id,
        )
        success_count = sum(1 for r in results.values() if r.get("success"))
        return RunInitResponse(
            results=results,
            message=f"行业预设[{data.industry_code}]执行完成，成功 {success_count}/{len(results)} 项",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
