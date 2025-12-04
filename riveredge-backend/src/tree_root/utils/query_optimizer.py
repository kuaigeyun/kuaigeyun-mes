"""
查询优化工具模块

提供查询优化的工具函数，包括分页查询优化、查询语句优化等。
"""

from typing import Optional, Tuple, List, Any
from tortoise.queryset import QuerySet
from loguru import logger


class QueryOptimizer:
    """
    查询优化器
    
    提供查询优化的工具方法。
    """
    
    @staticmethod
    async def optimized_paginated_query(
        queryset: QuerySet,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100,
        order_by: Optional[str] = None
    ) -> Tuple[List[Any], int]:
        """
        优化的分页查询
        
        优化点：
        1. 限制最大分页大小，避免过大查询
        2. 使用索引字段排序
        3. 先查询总数，再查询数据（避免重复查询）
        
        Args:
            queryset: Tortoise ORM 查询集
            page: 页码（从1开始）
            page_size: 每页数量
            max_page_size: 最大每页数量（默认100）
            order_by: 排序字段（可选，默认按 created_at 倒序）
            
        Returns:
            Tuple[List[Any], int]: (数据列表, 总数)
        """
        # 限制分页大小
        if page_size > max_page_size:
            page_size = max_page_size
            logger.warning(f"分页大小超过最大值 {max_page_size}，已自动调整为 {max_page_size}")
        
        # 确保页码有效
        if page < 1:
            page = 1
        
        # 应用排序
        if order_by:
            if order_by.startswith('-'):
                queryset = queryset.order_by(order_by)
            else:
                queryset = queryset.order_by(f'-{order_by}')
        else:
            # 默认按创建时间倒序
            queryset = queryset.order_by('-created_at')
        
        # 查询总数（在分页前）
        total = await queryset.count()
        
        # 计算偏移量
        offset = (page - 1) * page_size
        
        # 分页查询
        items = await queryset.offset(offset).limit(page_size).all()
        
        return items, total
    
    @staticmethod
    def optimize_query_with_filters(
        queryset: QuerySet,
        tenant_id: int,
        filters: Optional[dict] = None,
        search_fields: Optional[List[str]] = None,
        search_keyword: Optional[str] = None
    ) -> QuerySet:
        """
        优化查询条件
        
        优化点：
        1. 确保 tenant_id 始终在查询条件中（多组织隔离）
        2. 优化搜索查询（使用索引字段）
        3. 优化筛选条件（使用索引字段）
        
        Args:
            queryset: Tortoise ORM 查询集
            tenant_id: 组织ID
            filters: 筛选条件字典
            search_fields: 搜索字段列表（用于模糊搜索）
            search_keyword: 搜索关键词
            
        Returns:
            QuerySet: 优化后的查询集
        """
        from tortoise.expressions import Q
        
        # 确保 tenant_id 在查询条件中
        if not hasattr(queryset, '_q'):
            queryset = queryset.filter(tenant_id=tenant_id)
        
        # 应用筛选条件
        if filters:
            for key, value in filters.items():
                if value is not None:
                    queryset = queryset.filter(**{key: value})
        
        # 应用搜索条件（使用 OR 查询，但限制在索引字段）
        if search_keyword and search_fields:
            search_query = Q()
            for field in search_fields:
                search_query |= Q(**{f"{field}__icontains": search_keyword})
            queryset = queryset.filter(search_query)
        
        return queryset
    
    @staticmethod
    def add_prefetch_related(
        queryset: QuerySet,
        relations: List[str]
    ) -> QuerySet:
        """
        添加预加载关联
        
        优化点：
        1. 避免 N+1 查询问题
        2. 一次性加载所有关联数据
        
        Args:
            queryset: Tortoise ORM 查询集
            relations: 关联字段列表
            
        Returns:
            QuerySet: 添加预加载后的查询集
        """
        for relation in relations:
            queryset = queryset.prefetch_related(relation)
        
        return queryset

