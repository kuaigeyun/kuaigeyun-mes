"""
角色服务实现

将静态方法类 RoleService 适配为 RoleServiceInterface 接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from core.services.interfaces.service_interface import RoleServiceInterface
from core.services.authorization.role_service import RoleService


class RoleServiceImpl(RoleServiceInterface):
    """
    角色服务实现类
    
    将 RoleService 的静态方法适配为接口实现。
    """
    
    @property
    def service_name(self) -> str:
        return "role_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "role_service",
            "version": self.service_version
        }
    
    async def create_role(
        self,
        tenant_id: int,
        data: Any,
        current_user_id: int
    ) -> Any:
        """创建角色"""
        return await RoleService.create_role(
            tenant_id=tenant_id,
            data=data,
            current_user_id=current_user_id
        )
    
    async def get_role_by_uuid(
        self,
        tenant_id: int,
        uuid: str
    ) -> Any:
        """根据UUID获取角色"""
        return await RoleService.get_role_by_uuid(
            tenant_id=tenant_id,
            role_uuid=uuid
        )
    
    async def get_role_list(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        name: Optional[str] = None,
        code: Optional[str] = None,
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """获取角色列表"""
        return await RoleService.get_role_list(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            keyword=keyword,
            name=name,
            code=code,
            current_user_id=current_user_id
        )

