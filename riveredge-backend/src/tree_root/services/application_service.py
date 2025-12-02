"""
应用管理服务模块

提供应用的 CRUD 操作和安装/卸载功能。
"""

from typing import Optional, List
from uuid import UUID
from tortoise.exceptions import IntegrityError

from tree_root.models.application import Application
from tree_root.schemas.application import ApplicationCreate, ApplicationUpdate
from soil.exceptions.exceptions import NotFoundError, ValidationError


class ApplicationService:
    """
    应用管理服务类
    
    提供应用的 CRUD 操作和安装/卸载功能。
    """
    
    @staticmethod
    async def create_application(
        tenant_id: int,
        data: ApplicationCreate
    ) -> Application:
        """
        创建应用
        
        Args:
            tenant_id: 组织ID
            data: 应用创建数据
            
        Returns:
            Application: 创建的应用对象
            
        Raises:
            ValidationError: 当应用代码已存在时抛出
        """
        try:
            application = Application(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await application.save()
            return application
        except IntegrityError:
            raise ValidationError(f"应用代码 {data.code} 已存在")
    
    @staticmethod
    async def get_application_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Application:
        """
        根据UUID获取应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await Application.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not application:
            raise NotFoundError("应用不存在")
        
        return application
    
    @staticmethod
    async def get_application_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[Application]:
        """
        根据代码获取应用
        
        Args:
            tenant_id: 组织ID
            code: 应用代码
            
        Returns:
            Application: 应用对象，如果不存在返回 None
        """
        return await Application.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
    
    @staticmethod
    async def list_applications(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_installed: Optional[bool] = None,
        is_active: Optional[bool] = None
    ) -> List[Application]:
        """
        获取应用列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_installed: 是否已安装（可选）
            is_active: 是否启用（可选）
            
        Returns:
            List[Application]: 应用列表
        """
        query = Application.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_installed is not None:
            query = query.filter(is_installed=is_installed)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("sort_order", "id")
    
    @staticmethod
    async def update_application(
        tenant_id: int,
        uuid: str,
        data: ApplicationUpdate
    ) -> Application:
        """
        更新应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            data: 应用更新数据
            
        Returns:
            Application: 更新后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(application, key, value)
        
        await application.save()
        return application
    
    @staticmethod
    async def delete_application(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除应用（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_system:
            raise ValidationError("系统应用不可删除")
        
        # 软删除
        from datetime import datetime
        application.deleted_at = datetime.now()
        await application.save()
    
    @staticmethod
    async def install_application(
        tenant_id: int,
        uuid: str
    ) -> Application:
        """
        安装应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 安装后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用已安装时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_installed:
            raise ValidationError("应用已安装")
        
        application.is_installed = True
        await application.save()
        
        # 这里可以添加应用安装后的初始化逻辑
        # 例如：创建菜单、初始化数据等
        
        return application
    
    @staticmethod
    async def uninstall_application(
        tenant_id: int,
        uuid: str
    ) -> Application:
        """
        卸载应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 卸载后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
            ValidationError: 当应用是系统应用时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        
        if application.is_system:
            raise ValidationError("系统应用不可卸载")
        
        application.is_installed = False
        await application.save()
        
        # 这里可以添加应用卸载后的清理逻辑
        # 例如：删除菜单、清理数据等
        
        return application
    
    @staticmethod
    async def enable_application(
        tenant_id: int,
        uuid: str
    ) -> Application:
        """
        启用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 启用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        application.is_active = True
        await application.save()
        return application
    
    @staticmethod
    async def disable_application(
        tenant_id: int,
        uuid: str
    ) -> Application:
        """
        禁用应用
        
        Args:
            tenant_id: 组织ID
            uuid: 应用UUID
            
        Returns:
            Application: 禁用后的应用对象
            
        Raises:
            NotFoundError: 当应用不存在时抛出
        """
        application = await ApplicationService.get_application_by_uuid(tenant_id, uuid)
        application.is_active = False
        await application.save()
        return application
    
    @staticmethod
    async def get_installed_applications(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List[Application]:
        """
        获取已安装的应用列表
        
        Args:
            tenant_id: 组织ID
            is_active: 是否启用（可选）
            
        Returns:
            List[Application]: 已安装的应用列表
        """
        query = Application.filter(
            tenant_id=tenant_id,
            is_installed=True,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("sort_order", "id")

