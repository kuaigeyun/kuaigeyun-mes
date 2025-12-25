"""
个人资料管理服务模块

提供个人资料的查询和更新功能。
支持普通用户和平台超级管理员。
"""

from typing import Optional
from uuid import UUID

from infra.models.user import User
from infra.models.infra_superadmin import InfraSuperAdmin
from core.schemas.user_profile import UserProfileUpdate, UserProfileResponse
from core.services.file.file_service import FileService
from infra.exceptions.exceptions import NotFoundError, ValidationError, ValidationError


class UserProfileService:
    """
    个人资料管理服务类
    
    提供个人资料的查询和更新功能。
    支持普通用户和平台超级管理员。
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
    async def get_infra_superadmin_profile(
        admin_id: int
    ) -> UserProfileResponse:
        """
        获取平台超级管理员个人资料
        
        Args:
            admin_id: 平台超级管理员 ID
            
        Returns:
            UserProfileResponse: 个人资料对象
            
        Raises:
            NotFoundError: 当平台超级管理员不存在时抛出
        """
        admin = await InfraSuperAdmin.get_or_none(id=admin_id)
        
        if not admin:
            raise NotFoundError("平台超级管理员不存在")
        
        # 构建 UserProfileResponse（使用 admin.id 作为 uuid 的替代）
        # 注意：平台超级管理员没有 UUID，使用 id 转换为字符串
        from uuid import uuid5, NAMESPACE_DNS
        # 使用固定的命名空间和 admin.id 生成一个稳定的 UUID
        admin_uuid = uuid5(NAMESPACE_DNS, f"infra_superadmin_{admin.id}")
        
        return UserProfileResponse(
            uuid=admin_uuid,
            username=admin.username,
            email=admin.email,
            full_name=admin.full_name,
            phone=admin.phone,
            avatar=admin.avatar,
            bio=admin.bio,
            contact_info=admin.contact_info,
            gender=admin.gender
        )
    
    @staticmethod
    async def update_infra_superadmin_profile(
        admin_id: int,
        data: UserProfileUpdate,
        tenant_id: Optional[int] = None
    ) -> UserProfileResponse:
        """
        更新平台超级管理员个人资料
        
        Args:
            admin_id: 平台超级管理员 ID
            data: 个人资料更新数据
            tenant_id: 组织ID（可选，用于删除头像文件，平台超级管理员可能不需要）
            
        Returns:
            UserProfileResponse: 更新后的个人资料对象
            
        Raises:
            NotFoundError: 当平台超级管理员不存在时抛出
        """
        admin = await InfraSuperAdmin.get_or_none(id=admin_id)
        
        if not admin:
            raise NotFoundError("平台超级管理员不存在")
        
        # 记录旧的头像 UUID（如果存在）
        old_avatar_uuid = admin.avatar
        
        update_data = data.model_dump(exclude_unset=True)
        
        # 如果修改了用户名，检查全局是否已存在该用户名（排除当前管理员）
        # 平台超级管理员用户名全局唯一
        if 'username' in update_data:
            new_username = update_data.get('username')
            if new_username and new_username.strip():
                new_username = new_username.strip()
                # 检查全局是否已有其他平台超级管理员使用该用户名
                existing_admin = await InfraSuperAdmin.filter(
                    username=new_username
                ).exclude(id=admin.id).first()
                
                if existing_admin:
                    raise ValidationError(f"用户名 '{new_username}' 已被使用，请使用其他用户名")
        
        # 检测头像是否被删除（从有值变为 None 或空字符串）
        avatar_deleted = False
        if 'avatar' in update_data:
            new_avatar = update_data.get('avatar')
            if old_avatar_uuid and (new_avatar is None or new_avatar == ''):
                avatar_deleted = True
        
        # 更新字段：将空字符串转换为 None，确保数据库字段能正确更新
        for key, value in update_data.items():
            # 如果值是空字符串，转换为 None（数据库字段允许 null）
            if isinstance(value, str) and value.strip() == '':
                setattr(admin, key, None)
            else:
                setattr(admin, key, value)
        
        await admin.save()
        
        # 如果头像被删除，异步清理文件管理中的文件
        # 注意：平台超级管理员的文件可能需要特殊处理，这里暂时使用 tenant_id（如果提供）
        if avatar_deleted and old_avatar_uuid and tenant_id:
            import asyncio
            asyncio.create_task(
                UserProfileService._cleanup_avatar_file(
                    tenant_id=tenant_id,
                    file_uuid=old_avatar_uuid
                )
            )
        
        # 构建响应
        from uuid import uuid5, NAMESPACE_DNS
        admin_uuid = uuid5(NAMESPACE_DNS, f"infra_superadmin_{admin.id}")
        
        return UserProfileResponse(
            uuid=admin_uuid,
            username=admin.username,
            email=admin.email,
            full_name=admin.full_name,
            phone=admin.phone,
            avatar=admin.avatar,
            bio=admin.bio,
            contact_info=admin.contact_info,
            gender=admin.gender
        )
    
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
        
        # 如果修改了用户名，检查同一租户内是否已存在该用户名（排除当前用户）
        if 'username' in update_data:
            new_username = update_data.get('username')
            if new_username and new_username.strip():
                new_username = new_username.strip()
                # 检查同一租户内是否已有其他用户使用该用户名
                existing_user = await User.filter(
                    tenant_id=user.tenant_id,
                    username=new_username,
                    deleted_at__isnull=True
                ).exclude(id=user.id).first()
                
                if existing_user:
                    raise ValidationError(f"用户名 '{new_username}' 在同一组织内已存在，请使用其他用户名")
        
        # 检测头像是否被删除（从有值变为 None 或空字符串）
        avatar_deleted = False
        if 'avatar' in update_data:
            new_avatar = update_data.get('avatar')
            if old_avatar_uuid and (new_avatar is None or new_avatar == ''):
                avatar_deleted = True
        
        # 处理字段更新：将空字符串转换为 None，确保数据库字段能正确更新
        for key, value in update_data.items():
            # 如果值是空字符串，转换为 None（数据库字段允许 null）
            if isinstance(value, str) and value.strip() == '':
                setattr(user, key, None)
            else:
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

