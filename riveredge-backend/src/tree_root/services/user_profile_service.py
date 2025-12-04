"""
个人资料管理服务模块

提供个人资料的查询和更新功能。
"""

from typing import Optional
from uuid import UUID

from soil.models.user import User
from tree_root.schemas.user_profile import UserProfileUpdate, UserProfileResponse
from tree_root.services.file_service import FileService
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
        data: UserProfileUpdate,
        tenant_id: Optional[int] = None
    ) -> UserProfileResponse:
        """
        更新个人资料
        
        Args:
            user_uuid: 用户UUID
            data: 个人资料更新数据
            tenant_id: 组织ID（可选，用于删除头像文件）
            
        Returns:
            UserProfileResponse: 更新后的个人资料对象
            
        Raises:
            NotFoundError: 当用户不存在时抛出
        """
        user = await User.filter(uuid=user_uuid).first()
        
        if not user:
            raise NotFoundError("用户不存在")
        
        # 记录旧的头像 UUID（如果存在）
        old_avatar_uuid = user.avatar
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 检测头像是否被删除（从有值变为 None 或空字符串）
        avatar_deleted = False
        if 'avatar' in update_data:
            new_avatar = update_data.get('avatar')
            if old_avatar_uuid and (new_avatar is None or new_avatar == ''):
                avatar_deleted = True
        
        for key, value in update_data.items():
            setattr(user, key, value)
        
        await user.save()
        
        # 如果头像被删除，异步清理文件管理中的文件
        if avatar_deleted and old_avatar_uuid and tenant_id:
            import asyncio
            asyncio.create_task(
                UserProfileService._cleanup_avatar_file(
                    tenant_id=tenant_id,
                    file_uuid=old_avatar_uuid
                )
            )
        
        return UserProfileResponse.model_validate(user)
    
    @staticmethod
    async def _cleanup_avatar_file(
        tenant_id: int,
        file_uuid: str
    ) -> None:
        """
        清理头像文件（异步）
        
        Args:
            tenant_id: 组织ID
            file_uuid: 文件UUID
        """
        try:
            await FileService.delete_file(
                tenant_id=tenant_id,
                uuid=file_uuid
            )
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"用户头像文件已删除: {file_uuid}")
        except NotFoundError:
            # 文件不存在，忽略
            pass
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"删除用户头像文件失败: {str(e)}")

