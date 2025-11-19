"""
用户管理 API 模块

提供用户管理的 RESTful API 接口
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status

from schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from services.user_service import UserService
from api.deps import get_current_user
from models.user import User
from core.tenant_context import get_current_tenant_id

# 创建路由
router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_user)
):
    """
    创建用户接口
    
    创建新用户并自动设置租户 ID。
    需要租户管理员或超级用户权限。
    
    Args:
        data: 用户创建数据（tenant_id 将从当前用户上下文自动获取，请求中的 tenant_id 将被忽略）
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        UserResponse: 创建的用户对象
        
    Raises:
        HTTPException: 当邮箱已存在或租户内用户名已存在时抛出
        
    Example:
        ```json
        {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "password123",
            "full_name": "新用户",
            "is_active": true,
            "is_superuser": false,
            "is_tenant_admin": false
        }
        ```
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动设置）⭐ 关键
    tenant_id = current_user.tenant_id
    
    # 创建用户数据副本，自动设置 tenant_id（忽略请求中的 tenant_id）
    from schemas.user import UserBase
    user_data = UserCreate(
        **data.model_dump(exclude={"tenant_id"}),
        tenant_id=tenant_id  # ⭐ 关键：自动设置当前用户的租户 ID
    )
    
    user = await service.create_user(user_data, tenant_id)
    return user


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索（用户名、邮箱、全名）"),
    is_active: Optional[bool] = Query(None, description="是否激活筛选"),
    current_user: User = Depends(get_current_user)
):
    """
    获取用户列表接口
    
    获取用户列表，支持分页、关键词搜索和状态筛选。
    自动过滤租户：只返回当前租户的用户。
    
    Args:
        page: 页码（默认 1）
        page_size: 每页数量（默认 10，最大 100）
        keyword: 关键词搜索（可选，搜索用户名、邮箱、全名）
        is_active: 是否激活筛选（可选）
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        UserListResponse: 用户列表响应数据
        
    Example:
        ```
        GET /api/v1/users?page=1&page_size=20&keyword=test&is_active=true
        ```
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动过滤）⭐ 关键
    tenant_id = current_user.tenant_id
    
    result = await service.list_users(
        page=page,
        page_size=page_size,
        keyword=keyword,
        is_active=is_active,
        tenant_id=tenant_id
    )
    
    return UserListResponse(**result)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    获取用户详情接口
    
    获取指定 ID 的用户信息，自动验证租户权限。
    
    Args:
        user_id: 用户 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        UserResponse: 用户详情
        
    Raises:
        HTTPException: 当用户不存在或不属于当前租户时抛出 404 错误
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    user = await service.get_user_by_id(user_id, tenant_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    更新用户接口
    
    更新用户信息，自动验证租户权限。
    
    Args:
        user_id: 用户 ID
        data: 用户更新数据
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        UserResponse: 更新后的用户对象
        
    Raises:
        HTTPException: 当用户不存在、不属于当前租户或数据冲突时抛出
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    user = await service.update_user(user_id, data, tenant_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    删除用户接口
    
    删除用户（软删除），自动验证租户权限。
    
    Args:
        user_id: 用户 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        None: 删除成功返回 204 状态码
        
    Raises:
        HTTPException: 当用户不存在或不属于当前租户时抛出 404 错误
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    success = await service.delete_user(user_id, tenant_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return None


@router.patch("/{user_id}/toggle-status", response_model=UserResponse)
async def toggle_user_status(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    切换用户状态接口
    
    切换用户的激活状态（激活/停用），自动验证租户权限。
    
    Args:
        user_id: 用户 ID
        current_user: 当前用户（依赖注入，自动从 Token 解析）
        
    Returns:
        UserResponse: 更新后的用户对象
        
    Raises:
        HTTPException: 当用户不存在或不属于当前租户时抛出 404 错误
    """
    service = UserService()
    
    # 从当前用户获取租户 ID（自动验证租户权限）⭐ 关键
    tenant_id = current_user.tenant_id
    
    user = await service.toggle_user_status(user_id, tenant_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return user

