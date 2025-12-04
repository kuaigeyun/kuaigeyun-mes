"""
套餐管理 API 模块

提供套餐管理的 RESTful API 接口
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status
from loguru import logger

from infra.schemas.package import PackageResponse, PackageListResponse, PackageCreate, PackageUpdate
from infra.services.package_service import PackageService
from infra.models.tenant import TenantPlan
from infra.models.platform_superadmin import PlatformSuperAdmin
from infra.api.deps.deps import get_current_platform_superadmin
from infra.domain.package_config import get_package_config, get_all_package_configs
from typing import Dict, Any

# 创建路由 - 测试专用，只包含公开接口
router = APIRouter(prefix="/packages", tags=["Platform Packages"])


@router.get("/config", response_model=Dict[str, Any])
async def get_all_package_configs_endpoint():
    """
    获取所有套餐配置（公开接口）
    
    返回所有套餐类型的配置信息，包括用户数限制、存储空间限制等。
    套餐配置是静态配置信息，不需要认证。
    
    Returns:
        Dict[str, Any]: 所有套餐配置字典
    """
    from loguru import logger
    from fastapi import Request
    logger.info("📦 [get_all_package_configs_endpoint] 开始处理请求（无需认证）")
    try:
        result = get_all_package_configs()
        logger.info(f"✅ [get_all_package_configs_endpoint] 成功返回套餐配置，套餐数量: {len(result)}")
        return result
    except Exception as e:
        logger.error(f"❌ [get_all_package_configs_endpoint] 处理失败: {e}")
        raise


@router.get("/{plan}/config", response_model=Dict[str, Any])
async def get_package_config_by_plan(
    plan: TenantPlan,
):
    """
    获取指定套餐配置（公开接口）
    
    返回指定套餐类型的配置信息。
    套餐配置是静态配置信息，不需要认证。
    
    Args:
        plan: 套餐类型
        
    Returns:
        Dict[str, Any]: 套餐配置字典
        
    Raises:
        HTTPException: 当套餐类型不存在时抛出
    """
    try:
        return get_package_config(plan)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("", response_model=PackageListResponse)
async def list_packages(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    pageSize: int = Query(None, ge=1, le=100, description="每页数量（兼容前端）"),
    plan: Optional[TenantPlan] = Query(None, description="套餐类型筛选"),
    name: Optional[str] = Query(None, description="套餐名称搜索（模糊搜索）"),
    is_active: Optional[bool] = Query(None, description="是否激活筛选"),
    allow_pro_apps: Optional[bool] = Query(None, description="是否允许PRO应用筛选"),
    sort: Optional[str] = Query(None, description="排序字段（如：name、plan、created_at、max_users）"),
    order: Optional[str] = Query(None, description="排序顺序（asc 或 desc）"),
):
    """
    获取套餐列表（平台超级管理员）

    平台超级管理员可以查看所有套餐，支持分页、筛选、搜索和排序。

    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        pageSize: 每页数量（兼容前端参数名）
        plan: 套餐类型筛选（可选，精确匹配）
        name: 套餐名称搜索（可选，模糊搜索）
        is_active: 是否激活筛选（可选，精确匹配）
        allow_pro_apps: 是否允许PRO应用筛选（可选，精确匹配）
        sort: 排序字段（可选，如：name、plan、created_at、max_users）
        order: 排序顺序（可选，asc 或 desc）
        current_admin: 当前平台超级管理员（依赖注入）

    Returns:
        PackageListResponse: 套餐列表响应
    """
    service = PackageService()

    # 处理参数兼容性：优先使用 pageSize（前端发送的参数），否则使用 page_size
    actual_page_size = pageSize if pageSize is not None else page_size

    result = await service.list_packages(
        page=page,
        page_size=actual_page_size,
        plan=plan,
        name=name,
        is_active=is_active,
        allow_pro_apps=allow_pro_apps,
        sort=sort,
        order=order
    )

    # 将 Package 模型对象转换为 PackageResponse schema 对象
    package_responses = [
        PackageResponse.model_validate(package) 
        for package in result['items']
    ]

    return PackageListResponse(
        items=package_responses,
        total=result['total'],
        page=result['page'],
        page_size=result['page_size']
    )


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package_detail(
    package_id: int,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    获取套餐详情（超级管理员）

    超级管理员可以查看任意套餐的详细信息。

    Args:
        package_id: 套餐 ID
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        PackageResponse: 套餐详情

    Raises:
        HTTPException: 当套餐不存在时抛出
    """
    service = PackageService()
    package = await service.get_package_by_id(package_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="套餐不存在"
        )

    return package


@router.post("", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
async def create_package(
    data: PackageCreate,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    创建套餐（超级管理员）

    创建新套餐并保存到数据库。

    Args:
        data: 套餐创建数据
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        PackageResponse: 创建的套餐

    Raises:
        HTTPException: 当套餐类型已存在时抛出
    """
    service = PackageService()
    try:
        package = await service.create_package(data)
        logger.info(f"创建套餐: {package.name} (ID: {package.id})")
        return package
    except Exception as e:
        logger.error(f"创建套餐失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"创建套餐失败: {str(e)}"
        )


@router.put("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    data: PackageUpdate,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    更新套餐（超级管理员）

    更新套餐信息。

    Args:
        package_id: 套餐 ID
        data: 套餐更新数据
        current_admin: 当前超级管理员（依赖注入）

    Returns:
        PackageResponse: 更新后的套餐

    Raises:
        HTTPException: 当套餐不存在时抛出
    """
    service = PackageService()
    package = await service.update_package(package_id, data)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="套餐不存在"
        )

    logger.info(f"平台超级管理员 {current_admin.username} 更新套餐: {package.name} (ID: {package.id})")
    return package


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: int,
    current_admin: PlatformSuperAdmin = Depends(get_current_platform_superadmin)
):
    """
    删除套餐（超级管理员）

    删除套餐。

    Args:
        package_id: 套餐 ID
        current_admin: 当前超级管理员（依赖注入）

    Raises:
        HTTPException: 当套餐不存在时抛出
    """
    service = PackageService()
    success = await service.delete_package(package_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="套餐不存在"
        )

    logger.info(f"平台超级管理员 {current_admin.username} 删除套餐: ID {package_id}")

