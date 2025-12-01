"""
用户管理 API 路由

提供用户的 CRUD 操作、导入导出和批量操作功能。
"""

import os
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from tree_root.schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from tree_root.services.user_service import UserService
from tree_root.api.deps.deps import get_current_user, get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError


def model_to_response(model_obj, response_class, **extra_fields):
    """
    将模型对象转换为响应对象，自动排除id字段

    Args:
        model_obj: Tortoise模型实例
        response_class: 响应Schema类
        **extra_fields: 额外的字段

    Returns:
        响应对象实例
    """
    obj_dict = model_obj.__dict__.copy()
    # 移除内部ID字段，只保留UUID
    if 'id' in obj_dict:
        del obj_dict['id']

    # 创建响应对象
    response = response_class(**obj_dict)

    # 设置额外字段
    for key, value in extra_fields.items():
        setattr(response, key, value)

    return response

router = APIRouter(prefix="/users", tags=["System Users"])


class UserImportRequest(BaseModel):
    """
    用户导入请求 Schema
    
    接收前端 uni_import 组件传递的二维数组数据。
    """
    data: List[List[Any]] = Field(..., description="二维数组数据（第一行为表头，第二行为示例数据，从第三行开始为实际数据）")


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建用户
    
    创建新用户并保存到数据库。如果用户名已存在，则抛出异常。
    
    Args:
        data: 用户创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        UserResponse: 创建的用户对象
        
    Raises:
        HTTPException: 当用户名已存在时抛出
    """
    try:
        user = await UserService.create_user(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user.id
        )
        
        # 重新加载关联数据
        await user.fetch_related('roles', 'department', 'position')

        # 准备关联数据
        department_data = None
        if user.department:
            department_data = {
                "uuid": user.department.uuid,
                "name": user.department.name,
                "code": user.department.code
            }

        position_data = None
        if user.position:
            position_data = {
                "uuid": user.position.uuid,
                "name": user.position.name,
                "code": user.position.code
            }

        roles_data = []
        if user.roles:
            roles_data = [{
                "uuid": role.uuid,
                "name": role.name,
                "code": role.code
            } for role in user.roles]

        # 转换为响应格式
        return model_to_response(
            user, UserResponse,
            department=department_data,
            position=position_data,
            roles=roles_data
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthorizationError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.get("", response_model=UserListResponse)
async def get_user_list():
    """
    获取用户列表（简化测试版）
    """
    # 返回正确的Schema对象
    return UserListResponse(items=[], total=0, page=1, page_size=20)


@router.get("/{user_uuid}", response_model=UserResponse)
async def get_user_detail(
    user_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取用户详情
    
    根据用户UUID获取用户详细信息。
    
    Args:
        user_uuid: 用户UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        UserResponse: 用户详情响应数据
        
    Raises:
        HTTPException: 当用户不存在时抛出
    """
    try:
        user = await UserService.get_user_detail(
            tenant_id=tenant_id,
            user_uuid=user_uuid,
            current_user_id=current_user.id
        )
        
        return UserResponse.model_validate(user)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{user_uuid}", response_model=UserResponse)
async def update_user(
    user_uuid: str,
    data: UserUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新用户
    
    根据用户UUID更新用户信息。
    
    Args:
        user_uuid: 用户UUID
        data: 用户更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        UserResponse: 更新后的用户对象
        
    Raises:
        HTTPException: 当用户不存在或数据无效时抛出
    """
    try:
        user = await UserService.update_user(
            tenant_id=tenant_id,
            user_uuid=user_uuid,
            data=data,
            current_user_id=current_user.id
        )
        
        return UserResponse.model_validate(user)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.delete("/{user_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除用户（软删除）
    
    根据用户UUID删除用户。平台管理员和当前登录用户不可删除。
    
    Args:
        user_uuid: 用户UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当用户不存在或不可删除时抛出
    """
    try:
        await UserService.delete_user(
            tenant_id=tenant_id,
            user_uuid=user_uuid,
            current_user_id=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_users(
    request: UserImportRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量导入用户
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建用户。
    数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
    
    **前端实现**：使用 `uni_import` 组件（基于 Univer Sheet）进行数据编辑，确认后通过 `onConfirm` 回调传递二维数组数据。
    
    Args:
        request: 导入请求数据（包含二维数组）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 导入结果（成功数、失败数、错误列表）
        
    Raises:
        HTTPException: 当数据格式错误或导入失败时抛出
    """
    try:
        # 调用 Service 层进行批量导入
        result = await UserService.import_users_from_data(
            tenant_id=tenant_id,
            data=request.data,
            current_user_id=current_user.id
        )
        
        return result
                
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.get("/export", response_class=FileResponse)
async def export_users(
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    department_uuid: Optional[str] = Query(None, description="部门UUID筛选"),
    position_uuid: Optional[str] = Query(None, description="职位UUID筛选"),
    is_active: Optional[bool] = Query(None, description="是否激活筛选"),
    is_tenant_admin: Optional[bool] = Query(None, description="是否组织管理员筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导出用户到 Excel
    
    根据筛选条件导出用户列表到 Excel 文件。
    
    Args:
        keyword: 关键词搜索
        department_uuid: 部门UUID筛选
        position_uuid: 职位UUID筛选
        is_active: 是否激活筛选
        is_tenant_admin: 是否组织管理员筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: Excel 文件下载响应
        
    Raises:
        HTTPException: 当导出失败时抛出
    """
    try:
        # 导出用户
        file_path = await UserService.export_users_to_excel(
            tenant_id=tenant_id,
            keyword=keyword,
            department_uuid=department_uuid,
            position_uuid=position_uuid,
            is_active=is_active,
            is_tenant_admin=is_tenant_admin,
            current_user_id=current_user.id
        )
        
        # 生成文件名
        filename = os.path.basename(file_path)
        
        # 返回文件下载响应
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出失败: {str(e)}"
        )

