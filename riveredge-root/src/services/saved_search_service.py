"""
保存搜索条件服务模块

提供保存搜索条件的业务逻辑处理
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import HTTPException, status

from models.saved_search import SavedSearch
from models.user import User
from core.tenant_context import get_current_tenant_id


class SavedSearchService:
    """
    保存搜索条件服务类
    
    提供保存搜索条件的 CRUD 操作和业务逻辑处理。
    """

    async def create_saved_search(
        self,
        user: User,
        page_path: str,
        name: str,
        search_params: Dict[str, Any],
        is_shared: bool = False
    ) -> SavedSearch:
        """
        创建保存搜索条件
        
        创建新的搜索条件，支持个人和共享两种类型。
        
        Args:
            user: 当前用户对象
            page_path: 页面路径
            name: 搜索条件名称
            search_params: 搜索参数（JSON 格式）
            is_shared: 是否共享（默认 False）
            
        Returns:
            SavedSearch: 创建的搜索条件对象
            
        Raises:
            HTTPException: 当搜索条件名称重复时抛出
        """
        tenant_id = get_current_tenant_id() or user.tenant_id
        
        # 检查同一用户在同一页面是否已有重名的搜索条件
        existing = await SavedSearch.get_or_none(
            user_id=user.id,
            page_path=page_path,
            name=name
        )
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"搜索条件名称 '{name}' 已存在，请使用其他名称"
            )
        
        # 创建搜索条件
        saved_search = await SavedSearch.create(
            tenant_id=tenant_id,
            user_id=user.id,
            page_path=page_path,
            name=name,
            is_shared=is_shared,
            search_params=search_params
        )
        
        return saved_search

    async def list_saved_searches(
        self,
        user: User,
        page_path: str,
        include_shared: bool = True
    ) -> List[SavedSearch]:
        """
        获取保存的搜索条件列表
        
        获取当前用户在指定页面的搜索条件，包括个人和共享的。
        
        Args:
            user: 当前用户对象
            page_path: 页面路径
            include_shared: 是否包含共享搜索条件（默认 True）
            
        Returns:
            List[SavedSearch]: 搜索条件列表
        """
        tenant_id = get_current_tenant_id() or user.tenant_id
        
        # 构建查询条件
        from tortoise.expressions import Q
        
        query = Q(page_path=page_path)
        
        if include_shared:
            # 包含：1) 个人搜索条件（user_id = 当前用户） 2) 共享搜索条件（is_shared = True 且 tenant_id 匹配）
            query = query & (
                Q(user_id=user.id) | 
                (Q(is_shared=True) & Q(tenant_id=tenant_id))
            )
        else:
            # 只包含个人搜索条件
            query = query & Q(user_id=user.id)
        
        # 查询并排序（按更新时间倒序）
        saved_searches = await SavedSearch.filter(query).order_by("-updated_at").all()
        
        return saved_searches

    async def get_saved_search(
        self,
        user: User,
        search_id: int
    ) -> SavedSearch:
        """
        获取单个保存的搜索条件
        
        获取指定 ID 的搜索条件，只能获取自己的或共享的。
        
        Args:
            user: 当前用户对象
            search_id: 搜索条件 ID
            
        Returns:
            SavedSearch: 搜索条件对象
            
        Raises:
            HTTPException: 当搜索条件不存在或无权访问时抛出
        """
        tenant_id = get_current_tenant_id() or user.tenant_id
        
        saved_search = await SavedSearch.get_or_none(id=search_id)
        
        if not saved_search:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="搜索条件不存在"
            )
        
        # 检查权限：只能访问自己的或共享的搜索条件
        if saved_search.user_id != user.id:
            if not saved_search.is_shared or saved_search.tenant_id != tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="无权访问此搜索条件"
                )
        
        return saved_search

    async def update_saved_search(
        self,
        user: User,
        search_id: int,
        name: Optional[str] = None,
        is_shared: Optional[bool] = None,
        search_params: Optional[Dict[str, Any]] = None
    ) -> SavedSearch:
        """
        更新保存的搜索条件
        
        只能更新自己创建的搜索条件。
        
        Args:
            user: 当前用户对象
            search_id: 搜索条件 ID
            name: 搜索条件名称（可选）
            is_shared: 是否共享（可选）
            search_params: 搜索参数（可选）
            
        Returns:
            SavedSearch: 更新后的搜索条件对象
            
        Raises:
            HTTPException: 当搜索条件不存在、无权访问或名称重复时抛出
        """
        saved_search = await self.get_saved_search(user, search_id)
        
        # 检查权限：只能更新自己创建的搜索条件
        if saved_search.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只能更新自己创建的搜索条件"
            )
        
        # 如果更新名称，检查是否重复
        if name and name != saved_search.name:
            existing = await SavedSearch.get_or_none(
                user_id=user.id,
                page_path=saved_search.page_path,
                name=name
            )
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"搜索条件名称 '{name}' 已存在，请使用其他名称"
                )
        
        # 更新字段
        if name is not None:
            saved_search.name = name
        if is_shared is not None:
            saved_search.is_shared = is_shared
        if search_params is not None:
            saved_search.search_params = search_params
        
        await saved_search.save()
        
        return saved_search

    async def delete_saved_search(
        self,
        user: User,
        search_id: int
    ) -> None:
        """
        删除保存的搜索条件
        
        只能删除自己创建的搜索条件。
        
        Args:
            user: 当前用户对象
            search_id: 搜索条件 ID
            
        Raises:
            HTTPException: 当搜索条件不存在或无权访问时抛出
        """
        saved_search = await self.get_saved_search(user, search_id)
        
        # 检查权限：只能删除自己创建的搜索条件
        if saved_search.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只能删除自己创建的搜索条件"
            )
        
        await saved_search.delete()

