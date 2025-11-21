"""
查询过滤器模块

实现自动组织过滤的查询构建器，确保所有查询自动包含组织隔离
"""

from typing import Optional, TypeVar, Generic
from tortoise.models import Model
from tortoise.queryset import QuerySet

from core.tenant_context import get_current_tenant_id, require_tenant_context

# 定义泛型类型变量
T = TypeVar("T", bound=Model)


class TenantQuerySet(Generic[T]):
    """
    组织查询集包装器
    
    自动为所有查询添加组织过滤条件，确保数据隔离。
    支持超级管理员跨组织访问（通过 skip_tenant_filter 参数）。
    
    Attributes:
        model: 数据模型类
        tenant_id: 组织 ID（可选，默认从上下文获取）
        skip_tenant_filter: 是否跳过组织过滤（超级管理员使用）
    """
    
    def __init__(
        self,
        model: type[T],
        tenant_id: Optional[int] = None,
        skip_tenant_filter: bool = False
    ):
        """
        初始化组织查询集
        
        Args:
            model: 数据模型类
            tenant_id: 组织 ID（可选，默认从上下文获取）
            skip_tenant_filter: 是否跳过组织过滤（超级管理员使用）
        """
        self.model = model
        self.tenant_id = tenant_id
        self.skip_tenant_filter = skip_tenant_filter
    
    def _get_tenant_id(self) -> Optional[int]:
        """
        获取组织 ID
        
        优先使用传入的 tenant_id，否则从上下文获取。
        如果 skip_tenant_filter 为 True，则返回 None（不过滤）。
        
        Returns:
            Optional[int]: 组织 ID，如果跳过过滤则返回 None
        """
        if self.skip_tenant_filter:
            return None
        if self.tenant_id is not None:
            return self.tenant_id
        return get_current_tenant_id()
    
    def filter(self, **kwargs) -> QuerySet[T]:
        """
        添加过滤条件
        
        自动添加组织过滤条件（除非 skip_tenant_filter 为 True）。
        
        Args:
            **kwargs: 过滤条件
            
        Returns:
            QuerySet[T]: Tortoise ORM 查询集
        """
        query = self.model.filter(**kwargs)
        
        # 自动添加组织过滤条件
        tenant_id = self._get_tenant_id()
        if tenant_id is not None:
            query = query.filter(tenant_id=tenant_id)
        
        return query
    
    def all(self) -> QuerySet[T]:
        """
        获取所有记录（自动组织过滤）
        
        Returns:
            QuerySet[T]: Tortoise ORM 查询集
        """
        query = self.model.all()
        
        # 自动添加组织过滤条件
        tenant_id = self._get_tenant_id()
        if tenant_id is not None:
            query = query.filter(tenant_id=tenant_id)
        
        return query
    
    def get(self, **kwargs):
        """
        获取单条记录（自动组织过滤）
        
        Args:
            **kwargs: 查询条件
            
        Returns:
            T: 模型实例
            
        Raises:
            DoesNotExist: 当记录不存在时抛出
        """
        tenant_id = self._get_tenant_id()
        if tenant_id is not None:
            kwargs["tenant_id"] = tenant_id
        
        return self.model.get(**kwargs)
    
    def get_or_none(self, **kwargs):
        """
        获取单条记录或 None（自动组织过滤）
        
        Args:
            **kwargs: 查询条件
            
        Returns:
            Optional[T]: 模型实例或 None
        """
        tenant_id = self._get_tenant_id()
        if tenant_id is not None:
            kwargs["tenant_id"] = tenant_id
        
        return self.model.get_or_none(**kwargs)
    
    def create(self, **kwargs):
        """
        创建记录（自动设置 tenant_id）
        
        Args:
            **kwargs: 创建数据
            
        Returns:
            T: 创建的模型实例
        """
        # 自动设置 tenant_id（如果未提供且未跳过过滤）
        if "tenant_id" not in kwargs:
            tenant_id = self._get_tenant_id()
            if tenant_id is not None:
                kwargs["tenant_id"] = tenant_id
        
        return self.model.create(**kwargs)
    
    def count(self) -> int:
        """
        统计记录数量（自动组织过滤）
        
        Returns:
            int: 记录数量
        """
        query = self.all()
        return query.count()


def get_tenant_queryset(
    model: type[T],
    tenant_id: Optional[int] = None,
    skip_tenant_filter: bool = False
) -> TenantQuerySet[T]:
    """
    获取组织查询集
    
    便捷函数，用于创建组织查询集实例。
    
    Args:
        model: 数据模型类
        tenant_id: 组织 ID（可选，默认从上下文获取）
        skip_tenant_filter: 是否跳过组织过滤（超级管理员使用）
        
    Returns:
        TenantQuerySet[T]: 组织查询集实例
        
    Example:
        >>> from models.user import User
        >>> queryset = get_tenant_queryset(User)
        >>> users = await queryset.filter(is_active=True).all()
    """
    return TenantQuerySet(model, tenant_id=tenant_id, skip_tenant_filter=skip_tenant_filter)


async def require_tenant_for_query() -> int:
    """
    要求必须有组织上下文才能执行查询
    
    用于需要组织隔离的查询场景。
    
    Returns:
        int: 当前组织 ID
        
    Raises:
        ValueError: 当组织上下文未设置时抛出
        
    Example:
        >>> tenant_id = await require_tenant_for_query()
        >>> users = await User.filter(tenant_id=tenant_id).all()
    """
    return await require_tenant_context()

