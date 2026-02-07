"""
用户管理 API 路由

提供用户的 CRUD 操作、导入导出和批量操作功能。
"""

import os
from typing import Optional, List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.schemas.user import (
    UserCreate,
    UserCreateRequest,
    UserUpdate,
    UserResponse,
    UserListResponse,
)
from core.services.user.user_service import UserService
from core.api.deps.deps import get_current_user, get_current_tenant
from core.api.deps.service_helpers import get_user_service_with_fallback
from core.services.interfaces.service_interface import UserServiceInterface
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError


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
    # 移除将由 extra_fields 传入的键，避免把 Tortoise 关联对象传入 Pydantic
    for key in extra_fields:
        obj_dict.pop(key, None)

    # 创建响应对象
    response = response_class(**obj_dict)

    # 设置额外字段
    for key, value in extra_fields.items():
        setattr(response, key, value)

    return response


async def _user_to_response(user) -> UserResponse:
    """
    将 User 模型转为 UserResponse，预加载并序列化 department、position、roles。
    避免直接把 Tortoise 关联对象传给 Pydantic 导致的 ValidationError。
    同时写入 department_uuid、position_uuid 供前端编辑表单回填。
    """
    await user.fetch_related("roles", "department", "position")
    department_data = None
    department_uuid = None
    if user.department:
        department_data = {
            "uuid": user.department.uuid,
            "name": user.department.name,
            "code": user.department.code,
        }
        department_uuid = user.department.uuid
    position_data = None
    position_uuid = None
    if user.position:
        position_data = {
            "uuid": user.position.uuid,
            "name": user.position.name,
            "code": user.position.code,
        }
        position_uuid = user.position.uuid
    roles_data = []
    if user.roles:
        roles_data = [
            {"uuid": r.uuid, "name": r.name, "code": r.code}
            for r in user.roles
        ]
    return model_to_response(
        user,
        UserResponse,
        department=department_data,
        department_uuid=department_uuid,
        position=position_data,
        position_uuid=position_uuid,
        roles=roles_data,
    )

router = APIRouter(prefix="/users", tags=["Core Users"])


class UserImportRequest(BaseModel):
    """
    用户导入请求 Schema
    
    接收前端 uni_import 组件传递的二维数组数据。
    """
    data: List[List[Any]] = Field(..., description="二维数组数据（第一行为表头，第二行为示例数据，从第三行开始为实际数据）")


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreateRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    user_service: Any = Depends(get_user_service_with_fallback),
):
    """
    创建用户
    
    创建新用户并保存到数据库。如果用户名已存在，则抛出异常。
    
    ⚠️ 第三阶段改进：使用依赖注入获取服务，支持向后兼容
    
    Args:
        data: 用户创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        user_service: 用户服务（依赖注入，如果未注册则回退到直接导入）
        
    Returns:
        UserResponse: 创建的用户对象
        
    Raises:
        HTTPException: 当用户名已存在时抛出
    """
    try:
        # 将请求数据转换为内部UserCreate对象，添加tenant_id
        user_create_data = UserCreate(
            username=data.username,
            email=data.email,
            password=data.password,
            full_name=data.full_name,
            phone=data.phone,
            tenant_id=tenant_id,  # 从依赖注入获取
            department_uuid=data.department_uuid,
            position_uuid=data.position_uuid,
            role_uuids=data.role_uuids,
            is_active=data.is_active if data.is_active is not None else True,
            is_tenant_admin=data.is_tenant_admin if data.is_tenant_admin is not None else False,
        )

        # ⚠️ 第三阶段改进：使用依赖注入的服务
        # user_service 可能是接口实现（实例）或类（回退情况）
        # 两种情况下调用方式相同（接口实现内部调用静态方法）
        user = await user_service.create_user(
            tenant_id=tenant_id,
            data=user_create_data,
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
async def get_user_list(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    username: Optional[str] = Query(None, description="用户名筛选"),
    email: Optional[str] = Query(None, description="邮箱筛选"),
    full_name: Optional[str] = Query(None, description="姓名筛选"),
    phone: Optional[str] = Query(None, description="手机号筛选"),
    department_uuid: Optional[str] = Query(None, description="部门UUID筛选"),
    position_uuid: Optional[str] = Query(None, description="职位UUID筛选"),
    is_active: Optional[bool] = Query(None, description="是否启用筛选"),
    is_tenant_admin: Optional[bool] = Query(None, description="是否组织管理员筛选"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    user_service: Any = Depends(get_user_service_with_fallback),  # ⚠️ 第三阶段改进：依赖注入
):
    """
    获取用户列表
    
    支持分页、关键词搜索和筛选。
    
    Args:
        page: 页码
        page_size: 每页数量
        keyword: 关键词搜索（搜索用户名、邮箱、姓名）
        department_uuid: 部门UUID筛选
        position_uuid: 职位UUID筛选
        is_active: 是否启用筛选
        is_tenant_admin: 是否组织管理员筛选
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        UserListResponse: 用户列表响应
    """
    # ⚠️ 关键修复：处理平台超级管理员的虚拟User对象
    current_user_id = None
    try:
        if hasattr(current_user, '_is_infra_superadmin') and getattr(current_user, '_is_infra_superadmin', False):
            # 平台超级管理员使用infra_superadmin_id
            current_user_id = getattr(current_user, '_infra_superadmin_id', None)
            if current_user_id is None:
                current_user_id = getattr(current_user, 'id', None)
        else:
            # 普通用户直接使用id
            current_user_id = getattr(current_user, 'id', None)
        
        # 如果仍然无法获取id，记录错误
        if current_user_id is None:
            from loguru import logger
            logger.error(f"❌ 无法获取 current_user_id，current_user 类型: {type(current_user)}, 属性: {dir(current_user)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="无法获取当前用户ID"
            )
    except HTTPException:
        raise
    except Exception as e:
        from loguru import logger
        logger.error(f"❌ 获取 current_user_id 时出错: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取当前用户ID失败: {str(e)}"
        )
    
    # ⚠️ 第三阶段改进：使用依赖注入的服务
    result = await user_service.get_user_list(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        keyword=keyword,
        username=username,
        email=email,
        full_name=full_name,
        phone=phone,
        department_uuid=department_uuid,
        position_uuid=position_uuid,
        is_active=is_active,
        is_tenant_admin=is_tenant_admin,
        current_user_id=current_user_id,
    )
    
    # 转换为响应格式
    from core.schemas.user import UserListItem
    items = [UserListItem.model_validate(item) for item in result["items"]]
    
    return UserListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


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
        return await _user_to_response(user)
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
        return await _user_to_response(user)
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

