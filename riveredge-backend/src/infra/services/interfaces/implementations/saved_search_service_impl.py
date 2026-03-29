"""
保存搜索服务实现

将SavedSearchService适配为SavedSearchServiceInterface接口实现。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Any, Dict, Optional
from infra.services.interfaces.service_interface import SavedSearchServiceInterface
from infra.services.saved_search_service import SavedSearchService


class SavedSearchServiceImpl(SavedSearchServiceInterface):
    """
    保存搜索服务实现类
    
    将 SavedSearchService 适配为接口实现。
    """
    
    def __init__(self):
        self._saved_search_service = SavedSearchService()
    
    @property
    def service_name(self) -> str:
        return "saved_search_service"
    
    @property
    def service_version(self) -> str:
        return "1.0.0"
    
    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "status": "healthy",
            "service": "saved_search_service",
            "version": self.service_version
        }
    
    async def list_saved_searches(
        self,
        page: int = 1,
        page_size: int = 10,
        **kwargs
    ) -> Dict[str, Any]:
        """获取保存的搜索条件列表"""
        # SavedSearchService.list_saved_searches需要page_path和user_id参数
        page_path = kwargs.get('page_path', '')
        user_id = kwargs.get('user_id')
        include_shared = kwargs.get('include_shared', True)
        tenant_id = kwargs.get('tenant_id')
        
        if not page_path or not user_id:
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size
            }
        
        return await self._saved_search_service.list_saved_searches(
            page_path=page_path,
            user_id=user_id,
            include_shared=include_shared,
            tenant_id=tenant_id
        )
    
    async def create_saved_search(self, data: Any, user_id: int, tenant_id: Optional[int] = None) -> Any:
        """创建保存的搜索条件"""
        return await self._saved_search_service.create_saved_search(
            data=data,
            user_id=user_id,
            tenant_id=tenant_id
        )
    
    async def get_saved_search_by_uuid(self, uuid: str, user_id: int) -> Optional[Any]:
        """根据UUID获取保存的搜索条件"""
        return await self._saved_search_service.get_saved_search_by_uuid(uuid, user_id)
    
    async def update_saved_search(
        self,
        uuid: str,
        data: Any,
        user_id: int
    ) -> Optional[Any]:
        """更新保存的搜索条件"""
        return await self._saved_search_service.update_saved_search(uuid, data, user_id)
    
    async def delete_saved_search(self, uuid: str, user_id: int) -> bool:
        """删除保存的搜索条件"""
        return await self._saved_search_service.delete_saved_search(uuid, user_id)

