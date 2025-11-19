"""
超级管理员租户管理 API 模块

提供超级管理员对租户的管理接口，包括租户注册审核、启用/禁用等
"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Depends, status
from loguru import logger

from schemas.tenant import TenantResponse, TenantListResponse, TenantUpdate
from services.tenant_service import TenantService
from models.tenant import TenantStatus, TenantPlan
from api.deps import get_current_superadmin
from models.user import User

# 创建路由
router = APIRouter(prefix="/superadmin/tenants", tags=["SuperAdmin Tenants"])


@router.get("", response_model=TenantListResponse)
async def list_tenants_for_superadmin(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    status: Optional[TenantStatus] = Query(None, description="租户状态筛选"),
    plan: Optional[TenantPlan] = Query(None, description="租户套餐筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索（租户名称、域名）"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    获取租户列表（超级管理员）
    
    超级管理员可以查看所有租户，支持分页、状态筛选、套餐筛选、关键词搜索。
    
    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        status: 租户状态筛选（可选）
        plan: 租户套餐筛选（可选）
        keyword: 关键词搜索（可选，搜索租户名称、域名）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantListResponse: 租户列表响应
    """
    service = TenantService()
    
    # 构建查询（超级管理员可以跨租户访问）
    result = await service.list_tenants(
        page=page,
        page_size=page_size,
        status=status,
        plan=plan,
        skip_tenant_filter=True  # ⭐ 关键：跳过租户过滤
    )
    
    # 关键词搜索（如果提供）
    if keyword:
        from tortoise import Q
        from models.tenant import Tenant
        
        # 重新查询并添加关键词过滤
        query = Tenant.all()
        query = query.filter(
            Q(name__icontains=keyword) | Q(domain__icontains=keyword)
        )
        
        # 添加状态和套餐筛选
        if status:
            query = query.filter(status=status)
        if plan:
            query = query.filter(plan=plan)
        
        total = await query.count()
        offset = (page - 1) * page_size
        items = await query.offset(offset).limit(page_size).all()
        
        result = {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    return TenantListResponse(**result)


@router.post("/{tenant_id}/approve", response_model=TenantResponse)
async def approve_tenant_registration(
    tenant_id: int,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    审核通过租户注册
    
    将租户状态从 INACTIVE 改为 ACTIVE，允许租户使用系统。
    
    Args:
        tenant_id: 租户 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的租户
        
    Raises:
        HTTPException: 当租户不存在时抛出
    """
    service = TenantService()
    
    # 获取租户
    tenant = await service.get_tenant_by_id(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    # 激活租户
    tenant = await service.activate_tenant(tenant_id)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    logger.info(f"超级管理员 {current_admin.username} 审核通过租户: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.post("/{tenant_id}/reject", response_model=TenantResponse)
async def reject_tenant_registration(
    tenant_id: int,
    reason: Optional[str] = Query(None, description="拒绝原因"),
    current_admin: User = Depends(get_current_superadmin)
):
    """
    审核拒绝租户注册
    
    将租户状态设置为 SUSPENDED，拒绝租户注册。
    
    Args:
        tenant_id: 租户 ID
        reason: 拒绝原因（可选）
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的租户
        
    Raises:
        HTTPException: 当租户不存在时抛出
    """
    service = TenantService()
    
    # 获取租户
    tenant = await service.get_tenant_by_id(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    # 暂停租户（拒绝注册）
    from schemas.tenant import TenantUpdate
    tenant = await service.update_tenant(
        tenant_id,
        TenantUpdate(
            status=TenantStatus.SUSPENDED,
            settings={
                **tenant.settings,
                "rejection_reason": reason or "审核未通过",
                "rejected_by": current_admin.username,
                "rejected_at": str(datetime.utcnow()),
            }
        ),
        skip_tenant_filter=True
    )
    
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    logger.info(f"超级管理员 {current_admin.username} 拒绝租户注册: {tenant.name} (ID: {tenant.id}), 原因: {reason}")
    
    return tenant


@router.post("/{tenant_id}/activate", response_model=TenantResponse)
async def activate_tenant_by_superadmin(
    tenant_id: int,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    激活租户（超级管理员）
    
    将租户状态设置为 ACTIVE。
    
    Args:
        tenant_id: 租户 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的租户
        
    Raises:
        HTTPException: 当租户不存在时抛出
    """
    service = TenantService()
    tenant = await service.activate_tenant(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    logger.info(f"超级管理员 {current_admin.username} 激活租户: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.post("/{tenant_id}/deactivate", response_model=TenantResponse)
async def deactivate_tenant_by_superadmin(
    tenant_id: int,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    停用租户（超级管理员）
    
    将租户状态设置为 INACTIVE。
    
    Args:
        tenant_id: 租户 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Returns:
        TenantResponse: 更新后的租户
        
    Raises:
        HTTPException: 当租户不存在时抛出
    """
    service = TenantService()
    tenant = await service.deactivate_tenant(tenant_id, skip_tenant_filter=True)
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    logger.info(f"超级管理员 {current_admin.username} 停用租户: {tenant.name} (ID: {tenant.id})")
    
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant_by_superadmin(
    tenant_id: int,
    current_admin: User = Depends(get_current_superadmin)
):
    """
    删除租户（超级管理员，软删除）
    
    将租户状态设置为 SUSPENDED，而不是真正删除数据。
    
    Args:
        tenant_id: 租户 ID
        current_admin: 当前超级管理员（依赖注入）
        
    Raises:
        HTTPException: 当租户不存在时抛出
    """
    service = TenantService()
    success = await service.delete_tenant(tenant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="租户不存在"
        )
    
    logger.info(f"超级管理员 {current_admin.username} 删除租户: ID {tenant_id}")

