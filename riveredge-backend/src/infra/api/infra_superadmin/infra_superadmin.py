"""
平台超级管理员管理 API 模块

提供平台超级管理员管理相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Depends, HTTPException, status

from infra.schemas.infra_superadmin import (
    InfraSuperAdminCreate,
    InfraSuperAdminUpdate,
    InfraSuperAdminResponse
)
from infra.services.infra_superadmin_service import InfraSuperAdminService
from infra.api.deps.services import get_infra_superadmin_service_with_fallback
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from typing import Any

# 创建路由
router = APIRouter(prefix="/admin", tags=["Infra Admin"])


@router.get("", response_model=InfraSuperAdminResponse)
async def get_infra_superadmin(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取平台超级管理员信息
    
    返回平台超级管理员信息。
    平台超级管理员是平台唯一的，只能有一个。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        InfraSuperAdminResponse: 平台超级管理员信息
    """
    return InfraSuperAdminResponse.model_validate(current_admin)


@router.post("", response_model=InfraSuperAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_infra_superadmin(
    data: InfraSuperAdminCreate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
    admin_service: Any = Depends(get_infra_superadmin_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    创建平台超级管理员
    
    创建平台超级管理员并保存到数据库。
    注意：平台超级管理员是平台唯一的，只能创建一个。
    如果已存在平台超级管理员，则抛出异常。
    
    此接口需要平台超级管理员权限（即当前用户必须是平台超级管理员）。
    
    Args:
        data: 平台超级管理员创建数据
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        InfraSuperAdminResponse: 创建的平台超级管理员信息
        
    Raises:
        HTTPException: 当平台超级管理员已存在时抛出
    """
    # ⚠️ 第三阶段改进：使用依赖注入的服务
    if not admin_service:
        admin_service = InfraSuperAdminService()  # 向后兼容
    # 优先使用接口方法名，如果不存在则使用原方法名（向后兼容）
    if hasattr(admin_service, 'create_admin'):
        admin = await admin_service.create_admin(data)
    elif hasattr(admin_service, 'create_infra_superadmin'):
        admin = await admin_service.create_infra_superadmin(data)
    else:
        # 如果都没有，说明是适配器，直接调用
        admin = await admin_service.create_admin(data)
    
    return InfraSuperAdminResponse.model_validate(admin)


@router.put("", response_model=InfraSuperAdminResponse)
async def update_infra_superadmin(
    data: InfraSuperAdminUpdate,
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin),
    admin_service: Any = Depends(get_infra_superadmin_service_with_fallback)  # ⚠️ 第三阶段改进：依赖注入
):
    """
    更新平台超级管理员信息
    
    更新平台超级管理员的详细信息。只更新提供的字段。
    
    Args:
        data: 平台超级管理员更新数据
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        InfraSuperAdminResponse: 更新后的平台超级管理员信息
        
    Raises:
        HTTPException: 当平台超级管理员不存在时抛出
    """
    # ⚠️ 第三阶段改进：使用依赖注入的服务
    if not admin_service:
        admin_service = InfraSuperAdminService()  # 向后兼容
    # 优先使用接口方法名，如果不存在则使用原方法名（向后兼容）
    if hasattr(admin_service, 'update_admin'):
        admin = await admin_service.update_admin(data)
    elif hasattr(admin_service, 'update_infra_superadmin'):
        admin = await admin_service.update_infra_superadmin(data)
    else:
        # 如果都没有，说明是适配器，直接调用
        admin = await admin_service.update_admin(data)
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="平台超级管理员不存在"
        )
    
    return InfraSuperAdminResponse.model_validate(admin)

