"""
用户服务实现

将静态方法类 UserService 适配为 UserServiceInterface 接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from core.services.interfaces.service_interface import UserServiceInterface
from core.services.user.user_service import UserService


class UserServiceImpl(UserServiceInterface):
    """
    用户服务实现类
    
    将 UserService 的静态方法适配为接口实现。
    """
    
    @property
    def service_name(self) -> str:
        return "user_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "user_service",
            "version": self.service_version
        }
    
    async def create_user(
        self,
        tenant_id: int,
        data: Any,
        current_user_id: int
    ) -> Any:
        """创建用户"""
        return await UserService.create_user(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user_id
        )
    
    async def get_user_by_uuid(
        self,
        tenant_id: int,
        uuid: str
    ) -> Any:
        """根据UUID获取用户"""
        return await UserService.get_user_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
    
    async def get_user_list(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        department_uuid: Optional[str] = None,
        position_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_tenant_admin: Optional[bool] = None,
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """获取用户列表"""
        return await UserService.get_user_list(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            keyword=keyword,
            department_uuid=department_uuid,
            position_uuid=position_uuid,
            is_active=is_active,
            is_tenant_admin=is_tenant_admin,
            current_user_id=current_user_id
        )

