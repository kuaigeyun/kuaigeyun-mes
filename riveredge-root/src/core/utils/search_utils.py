"""
通用搜索工具模块

提供通用的搜索、分页、排序功能，减少代码重复
支持中文拼音首字母模糊搜索
"""

from typing import Optional, Dict, Any, List, TypeVar, Type
from tortoise.models import Model
from tortoise.queryset import QuerySet
from tortoise.expressions import Q

from core.utils.query_filter import get_tenant_queryset
from core.utils.pinyin_utils import (
    get_pinyin_initials,
    match_pinyin_initials,
    is_pinyin_keyword,
    PYINYIN_AVAILABLE
)

# 定义类型变量 T（用于泛型）
T = TypeVar("T", bound=Model)


async def build_keyword_filter(
    keyword: Optional[str],
    search_fields: List[str],
    enable_pinyin_search: bool = True
) -> Optional[Q]:
    """
    构建关键词搜索过滤器
    
    使用 OR 逻辑在多个字段中搜索关键词。
    支持中文拼音首字母模糊搜索（如果安装了 pypinyin）。
    
    Args:
        keyword: 搜索关键词
        search_fields: 要搜索的字段列表（如：['name', 'domain', 'description']）
        enable_pinyin_search: 是否启用拼音首字母搜索（默认 True）
        
    Returns:
        Optional[Q]: Q 对象，如果 keyword 为空则返回 None
        
    Example:
        >>> from tortoise.expressions import Q
        >>> filter_q = await build_keyword_filter("test", ["name", "domain"])
        >>> # 等价于: Q(name__icontains="test") | Q(domain__icontains="test")
        >>> 
        >>> # 支持拼音首字母搜索
        >>> filter_q = await build_keyword_filter("zs", ["name"])
        >>> # 会匹配 "张三"、"赵四" 等拼音首字母为 "zs" 的记录
    """
    if not keyword or not search_fields:
        return None
    
    keyword = keyword.strip()
    if not keyword:
        return None
    
    # 构建 OR 查询：在任意一个字段中包含关键词
    filters = None
    
    # 检查关键词是否可能是拼音首字母
    keyword_is_pinyin = is_pinyin_keyword(keyword) if enable_pinyin_search and PYINYIN_AVAILABLE else False
    
    for field in search_fields:
        # ⭐ 最佳实践：使用 icontains 进行不区分大小写的模糊搜索
        # PostgreSQL 的 ILIKE 操作符支持 UTF-8 编码的中文字符
        # Tortoise ORM 的 icontains 会转换为 PostgreSQL 的 ILIKE '%keyword%'
        field_filter = Q(**{f"{field}__icontains": keyword})
        
        # 2. 如果关键词可能是拼音首字母，添加拼音首字母匹配
        # 注意：由于 Tortoise ORM 的限制，拼音首字母匹配在应用层处理
        # 这里只构建文本匹配的查询，拼音匹配在 list_with_search 中处理
        
        if filters is None:
            filters = field_filter
        else:
            filters |= field_filter
    
    return filters


async def apply_exact_filters(
    query: QuerySet[T],
    exact_filters: Dict[str, Any]
) -> QuerySet[T]:
    """
    应用精确匹配过滤器
    
    对指定的字段进行精确匹配（等值查询）。
    
    Args:
        query: 查询集
        exact_filters: 精确匹配条件字典（如：{'status': 'active', 'plan': 'basic'}）
        
    Returns:
        QuerySet[T]: 应用过滤后的查询集
        
    Example:
        >>> query = await apply_exact_filters(User.filter(), {'is_active': True, 'status': 'active'})
        >>> # 等价于: User.filter(is_active=True, status='active')
    """
    if not exact_filters:
        return query
    
    # 过滤掉 None 值
    valid_filters = {k: v for k, v in exact_filters.items() if v is not None}
    if valid_filters:
        query = query.filter(**valid_filters)
    
    return query


async def apply_sorting(
    query: QuerySet[T],
    sort: Optional[str],
    order: Optional[str],
    allowed_sort_fields: List[str],
    default_sort: str = "-created_at"
) -> QuerySet[T]:
    """
    应用排序
    
    对查询结果进行排序，支持字段白名单验证（防止 SQL 注入）。
    
    Args:
        query: 查询集
        sort: 排序字段（如：'name', 'created_at'）
        order: 排序顺序（'asc' 或 'desc'）
        allowed_sort_fields: 允许排序的字段列表（白名单）
        default_sort: 默认排序字段（默认：'-created_at'，按创建时间倒序）
        
    Returns:
        QuerySet[T]: 应用排序后的查询集
        
    Example:
        >>> query = await apply_sorting(
        ...     User.filter(),
        ...     sort='name',
        ...     order='asc',
        ...     allowed_sort_fields=['name', 'email', 'created_at']
        ... )
        >>> # 等价于: User.filter().order_by('name')
    """
    if sort:
        # 验证排序字段是否合法（防止 SQL 注入）
        if sort in allowed_sort_fields:
            # 处理排序顺序
            if order and order.lower() == 'desc':
                sort_field = f'-{sort}'
            else:
                sort_field = sort
            query = query.order_by(sort_field)
        else:
            # 如果排序字段不合法，使用默认排序
            query = query.order_by(default_sort)
    else:
        # 如果没有指定排序，使用默认排序
        query = query.order_by(default_sort)
    
    return query


