"""
个人资料管理 API 路由

提供个人资料的查询和更新功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status

from tree_root.schemas.user_profile import UserProfileUpdate, UserProfileResponse
from tree_root.services.user_profile_service import UserProfileService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/user-profile", tags=["UserProfile"])


@router.get("", response_model=UserProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    获取当前用户个人资料
    
    Returns:
        UserProfileResponse: 个人资料对象
        
    Raises:
        HTTPException: 当用户不存在时抛出
    """
    try:
        return await UserProfileService.get_user_profile(str(current_user.uuid))
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
    
    Args:
        data: 个人资料更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        UserProfileResponse: 更新后的个人资料对象
        
    Raises:
        HTTPException: 当用户不存在时抛出
    """
    try:
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

