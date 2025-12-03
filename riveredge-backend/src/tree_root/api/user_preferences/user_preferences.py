"""
用户偏好管理 API 路由

提供用户偏好的查询和更新功能。
"""

from fastapi import APIRouter, Depends, HTTPException, status

from tree_root.schemas.user_preference import UserPreferenceUpdate, UserPreferenceResponse
from tree_root.services.user_preference_service import UserPreferenceService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/user-preferences", tags=["UserPreferences"])


@router.get("", response_model=UserPreferenceResponse)
async def get_user_preference(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前用户偏好设置
    
    Returns:
        UserPreferenceResponse: 用户偏好对象
        
    Raises:
        HTTPException: 当用户偏好不存在时抛出
    """
    try:
        return await UserPreferenceService.get_user_preference(
            tenant_id=tenant_id,
            user_id=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("", response_model=UserPreferenceResponse)
async def update_user_preference(
    data: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新当前用户偏好设置
    
    Args:
        data: 用户偏好更新数据
        
    Returns:
        UserPreferenceResponse: 更新后的用户偏好对象
        
    Raises:
        HTTPException: 当用户偏好不存在时抛出
    """
    try:
        return await UserPreferenceService.update_user_preference(
            tenant_id=tenant_id,
            user_id=current_user.id,
            data=data
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