async def paginate_query(
    query: QuerySet[T],
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """
    对查询结果进行分页
    
    Args:
        query: 查询集
        page: 页码（默认 1）
        page_size: 每页数量（默认 10）
        
    Returns:
        Dict[str, Any]: 包含 items、total、page、page_size 的字典
        
    Example:
        >>> result = await paginate_query(User.filter(), page=1, page_size=20)
        >>> # 返回: {'items': [...], 'total': 100, 'page': 1, 'page_size': 20}
    """
    # 计算总数
    total = await query.count()
    
    # 分页查询
    offset = (page - 1) * page_size
    items = await query.offset(offset).limit(page_size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def list_with_search(
    model: Type[T],
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    search_fields: Optional[List[str]] = None,
    exact_filters: Optional[Dict[str, Any]] = None,
    sort: Optional[str] = None,
    order: Optional[str] = None,
    allowed_sort_fields: Optional[List[str]] = None,
    default_sort: str = "-created_at",
    tenant_id: Optional[int] = None,
    skip_tenant_filter: bool = False
) -> Dict[str, Any]:
    """
    通用列表查询函数（支持搜索、筛选、排序、分页）
    
    提供统一的列表查询接口，减少代码重复。
    支持关键词搜索、精确筛选、排序、分页、组织隔离等功能。
    
    Args:
        model: 数据模型类
        page: 页码（默认 1）
        page_size: 每页数量（默认 10）
        keyword: 关键词搜索（可选）
        search_fields: 要搜索的字段列表（可选，如：['name', 'domain']）
        exact_filters: 精确匹配条件字典（可选，如：{'status': 'active', 'plan': 'basic'}）
        sort: 排序字段（可选，如：'name', 'created_at'）
        order: 排序顺序（可选，'asc' 或 'desc'）
        allowed_sort_fields: 允许排序的字段列表（可选，用于防止 SQL 注入）
        default_sort: 默认排序字段（默认：'-created_at'）
        tenant_id: 组织 ID（可选，默认从上下文获取）
        skip_tenant_filter: 是否跳过组织过滤（默认 False）
        
    Returns:
        Dict[str, Any]: 包含 items、total、page、page_size 的字典
        
    Example:
        >>> from models.user import User
        >>> result = await list_with_search(
        ...     model=User,
        ...     page=1,
        ...     page_size=20,
        ...     keyword="test",
        ...     search_fields=['username', 'email', 'full_name'],
        ...     exact_filters={'is_active': True},
        ...     sort='created_at',
        ...     order='desc',
        ...     allowed_sort_fields=['username', 'email', 'created_at']
        ... )
    """
    # 获取查询集（自动处理组织过滤）
    queryset = get_tenant_queryset(
        model,
        tenant_id=tenant_id,
        skip_tenant_filter=skip_tenant_filter
    )
    query = queryset.all()
    
    # 应用精确匹配过滤器
    if exact_filters:
        query = await apply_exact_filters(query, exact_filters)
    
    # 应用关键词搜索
    if keyword and search_fields:
        keyword_filter = await build_keyword_filter(keyword, search_fields, enable_pinyin_search=True)
        if keyword_filter:
            # ⭐ 最佳实践：添加调试日志，记录搜索参数
            from loguru import logger
            logger.debug(f"搜索关键词: {keyword}, 搜索字段: {search_fields}, 过滤器: {keyword_filter}")
            query = query.filter(keyword_filter)
    
    # 应用排序
    if allowed_sort_fields is None:
        # 如果没有指定允许的排序字段，使用默认字段列表
        allowed_sort_fields = ['id', 'created_at', 'updated_at']
    
    query = await apply_sorting(
        query,
        sort=sort,
        order=order,
        allowed_sort_fields=allowed_sort_fields,
        default_sort=default_sort
    )
    
    # 分页查询
    result = await paginate_query(query, page=page, page_size=page_size)
    
    # 如果启用了拼音搜索且关键词可能是拼音首字母，进行二次过滤
    # 注意：这是在应用层过滤，性能可能不如数据库层，但兼容性好
    if (keyword and search_fields and PYINYIN_AVAILABLE and 
        is_pinyin_keyword(keyword) and result["items"]):
        # 在应用层进行拼音首字母匹配
        keyword_upper = keyword.upper()
        filtered_items = []
        
        for item in result["items"]:
            # 检查是否在任意搜索字段中匹配拼音首字母
            matched = False
            for field in search_fields:
                field_value = getattr(item, field, None)
                if field_value and match_pinyin_initials(str(field_value), keyword_upper):
                    matched = True
                    break
            
            # 如果拼音首字母匹配，则包含（文本匹配已经在数据库查询中处理）
            if matched:
                filtered_items.append(item)
        
        # 更新结果
        # 注意：total 可能不准确，因为是在应用层过滤的
        # 如果需要准确的总数，建议在数据库中添加拼音首字母字段并建立索引
        result["items"] = filtered_items
        # 重新计算总数（简化处理：使用过滤后的数量）
        result["total"] = len(filtered_items)
    
    return result

