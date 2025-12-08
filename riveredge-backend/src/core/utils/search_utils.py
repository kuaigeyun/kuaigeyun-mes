"""
搜索工具函数

提供通用的搜索功能，支持文本搜索和拼音首字母搜索。
"""

import re
from typing import Optional, List, Dict, Any, Type
from tortoise.models import Model
from tortoise.queryset import QuerySet
from tortoise.expressions import Q

try:
    from pypinyin import lazy_pinyin, Style
    PYPINYIN_AVAILABLE = True
except ImportError:
    PYPINYIN_AVAILABLE = False


def is_pinyin_keyword(keyword: str) -> bool:
    """
    判断关键词是否为拼音首字母格式
    
    Args:
        keyword: 搜索关键词
        
    Returns:
        bool: 是否为拼音首字母格式（全字母，1-10个字符）
        
    Example:
        >>> is_pinyin_keyword("ZS")
        True
        >>> is_pinyin_keyword("张三")
        False
        >>> is_pinyin_keyword("test123")
        False
    """
    if not keyword:
        return False
    # 判断是否为全字母且长度合理（1-10 个字符）
    return bool(re.match(r'^[a-zA-Z]{1,10}$', keyword))


def get_pinyin_initials(text: str) -> str:
    """
    获取中文文本的拼音首字母
    
    注意：此函数需要 pypinyin 库支持
    如果未安装 pypinyin，将返回空字符串
    
    Args:
        text: 中文文本
        
    Returns:
        str: 拼音首字母字符串（如："张三" -> "ZS"）
        
    Example:
        >>> get_pinyin_initials("张三")
        "ZS"
        >>> get_pinyin_initials("测试组织")
        "CSZZ"
    """
    if not text or not PYPINYIN_AVAILABLE:
        return ""
    
    try:
        # 使用 pypinyin 获取拼音首字母
        # lazy_pinyin 返回拼音列表，Style.FIRST_LETTER 获取首字母
        initials = lazy_pinyin(text, style=Style.FIRST_LETTER)
        # 合并首字母并转换为大写
        return ''.join(initials).upper()
    except Exception:
        return ""


def match_pinyin_initials(text: str, keyword: str) -> bool:
    """
    检查文本的拼音首字母是否匹配关键词
    
    Args:
        text: 要匹配的文本
        keyword: 搜索关键词（拼音首字母）
        
    Returns:
        bool: 是否匹配
        
    Example:
        >>> match_pinyin_initials("张三", "ZS")
        True
        >>> match_pinyin_initials("李四", "LS")
        True
        >>> match_pinyin_initials("王五", "WW")
        True
    """
    if not text or not keyword:
        return False
    
    # 获取文本的拼音首字母
    text_initials = get_pinyin_initials(text)
    if not text_initials:
        return False
    
    keyword_upper = keyword.upper()
    
    # 检查拼音首字母是否包含关键词
    return keyword_upper in text_initials


async def list_with_search(
    model: Type[Model],
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    search_fields: Optional[List[str]] = None,
    exact_filters: Optional[Dict[str, Any]] = None,
    allowed_sort_fields: Optional[List[str]] = None,
    default_sort: Optional[str] = None,
    tenant_id: Optional[int] = None,
    skip_tenant_filter: bool = False
) -> Dict[str, Any]:
    """
    通用列表查询函数，支持分页、关键词搜索（支持拼音首字母搜索）和筛选
    
    Args:
        model: Tortoise ORM 模型类
        page: 页码（默认 1）
        page_size: 每页数量（默认 10）
        keyword: 关键词搜索（可选，支持拼音首字母搜索）
        search_fields: 搜索字段列表（用于模糊搜索）
        exact_filters: 精确匹配筛选条件字典（可选）
        allowed_sort_fields: 允许排序的字段列表（可选）
        default_sort: 默认排序字段（可选，如 "-created_at"）
        tenant_id: 组织 ID（可选，用于多组织隔离）
        skip_tenant_filter: 是否跳过组织过滤（默认 False）
        
    Returns:
        Dict[str, Any]: 包含 items、total、page、page_size 的字典
        
    Example:
        >>> result = await list_with_search(
        ...     model=User,
        ...     page=1,
        ...     page_size=20,
        ...     keyword="test",
        ...     search_fields=['username', 'email', 'full_name']
        ... )
        >>> len(result["items"]) >= 0
        True
    """
    # 构建基础查询
    queryset = model.all()
    
    # 应用组织过滤（如果提供 tenant_id 且不跳过）
    if tenant_id and not skip_tenant_filter:
        queryset = queryset.filter(tenant_id=tenant_id)
    
    # 应用精确匹配筛选条件
    if exact_filters:
        for key, value in exact_filters.items():
            if value is not None:
                queryset = queryset.filter(**{key: value})
    
    # 应用搜索条件
    is_pinyin = keyword and is_pinyin_keyword(keyword)
    
    if keyword and search_fields:
        search_query = Q()
        
        if is_pinyin:
            # 拼音搜索：由于 PostgreSQL 不支持直接拼音搜索，
            # 我们先获取所有可能匹配的数据（放宽条件），然后在 Python 层面进行拼音过滤
            # 这里不添加搜索条件，让所有数据通过，后续在 Python 层面过滤
            pass
        else:
            # 普通文本搜索：使用数据库的模糊匹配
            for field in search_fields:
                search_query |= Q(**{f"{field}__icontains": keyword})
            queryset = queryset.filter(search_query)
    
    # 应用排序
    if default_sort:
        # 处理排序字段（支持 "-field" 格式表示降序）
        if default_sort.startswith('-'):
            sort_field = default_sort[1:]
            queryset = queryset.order_by(f"-{sort_field}")
        else:
            queryset = queryset.order_by(default_sort)
    
    # 如果关键词是拼音格式，需要先获取所有数据，然后在 Python 层面进行拼音过滤
    if is_pinyin and keyword:
        # 获取所有数据（不应用分页，因为需要先过滤）
        all_items = await queryset.all()
        
        # 在 Python 层面进行拼音过滤
        filtered_items = []
        keyword_upper = keyword.upper()
        
        for item in all_items:
            # 检查每个搜索字段
            for field in search_fields:
                # 获取字段值（支持嵌套字段）
                field_value = getattr(item, field, None)
                if field_value is None:
                    continue
                
                # 将字段值转换为字符串
                value_str = str(field_value)
                
                # 1. 文本匹配（作为备选）
                if keyword_upper in value_str.upper():
                    filtered_items.append(item)
                    break
                
                # 2. 拼音首字母匹配
                if match_pinyin_initials(value_str, keyword_upper):
                    filtered_items.append(item)
                    break
        
        # 计算过滤后的总数
        total = len(filtered_items)
        
        # 应用分页
        offset = (page - 1) * page_size
        items = filtered_items[offset:offset + page_size]
    else:
        # 普通搜索：使用数据库查询和分页
        total = await queryset.count()
        
        # 应用分页
        offset = (page - 1) * page_size
        items = await queryset.offset(offset).limit(page_size)
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size
    }

