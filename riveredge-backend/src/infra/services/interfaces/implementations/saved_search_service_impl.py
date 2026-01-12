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
    
    async def create_saved_search(self, data: Any, user_id: int = None, tenant_id: Optional[int] = None) -> Any:
        """创建保存的搜索条件"""
        # SavedSearchService.create_saved_search需要user_id和tenant_id参数
        # 如果方法参数中没有提供，尝试从data中获取
        if user_id is None:
            user_id = getattr(data, 'user_id', None)
        if tenant_id is None:
            tenant_id = getattr(data, 'tenant_id', None)
        
        if not user_id:
            # 如果仍然没有user_id，抛出错误
            raise ValueError("user_id is required")
        
        return await self._saved_search_service.create_saved_search(
            data=data,
            user_id=user_id,
            tenant_id=tenant_id
        )
    
    async def get_saved_search_by_uuid(self, uuid: str) -> Optional[Any]:
        """根据UUID获取保存的搜索条件"""
        # SavedSearchService.get_saved_search_by_uuid需要user_id参数
        # 这里需要从上下文获取user_id，实际使用时需要从依赖注入获取
        user_id = None  # 需要从上下文获取
        if user_id:
            return await self._saved_search_service.get_saved_search_by_uuid(uuid, user_id)
        return None
    
    async def update_saved_search(
        self,
        uuid: str,
        data: Any,
        user_id: int = None
    ) -> Optional[Any]:
        """更新保存的搜索条件"""
        # SavedSearchService.update_saved_search需要user_id参数
        # 如果方法参数中没有提供，尝试从data中获取
        if user_id is None:
            user_id = getattr(data, 'user_id', None)
        
        if not user_id:
            # 如果仍然没有user_id，抛出错误
            raise ValueError("user_id is required")
        
        return await self._saved_search_service.update_saved_search(uuid, data, user_id)
    
    async def delete_saved_search(self, uuid: str) -> bool:
        """删除保存的搜索条件"""
        # SavedSearchService.delete_saved_search需要user_id参数
        # 这里需要从上下文获取user_id，实际使用时需要从依赖注入获取
        user_id = None  # 需要从上下文获取
        if user_id:
            return await self._saved_search_service.delete_saved_search(uuid, user_id)
        return False

