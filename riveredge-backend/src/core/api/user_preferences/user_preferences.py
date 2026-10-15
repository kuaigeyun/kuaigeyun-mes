"""
用户偏好管理 API 路由

提供用户偏好的查询和更新功能。
仅租户真实用户（core_users）可读写；平台超管 / 开放 API 虚拟身份不得写入。
"""

from fastapi import APIRouter, Depends, HTTPException, status

from core.schemas.user_preference import UserPreferenceUpdate, UserPreferenceResponse
from core.services.user.user_preference_service import UserPreferenceService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/user-preferences", tags=["Core - User Preferences"])


def _require_tenant_user_for_preferences(current_user: User) -> None:
    """个人偏好 FK 指向 core_users；虚拟身份不得冒用 admin_id / open_api 虚拟 id。"""
    if getattr(current_user, "_is_infra_superadmin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="平台超级管理员不是租户用户，不能读写个人偏好",
        )
    if getattr(current_user, "_is_open_api", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="开放 API 凭证不能读写个人偏好",
        )


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
    _require_tenant_user_for_preferences(current_user)
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
    _require_tenant_user_for_preferences(current_user)
    try:
        return await UserPreferenceService.update_user_preference(
            tenant_id=tenant_id,
            user_id=current_user.id,
            data=data
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

