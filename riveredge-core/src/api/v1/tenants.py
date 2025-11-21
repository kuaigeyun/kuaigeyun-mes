"""
组织管理 API 模块

提供组织管理的 RESTful API 接口
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends

from schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse,
    TenantUsageResponse,
    TenantActivityLogListResponse,
)
from services.tenant_service import TenantService
from models.tenant import TenantStatus, TenantPlan
from models.user import User
from core.package_config import get_package_config, get_all_package_configs

# 创建路由
router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.post("", response_model=TenantResponse, status_code=201)
async def create_tenant(data: TenantCreate):
    """
    创建组织
    
    创建新组织。注意：此接口通常需要超级管理员权限。
    
    Args:
        data: 组织创建数据
        
    Returns:
        TenantResponse: 创建的组织
        
    Raises:
        HTTPException: 当域名已存在时返回 400 错误
    """
    service = TenantService()
    try:
        tenant = await service.create_tenant(data)
        return tenant
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    status: Optional[TenantStatus] = Query(None, description="组织状态筛选"),
    plan: Optional[TenantPlan] = Query(None, description="组织套餐筛选"),
):
    """
    获取组织列表
    
    支持分页、状态筛选、套餐筛选。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        status: 组织状态筛选（可选）
        plan: 组织套餐筛选（可选）
        
    Returns:
        TenantListResponse: 组织列表响应
    """
    service = TenantService()
    result = await service.list_tenants(
        page=page,
        page_size=page_size,
        status=status,
        plan=plan,
    )
    return result


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: int):
    """
    获取组织详情
    
    根据组织 ID 获取组织详细信息。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        tenant_id: 组织 ID
        
    Returns:
        TenantResponse: 组织详情
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(tenant_id: int, data: TenantUpdate):
    """
    更新组织信息
    
    更新组织的详细信息。只更新提供的字段。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        tenant_id: 组织 ID
        data: 组织更新数据
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.update_tenant(tenant_id, data)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    return tenant


@router.delete("/{tenant_id}", status_code=204)
async def delete_tenant(tenant_id: int):
    """
    删除组织（软删除）
    
    将组织状态设置为 SUSPENDED，而不是真正删除数据。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        tenant_id: 组织 ID
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    success = await service.delete_tenant(tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="组织不存在")


@router.post("/{tenant_id}/activate", response_model=TenantResponse)
async def activate_tenant(tenant_id: int):
    """
    激活组织
    
    将组织状态设置为 ACTIVE。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        tenant_id: 组织 ID
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.activate_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    return tenant


@router.post("/{tenant_id}/deactivate", response_model=TenantResponse)
async def deactivate_tenant(tenant_id: int):
    """
    停用组织
    
    将组织状态设置为 INACTIVE。
    注意：此接口通常需要超级管理员权限。
    
    Args:
        tenant_id: 组织 ID
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.deactivate_tenant(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    return tenant


@router.get("/packages/config", response_model=dict)
async def get_package_configs():
    """
    获取所有套餐配置
    
    返回所有套餐类型的配置信息，包括用户数限制、存储空间限制、应用权限等。
    
    Returns:
        dict: 所有套餐配置字典
    """
    return get_all_package_configs()


@router.get("/packages/{plan}/config", response_model=dict)
async def get_package_config(plan: TenantPlan):
    """
    获取指定套餐配置
    
    返回指定套餐类型的配置信息。
    
    Args:
        plan: 套餐类型
        
    Returns:
        dict: 套餐配置字典
        
    Raises:
        HTTPException: 当套餐类型不存在时返回 400 错误
    """
    try:
        return get_package_config(plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{tenant_id}/usage", response_model=TenantUsageResponse)
async def get_tenant_usage(tenant_id: int):
    """
    获取组织使用量统计
    
    返回组织的实际使用量（用户数、存储空间等）。
    注意：此接口通常需要超级管理员权限或组织管理员权限。
    
    Args:
        tenant_id: 组织 ID
        
    Returns:
        TenantUsageResponse: 组织使用量统计响应
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    
    # 统计用户数（只统计激活的用户）
    user_count = await User.filter(tenant_id=tenant_id, is_active=True).count()
    
    # 统计存储空间（简化：暂时使用占位数据，后期从文件表统计）
    storage_used_mb = 0  # 占位数据，后期从文件表统计
    
    # 计算使用百分比
    user_usage_percent = (user_count / tenant.max_users * 100) if tenant.max_users > 0 else 0
    storage_usage_percent = (storage_used_mb / tenant.max_storage * 100) if tenant.max_storage > 0 else 0
    
    # 检查配额预警（使用量 >= 80%）
    from core.package_config import check_package_limit
    exceeded, warnings = check_package_limit(
        tenant.plan,
        user_count,
        storage_used_mb
    )
    
    return TenantUsageResponse(
        tenant_id=tenant_id,
        user_count=user_count,
        max_users=tenant.max_users,
        storage_used_mb=storage_used_mb,
        max_storage_mb=tenant.max_storage,
        user_usage_percent=round(user_usage_percent, 2),
        storage_usage_percent=round(storage_usage_percent, 2),
        warnings=warnings,
    )


@router.get("/{tenant_id}/activity-logs", response_model=TenantActivityLogListResponse)
async def get_tenant_activity_logs(
    tenant_id: int,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    action: Optional[str] = Query(None, description="操作类型筛选"),
):
    """
    获取组织活动日志列表
    
    返回组织的活动日志列表，支持分页和操作类型筛选。
    注意：此接口通常需要超级管理员权限或组织管理员权限。
    
    Args:
        tenant_id: 组织 ID
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        action: 操作类型筛选（可选，如：create, activate, deactivate, update 等）
        
    Returns:
        TenantActivityLogListResponse: 组织活动日志列表响应
        
    Raises:
        HTTPException: 当组织不存在时返回 404 错误
    """
    service = TenantService()
    tenant = await service.get_tenant_by_id(tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="组织不存在")
    
    result = await service.get_tenant_activity_logs(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        action=action,
    )
    return result

