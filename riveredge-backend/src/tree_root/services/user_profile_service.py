"""
个人资料管理服务模块

提供个人资料的查询和更新功能。
"""

from typing import Optional
from uuid import UUID

from soil.models.user import User
from tree_root.schemas.user_profile import UserProfileUpdate, UserProfileResponse
from soil.exceptions.exceptions import NotFoundError


class UserProfileService:
    """
    个人资料管理服务类
    
    提供个人资料的查询和更新功能。
    """
    
    @staticmethod
    async def get_user_profile(
        user_uuid: str
    ) -> UserProfileResponse:
        """
        获取个人资料
        
        Args:
            user_uuid: 用户UUID
            
        Returns:
            UserProfileResponse: 个人资料对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
        """
        user = await User.filter(uuid=user_uuid).first()
        
        if not user:
            raise NotFoundError("用户不存在")
        
        return UserProfileResponse.model_validate(user)
    
    @staticmethod
    async def update_user_profile(
        user_uuid: str,
        data: UserProfileUpdate
    ) -> UserProfileResponse:
        """
        更新个人资料
        
        Args:
            user_uuid: 用户UUID
            data: 个人资料更新数据
            
        Returns:
            UserProfileResponse: 更新后的个人资料对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
        """
        user = await User.filter(uuid=user_uuid).first()
        
        if not user:
            raise NotFoundError("用户不存在")
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await user.save()
        return UserProfileResponse.model_validate(user)

