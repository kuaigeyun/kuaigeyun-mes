"""
保存搜索条件服务模块

提供保存搜索条件的 CRUD 操作和业务逻辑处理
"""

from typing import Optional, Dict, Any, List

from tortoise.exceptions import DoesNotExist

from soil.models.saved_search import SavedSearch
from soil.schemas.saved_search import SavedSearchCreate, SavedSearchUpdate
from soil.core.tenant_context import get_current_tenant_id


class SavedSearchService:
    """
    保存搜索条件服务类
    
    提供保存搜索条件的 CRUD 操作和业务逻辑处理。
    注意：保存搜索条件需要用户上下文，支持多组织隔离。
    """
    
    async def create_saved_search(self, data: SavedSearchCreate, user_id: int, tenant_id: Optional[int] = None) -> SavedSearch:
        """
        创建保存搜索条件
        
        创建新保存搜索条件并保存到数据库。
        
        Args:
            data: 保存搜索条件创建数据
            user_id: 用户 ID（从上下文获取）
            tenant_id: 组织 ID（可选，从上下文获取）
            
        Returns:
            SavedSearch: 创建的保存搜索条件对象
            
        Example:
            >>> service = SavedSearchService()
            >>> saved_search = await service.create_saved_search(
            ...     SavedSearchCreate(
            ...         page_path="/platform/packages",
            ...         name="我的搜索",
            ...         search_params={"name": "test"}
            ...     ),
            ...     user_id=1,
            ...     tenant_id=1
            ... )
        """
        # 如果没有提供 tenant_id，从上下文获取
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        saved_search = await SavedSearch.create(
            tenant_id=tenant_id,
            user_id=user_id,
            page_path=data.page_path,
            name=data.name,
            is_shared=data.is_shared,
            is_pinned=data.is_pinned,
            search_params=data.search_params
        )
        return saved_search
    
    async def get_saved_search_by_uuid(self, uuid: str, user_id: int) -> Optional[SavedSearch]:
        """
        根据 UUID 获取保存搜索条件
        
        只能获取自己的或共享的搜索条件。
        
        Args:
            uuid: 搜索条件 UUID（业务ID）
            user_id: 用户 ID（用于权限验证）
            
        Returns:
            Optional[SavedSearch]: 保存搜索条件对象，如果不存在或无权访问则返回 None
        """
        saved_search = await SavedSearch.get_or_none(uuid=uuid)
        if not saved_search:
            return None
        
        # 权限检查：只能访问自己的或共享的搜索条件
        if saved_search.user_id != user_id and not saved_search.is_shared:
            return None
        
        return saved_search
    
    async def list_saved_searches(
        self,
        page_path: str,
        user_id: int,
        include_shared: bool = True,
        tenant_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取保存搜索条件列表
        
        获取指定页面的保存搜索条件列表，包括自己的和共享的（如果 include_shared=True）。
        
        Args:
            page_path: 页面路径
            user_id: 用户 ID（用于过滤）
            include_shared: 是否包含共享的搜索条件（默认 True）
            tenant_id: 组织 ID（可选，从上下文获取）
            
        Returns:
            dict: 包含 items、total 的字典
        """
        # 如果没有提供 tenant_id，从上下文获取
        if tenant_id is None:
            tenant_id = get_current_tenant_id()
        
        # 构建查询
        from tortoise.expressions import Q
        
        # 基础条件：页面路径匹配
        base_conditions = Q(page_path=page_path)
        
        # 用户条件：自己的搜索条件
        user_conditions = Q(user_id=user_id)
        
        # 如果包含共享的搜索条件，添加共享条件
        if include_shared:
            # 自己的或共享的搜索条件
            query = SavedSearch.filter(
                base_conditions & (user_conditions | Q(is_shared=True))
            )
        else:
            # 只查询自己的搜索条件
            query = SavedSearch.filter(
                base_conditions & user_conditions
            )
        
        # 应用组织过滤（如果 tenant_id 不为空）
        if tenant_id is not None:
            query = query.filter(tenant_id=tenant_id)
        
        # 获取总数
        total = await query.count()
        
        # 获取列表（按置顶和时间排序）
        items = await query.order_by('-is_pinned', '-created_at').all()
        
        return {
            'items': items,
            'total': total
        }
    
    async def update_saved_search(
        self,
        uuid: str,
        data: SavedSearchUpdate,
        user_id: int
    ) -> Optional[SavedSearch]:
        """
        更新保存搜索条件
        
        只能更新自己的搜索条件。
        
        Args:
            uuid: 搜索条件 UUID（业务ID）
            data: 保存搜索条件更新数据
            user_id: 用户 ID（用于权限验证）
            
        Returns:
            Optional[SavedSearch]: 更新后的保存搜索条件对象，如果不存在或无权访问则返回 None
        """
        saved_search = await SavedSearch.get_or_none(uuid=uuid)
        if not saved_search:
            return None
        
        # 权限检查：只能更新自己的搜索条件
        if saved_search.user_id != user_id:
            return None
        
        # 只更新提供的字段
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(saved_search, field, value)
        
        await saved_search.save()
        return saved_search
    
    async def delete_saved_search(self, uuid: str, user_id: int) -> bool:
        """
        删除保存搜索条件
        
        只能删除自己的搜索条件。
        
        Args:
            uuid: 搜索条件 UUID（业务ID）
            user_id: 用户 ID（用于权限验证）
            
        Returns:
            bool: 是否删除成功
        """
        saved_search = await SavedSearch.get_or_none(uuid=uuid)
        if not saved_search:
            return False
        
        # 权限检查：只能删除自己的搜索条件
        if saved_search.user_id != user_id:
            return False
        
        await saved_search.delete()
        return True

