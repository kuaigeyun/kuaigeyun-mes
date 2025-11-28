"""
组织上下文管理模块

使用 ContextVar 管理当前请求的组织上下文，实现多组织数据隔离
"""

from contextvars import ContextVar
from typing import Optional

# 组织上下文变量（使用 ContextVar 实现线程/协程级别的上下文隔离）
_tenant_context: ContextVar[Optional[int]] = ContextVar("tenant_context", default=None)


def get_current_tenant_id() -> Optional[int]:
    """
    获取当前请求的组织 ID
    
    从上下文变量中获取当前请求关联的组织 ID。
    如果未设置，则返回 None。
    
    Returns:
        Optional[int]: 当前组织 ID，如果未设置则返回 None
        
    Example:
        >>> tenant_id = get_current_tenant_id()
        >>> if tenant_id:
        ...     users = await User.filter(tenant_id=tenant_id).all()
    """
    return _tenant_context.get()


def set_current_tenant_id(tenant_id: Optional[int]) -> None:
    """
    设置当前请求的组织 ID
    
    将组织 ID 设置到上下文变量中，用于后续的数据库查询自动过滤。
    
    Args:
        tenant_id: 组织 ID，如果为 None 则清除当前组织上下文
        
    Example:
        >>> set_current_tenant_id(1)
        >>> tenant_id = get_current_tenant_id()  # 返回 1
    """
    _tenant_context.set(tenant_id)


def clear_tenant_context() -> None:
    """
    清除当前组织上下文
    
    将组织上下文设置为 None，用于清理上下文状态。
    """
    _tenant_context.set(None)


async def require_tenant_context() -> int:
    """
    要求必须有组织上下文
    
    获取当前组织 ID，如果未设置则抛出异常。
    用于需要组织上下文的场景（如业务数据查询）。
    
    Returns:
        int: 当前组织 ID
        
    Raises:
        ValueError: 当组织上下文未设置时抛出
        
    Example:
        >>> try:
        ...     tenant_id = await require_tenant_context()
        ...     users = await User.filter(tenant_id=tenant_id).all()
        ... except ValueError:
        ...     # 处理未设置组织上下文的情况
    """
    tenant_id = get_current_tenant_id()
    if tenant_id is None:
        raise ValueError("组织上下文未设置，无法执行需要组织隔离的操作")
    return tenant_id

