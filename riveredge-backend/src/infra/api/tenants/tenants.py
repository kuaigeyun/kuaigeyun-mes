"""
超级管理员组织管理 API 模块

提供超级管理员对组织的管理接口，包括组织注册审核、启用/禁用等。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status
from loguru import logger

from infra.schemas.tenant import TenantResponse, TenantListResponse, TenantUpdate, TenantCreate
from infra.services.tenant_service import TenantService
from infra.models.tenant import TenantStatus, TenantPlan
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.domain.timezone_utils import now
from infra.exceptions.exceptions import NotFoundError, ValidationError, ConflictError

# 创建路由
router = APIRouter(prefix="/tenants", tags=["Infra Tenants"])


@router.get("", response_model=TenantListResponse)
async def list_tenants_for_superadmin(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    status: Optional[TenantStatus] = Query(None, description="组织状态筛选"),
    plan: Optional[TenantPlan] = Query(None, description="组织套餐筛选"),
    name: Optional[str] = Query(None, description="组织名称搜索（模糊搜索）"),
    domain: Optional[str] = Query(None, description="域名搜索（模糊搜索）"),
    sort: Optional[str] = Query(None, description="排序字段（如：name、status、created_at）"),
    order: Optional[str] = Query(None, description="排序顺序（asc 或 desc）"),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取组织列表（超级管理员）
    
    超级管理员可以查看所有组织，支持分页、状态筛选、套餐筛选、文本字段模糊搜索、排序。
    使用 ProTable 原生搜索逻辑，简单可靠。
    此接口需要平台超级管理员权限。
    
    Args:
        page: 页码（从 1 开始，默认 1）
        page_size: 每页数量（1-100，默认 10）
        status: 组织状态筛选（可选，精确匹配）
        plan: 组织套餐筛选（可选，精确匹配）
        name: 组织名称搜索（可选，模糊搜索）
        domain: 域名搜索（可选，模糊搜索）
        sort: 排序字段（可选，如：name、status、created_at）
        order: 排序顺序（可选，asc 或 desc）
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        TenantListResponse: 组织列表响应数据
    """
    from loguru import logger
    logger.info(f"📋 [list_tenants_for_superadmin] 开始处理请求，admin_id: {current_admin.id}, page: {page}, page_size: {page_size}")
    service = TenantService()
    
    # 构建查询（超级管理员可以跨组织访问）
    result = await service.list_tenants(
        page=page,
        page_size=page_size,
        status=status,
        plan=plan,
        name=name,
        domain=domain,
        sort=sort,
        order=order,
        skip_tenant_filter=True  # ⭐ 关键：跳过组织过滤
    )
    
    return TenantListResponse(**result)


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant_detail_for_superadmin(
    tenant_id: int,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取组织详情（超级管理员）
    
    超级管理员可以查看任意组织的详细信息。
    
    Args:
        tenant_id: 组织 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 组织详情
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    
    # 获取组织（跳过组织过滤）
    tenant = await service.get_tenant_by_id(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    return tenant


@router.post("/{tenant_id}/approve", response_model=TenantResponse)
async def approve_tenant_registration(
    tenant_id: int,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    审核通过组织注册
    
    将组织状态从 INACTIVE 改为 ACTIVE，允许组织使用系统。
    
    Args:
        tenant_id: 组织 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    
    # 获取组织
    tenant = await service.get_tenant_by_id(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    # 激活组织
    tenant = await service.activate_tenant(tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 审核通过组织: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.post("/{tenant_id}/reject", response_model=TenantResponse)
async def reject_tenant_registration(
    tenant_id: int,
    reason: Optional[str] = Query(None, description="拒绝原因"),
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    审核拒绝组织注册
    
    将组织状态设置为 SUSPENDED，拒绝组织注册。
    
    Args:
        tenant_id: 组织 ID
        reason: 拒绝原因（可选）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    
    # 获取组织
    tenant = await service.get_tenant_by_id(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    # 暂停组织（拒绝注册）
    tenant = await service.update_tenant(
        tenant_id,
        TenantUpdate(
            status=TenantStatus.SUSPENDED,
            settings={
                **tenant.settings,
                "rejection_reason": reason or "审核未通过",
                "rejected_by": current_admin.username,
                "rejected_at": str(now()),
            }
        ),
        skip_tenant_filter=True
    )
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 拒绝组织注册: {tenant.name} (ID: {tenant.id}), 原因: {reason}")
    
    return tenant


@router.post("/{tenant_id}/activate", response_model=TenantResponse)
async def activate_tenant_by_superadmin(
    tenant_id: int,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    激活组织（超级管理员）
    
    将组织状态设置为 ACTIVE。
    
    Args:
        tenant_id: 组织 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    tenant = await service.activate_tenant(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 激活组织: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.post("/{tenant_id}/deactivate", response_model=TenantResponse)
async def deactivate_tenant_by_superadmin(
    tenant_id: int,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    停用组织（超级管理员）
    
    将组织状态设置为 INACTIVE。
    
    Args:
        tenant_id: 组织 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    tenant = await service.deactivate_tenant(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 停用组织: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant_by_superadmin(
    data: TenantCreate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    创建组织（平台超级管理员）
    
    创建新组织并保存到数据库。如果域名已存在，则抛出异常。
    
    Args:
        data: 组织创建数据
        current_admin: 当前平台超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 创建的组织
        
    Raises:
        HTTPException: 当域名已存在时抛出
    """
    service = TenantService()
    
    # ⚠️ 第三阶段改进：统一错误处理
    # 异常由全局异常处理中间件统一处理
    tenant = await service.create_tenant(data)
    logger.info(f"平台超级管理员 {current_admin.username} 创建组织: {tenant.name} (ID: {tenant.id})")
    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant_by_superadmin(
    tenant_id: int,
    data: TenantUpdate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    更新组织（平台超级管理员）
    
    更新组织信息。所有字段都是可选的，只更新提供的字段。
    
    Args:
        tenant_id: 组织 ID
        data: 组织更新数据
        current_admin: 当前平台超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的组织
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    
    tenant = await service.update_tenant(tenant_id, data, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 更新组织: {tenant.name} (ID: {tenant.id})")
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_by_superadmin(
    tenant_id: int,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    删除组织（平台超级管理员，软删除）
    
    将组织状态设置为 SUSPENDED，而不是真正删除数据。
    
    Args:
        tenant_id: 组织 ID
        current_admin: 当前平台超级管理员（依赖注入）
        
    Raises:
        HTTPException: 当组织不存在时抛出
    """
    service = TenantService()
    success = await service.delete_tenant(tenant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="组织不存在"
        )
    
    logger.info(f"平台超级管理员 {current_admin.username} 删除组织: ID {tenant_id}")

