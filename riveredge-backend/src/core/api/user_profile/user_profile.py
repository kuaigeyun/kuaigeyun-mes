"""
个人资料管理 API 路由

提供个人资料的查询和更新功能。
支持平台超级管理员 Token。
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.schemas.user_profile import UserProfileUpdate, UserProfileResponse
from core.services.user_profile_service import UserProfileService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/user-profile", tags=["UserProfile"])


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str = Field(..., description="当前密码")
    new_password: str = Field(..., min_length=6, description="新密码（至少6位）")


@router.get("", response_model=UserProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户个人资料
    
    支持平台超级管理员 Token：
    - 平台超级管理员使用独立的个人资料存储（存储在 InfraSuperAdmin 模型中）
    - 普通用户使用租户级个人资料存储（存储在 User 模型中）
    
    Args:
        current_user: 当前用户对象（可能是虚拟用户，如果是平台超级管理员）
        tenant_id: 当前组织ID（依赖注入，支持平台超级管理员）
    
    Returns:
        UserProfileResponse: 个人资料对象
        
    Raises:
        HTTPException: 当用户不存在时抛出
    """
    try:
        # 检查是否是平台超级管理员
        is_infra_superadmin = getattr(current_user, '_is_infra_superadmin', False)
        
        if is_infra_superadmin:
            # 平台超级管理员：使用独立的个人资料存储
            admin_id = getattr(current_user, '_infra_superadmin_id', current_user.id)
            return await UserProfileService.get_infra_superadmin_profile(admin_id)
        else:
            # 普通用户：直接使用当前用户的 UUID
            return await UserProfileService.get_user_profile(str(current_user.uuid))
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


@router.put("", response_model=UserProfileResponse)
async def update_user_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新当前用户个人资料
    
    支持平台超级管理员 Token：
    - 平台超级管理员使用独立的个人资料存储（存储在 InfraSuperAdmin 模型中）
    - 普通用户使用租户级个人资料存储（存储在 User 模型中）
    
    Args:
        data: 个人资料更新数据
        current_user: 当前用户对象（可能是虚拟用户，如果是平台超级管理员）
        tenant_id: 当前组织ID（依赖注入，支持平台超级管理员，用于文件管理）
        
    Returns:
        UserProfileResponse: 更新后的个人资料对象
        
    Raises:
        HTTPException: 当用户不存在时抛出
    """
    try:
        # 检查是否是平台超级管理员
        is_infra_superadmin = getattr(current_user, '_is_infra_superadmin', False)
        
        if is_infra_superadmin:
            # 平台超级管理员：使用独立的个人资料存储
            admin_id = getattr(current_user, '_infra_superadmin_id', current_user.id)
            return await UserProfileService.update_infra_superadmin_profile(
                admin_id,
                data,
                tenant_id=tenant_id
            )
        else:
            # 普通用户：直接使用当前用户的 UUID
            return await UserProfileService.update_user_profile(
                str(current_user.uuid),
                data,
                tenant_id=tenant_id
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


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    修改当前用户密码
    
    支持平台超级管理员 Token：
    - 平台超级管理员使用 InfraSuperAdmin 模型
    - 普通用户使用 User 模型
    
    Args:
        data: 密码修改数据（包含当前密码和新密码）
        current_user: 当前用户对象（可能是虚拟用户，如果是平台超级管理员）
        tenant_id: 当前组织ID（依赖注入，支持平台超级管理员）
        
    Returns:
        dict: 成功消息
        
    Raises:
        HTTPException: 当密码验证失败或用户不存在时抛出
    """
    try:
        # 检查是否是平台超级管理员
        is_infra_superadmin = getattr(current_user, '_is_infra_superadmin', False)
        
        if is_infra_superadmin:
            # 平台超级管理员：使用 InfraSuperAdmin 模型
            admin_id = getattr(current_user, '_infra_superadmin_id', current_user.id)
            admin = await InfraSuperAdmin.get_or_none(id=admin_id)
            
            if not admin:
                raise NotFoundError("平台超级管理员不存在")
            
            # 验证当前密码
            if not admin.verify_password(data.old_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="当前密码错误"
                )
            
            # 更新密码
            admin.password_hash = InfraSuperAdmin.hash_password(data.new_password)
            await admin.save()
        else:
            # 普通用户：使用 User 模型
            user = await User.filter(uuid=current_user.uuid).first()
            
            if not user:
                raise NotFoundError("用户不存在")
            
            # 验证当前密码
            if not user.verify_password(data.old_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="当前密码错误"
                )
            
            # 更新密码
            user.password_hash = User.hash_password(data.new_password)
            await user.save()
        
        return {"message": "密码修改成功"}
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

