"""
应用服务接口实现

实现应用服务接口，封装core层的ApplicationService，
为各层提供统一的接口调用方式。
"""

from typing import Dict, Any, Optional, List

from ..service_interface import ApplicationServiceInterface
from ..service_registry import service_implementation
from ...application.application_service import ApplicationService


@service_implementation(ApplicationServiceInterface)
class ApplicationServiceImpl(ApplicationServiceInterface):
    """
    应用服务实现类

    封装ApplicationService，提供统一的接口调用。
    """

    def __init__(self):
        self._application_service = ApplicationService()

    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "service": self.service_name,
            "version": self.service_version,
            "status": "healthy",
            "implementation": "ApplicationServiceImpl",
        }

    async def get_installed_applications(
        self,
        tenant_id: int,
        is_active: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        获取已安装的应用列表

        Args:
            tenant_id: 组织ID
            is_active: 是否启用过滤（可选）

        Returns:
            List[Dict[str, Any]]: 应用列表
        """
        return await self._application_service.get_installed_applications(
            tenant_id=tenant_id,
            is_active=is_active,
        )

    async def is_application_active(
        self,
        tenant_id: int,
        app_code: str,
    ) -> bool:
        """
        检查应用是否启用

        Args:
            tenant_id: 组织ID
            app_code: 应用代码

        Returns:
            bool: 是否启用
        """
        # 查询数据库检查应用状态
        from infra.infrastructure.database.database import get_db_connection

        conn = await get_db_connection()
        try:
            row = await conn.fetchrow("""
                SELECT is_active, is_installed
                FROM core_applications
                WHERE tenant_id = $1
                  AND code = $2
                  AND is_installed = TRUE
                  AND deleted_at IS NULL
            """, tenant_id, app_code)

            if row:
                return row['is_active']
            return False

        finally:
            await conn.close()
