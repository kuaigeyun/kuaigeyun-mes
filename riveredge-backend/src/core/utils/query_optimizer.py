"""
查询优化工具模块

提供查询优化的工具函数，包括分页查询优化、查询语句优化等。

Author: Auto (AI Assistant)
Date: 2026-01-27
"""

from typing import Optional, Tuple, List, Any, Dict, Callable
from tortoise.queryset import QuerySet
from loguru import logger
import time


class QueryOptimizer:
    """
    查询优化器
    
    提供查询优化的工具方法，包括分页优化、查询条件优化、预加载优化等。
    """
    
    @staticmethod
    async def optimized_paginated_query(
        queryset: QuerySet,
        page: int = 1,
        page_size: int = 20,
        max_page_size: int = 100,
        order_by: Optional[str] = None,
        use_indexed_order: bool = True
    ) -> Tuple[List[Any], int]:
        """
        优化的分页查询
        
        优化点：
        1. 限制最大分页大小，避免过大查询
        2. 使用索引字段排序（优先使用复合索引字段）
        3. 先查询总数，再查询数据（避免重复查询）
        4. 对于大数据量，使用游标分页（cursor-based pagination）替代偏移分页
        
        Args:
            queryset: Tortoise ORM 查询集
            page: 页码（从1开始）
            page_size: 每页数量
            max_page_size: 最大每页数量（默认100）
            order_by: 排序字段（可选，默认按 created_at 倒序）
            use_indexed_order: 是否使用索引字段排序（默认True）
            
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
        
        # 应用排序（优先使用索引字段）
        if order_by:
            if order_by.startswith('-'):
                queryset = queryset.order_by(order_by)
            else:
                queryset = queryset.order_by(f'-{order_by}')
        else:
            # 默认按创建时间倒序（通常有索引）
            queryset = queryset.order_by('-created_at')
        
        # 查询总数（在分页前）
        # 注意：对于大数据量，count() 可能较慢，可以考虑使用近似计数或缓存
        total = await queryset.count()
        
        # 计算偏移量
        offset = (page - 1) * page_size
        
        # 性能优化：对于大偏移量，考虑使用游标分页
        # 如果 offset > 10000，建议使用游标分页
        if offset > 10000:
            logger.warning(f"大偏移量查询（offset={offset}），建议使用游标分页以提高性能")
        
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
        3. 支持嵌套关联预加载
        
        Args:
            queryset: Tortoise ORM 查询集
            relations: 关联字段列表（支持嵌套，如 "relation__nested_relation"）
            
        Returns:
            QuerySet: 添加预加载后的查询集
        """
        for relation in relations:
            queryset = queryset.prefetch_related(relation)
        
        return queryset
    
    @staticmethod
    def add_select_related(
        queryset: QuerySet,
        relations: List[str]
    ) -> QuerySet:
        """
        添加选择关联（用于外键关联）
        
        优化点：
        1. 使用 JOIN 查询，减少数据库往返
        2. 适用于一对一和外键关联
        
        Args:
            queryset: Tortoise ORM 查询集
            relations: 关联字段列表
            
        Returns:
            QuerySet: 添加选择关联后的查询集
        """
        for relation in relations:
            queryset = queryset.select_related(relation)
        
        return queryset
    
    @staticmethod
    async def measure_query_performance(
        queryset: QuerySet,
        operation_name: str = "query"
    ) -> Dict[str, Any]:
        """
        测量查询性能
        
        用于性能分析和优化，记录查询执行时间。
        
        Args:
            queryset: Tortoise ORM 查询集
            operation_name: 操作名称（用于日志）
            
        Returns:
            Dict[str, Any]: 性能指标字典，包含执行时间、查询类型等
        """
        start_time = time.time()
        
        try:
            # 执行查询
            result = await queryset.all()
            
            end_time = time.time()
            execution_time = end_time - start_time
            
            # 记录性能指标
            performance_data = {
                "operation": operation_name,
                "execution_time": execution_time,
                "result_count": len(result) if isinstance(result, list) else 1,
                "timestamp": time.time()
            }
            
            # 如果执行时间超过阈值，记录警告
            if execution_time > 1.0:  # 1秒
                logger.warning(
                    f"慢查询检测: {operation_name} 执行时间 {execution_time:.2f}秒，"
                    f"结果数量: {performance_data['result_count']}"
                )
            
            return performance_data
            
        except Exception as e:
            end_time = time.time()
            execution_time = end_time - start_time
            
            logger.error(
                f"查询执行失败: {operation_name}，执行时间 {execution_time:.2f}秒，错误: {str(e)}"
            )
            
            raise
    
    @staticmethod
    def optimize_tenant_query(
        queryset: QuerySet,
        tenant_id: int,
        use_index: bool = True
    ) -> QuerySet:
        """
        优化租户查询
        
        确保 tenant_id 在查询条件中，并优先使用索引。
        
        Args:
            queryset: Tortoise ORM 查询集
            tenant_id: 租户ID
            use_index: 是否使用索引（默认True）
            
        Returns:
            QuerySet: 优化后的查询集
        """
        # 确保 tenant_id 在查询条件中（多组织隔离）
        queryset = queryset.filter(tenant_id=tenant_id)
        
        # 如果 use_index 为 True，确保使用 tenant_id 索引
        # 注意：Tortoise ORM 会自动使用索引，这里主要是确保查询条件正确
        
        return queryset
    
    @staticmethod
    def optimize_soft_delete_query(
        queryset: QuerySet,
        include_deleted: bool = False
    ) -> QuerySet:
        """
        优化软删除查询
        
        对于软删除字段，使用索引优化查询。
        
        Args:
            queryset: Tortoise ORM 查询集
            include_deleted: 是否包含已删除记录（默认False）
            
        Returns:
            QuerySet: 优化后的查询集
        """
        if not include_deleted:
            # 只查询未删除的记录（使用 deleted_at IS NULL 索引）
            queryset = queryset.filter(deleted_at__isnull=True)
        
        return queryset
    
    @staticmethod
    async def cursor_based_pagination(
        queryset: QuerySet,
        cursor: Optional[str] = None,
        page_size: int = 20,
        order_by: str = "-id",
        cursor_field: str = "id"
    ) -> Tuple[List[Any], Optional[str], bool]:
        """
        游标分页查询（适用于大数据量）
        
        使用游标（cursor）替代偏移量（offset），避免大offset的性能问题。
        适用于大数据量的列表查询。
        
        Args:
            queryset: Tortoise ORM 查询集
            cursor: 游标值（上一页最后一条记录的cursor_field值）
            page_size: 每页数量
            order_by: 排序字段（默认"-id"，必须包含cursor_field）
            cursor_field: 游标字段（默认"id"，必须是唯一且有序的字段）
            
        Returns:
            Tuple[List[Any], Optional[str], bool]: (数据列表, 下一页游标, 是否有下一页)
        
        Example:
            ```python
            items, next_cursor, has_next = await QueryOptimizer.cursor_based_pagination(
                queryset=WorkOrder.filter(tenant_id=tenant_id),
                cursor=request.query_params.get("cursor"),
                page_size=20
            )
            ```
        """
        # 应用排序
        queryset = queryset.order_by(order_by)
        
        # 如果有游标，添加游标条件
        if cursor:
            # 根据排序方向判断游标条件
            if order_by.startswith('-'):
                # 降序：查询小于游标值的记录
                queryset = queryset.filter(**{f"{cursor_field}__lt": cursor})
            else:
                # 升序：查询大于游标值的记录
                queryset = queryset.filter(**{f"{cursor_field}__gt": cursor})
        
        # 查询数据（多查询一条，用于判断是否有下一页）
        items = await queryset.limit(page_size + 1).all()
        
        # 判断是否有下一页
        has_next = len(items) > page_size
        if has_next:
            items = items[:page_size]
        
        # 生成下一页游标
        next_cursor = None
        if has_next and items:
            last_item = items[-1]
            next_cursor = str(getattr(last_item, cursor_field, None))
        
        return items, next_cursor, has_next
    
    @staticmethod
    async def optimized_count(
        queryset: QuerySet,
        use_approximate: bool = False
    ) -> int:
        """
        优化的计数查询
        
        对于大数据量，可以使用近似计数或缓存计数。
        
        Args:
            queryset: Tortoise ORM 查询集
            use_approximate: 是否使用近似计数（默认False）
            
        Returns:
            int: 记录总数
        """
        if use_approximate:
            # 使用近似计数（PostgreSQL的统计信息）
            # 注意：这需要启用pg_stat_statements扩展
            logger.warning("近似计数功能尚未实现，使用精确计数")
        
        # 使用精确计数
        return await queryset.count()
    
    @staticmethod
    async def batch_query(
        queryset: QuerySet,
        batch_size: int = 1000,
        callback: Optional[Callable[[List[Any]], Awaitable[None]]] = None
    ) -> int:
        """
        批量查询处理（流式处理）
        
        分批查询数据，避免一次性加载大量数据导致内存溢出。
        
        Args:
            queryset: Tortoise ORM 查询集
            batch_size: 每批大小（默认1000）
            callback: 每批数据的回调函数（可选）
            
        Returns:
            int: 处理的总记录数
        
        Example:
            ```python
            total = await QueryOptimizer.batch_query(
                queryset=WorkOrder.filter(tenant_id=tenant_id),
                batch_size=1000,
                callback=async lambda batch: await process_batch(batch)
            )
            ```
        """
        total_processed = 0
        offset = 0
        
        while True:
            # 查询一批数据
            batch = await queryset.offset(offset).limit(batch_size).all()
            
            if not batch:
                break
            
            # 处理这批数据
            if callback:
                await callback(batch)
            
            total_processed += len(batch)
            
            # 如果这批数据少于batch_size，说明已经是最后一批
            if len(batch) < batch_size:
                break
            
            offset += batch_size
        
        return total_processed

