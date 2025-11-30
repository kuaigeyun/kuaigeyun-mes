"""
平台超级管理员管理 API 模块

提供平台超级管理员管理相关的 RESTful API 接口
"""

from fastapi import APIRouter, Depends, HTTPException, status

from soil.schemas.platform_superadmin import (
    PlatformSuperAdminCreate,
    PlatformSuperAdminUpdate,
    PlatformSuperAdminResponse
)
from soil.services.platform_superadmin_service import PlatformSuperAdminService
from soil.api.deps.deps import get_current_platform_superadmin
from soil.models.platform_superadmin import PlatformSuperAdmin

# 创建路由
router = APIRouter(prefix="/admin", tags=["Platform Admin"])


@router.get("", response_model=PlatformSuperAdminResponse)
async def get_platform_superadmin(
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    获取平台超级管理员信息
    
    返回平台超级管理员信息。
    平台超级管理员是平台唯一的，只能有一个。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSuperAdminResponse: 平台超级管理员信息
    """
    return PlatformSuperAdminResponse.model_validate(current_admin)


@router.post("", response_model=PlatformSuperAdminResponse, status_code=status.HTTP_201_CREATED)
async def create_platform_superadmin(
    data: PlatformSuperAdminCreate,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
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
        PlatformSuperAdminResponse: 创建的平台超级管理员信息
        
    Raises:
        HTTPException: 当平台超级管理员已存在时抛出
    """
    service = PlatformSuperAdminService()
    admin = await service.create_platform_superadmin(data)
    
    return PlatformSuperAdminResponse.model_validate(admin)


@router.put("", response_model=PlatformSuperAdminResponse)
async def update_platform_superadmin(
    data: PlatformSuperAdminUpdate,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    更新平台超级管理员信息
    
    更新平台超级管理员的详细信息。只更新提供的字段。
    
    Args:
        data: 平台超级管理员更新数据
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        PlatformSuperAdminResponse: 更新后的平台超级管理员信息
        
    Raises:
        HTTPException: 当平台超级管理员不存在时抛出
    """
    service = PlatformSuperAdminService()
    admin = await service.update_platform_superadmin(data)
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="平台超级管理员不存在"
        )
    
    return PlatformSuperAdminResponse.model_validate(admin)

