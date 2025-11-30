"""
统一响应格式模块

提供统一的 API 响应格式
"""

from typing import Any, Optional, Dict, Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar('T')


class StandardResponse(BaseModel, Generic[T]):
    """
    标准响应格式
    
    所有 API 响应都使用此格式，确保一致性。
    
    Attributes:
        success: 是否成功
        data: 响应数据（泛型）
        message: 响应消息（可选）
        code: 响应代码（可选）
    """
    success: bool = Field(default=True, description="是否成功")
    data: Optional[T] = Field(default=None, description="响应数据")
    message: Optional[str] = Field(default=None, description="响应消息")
    code: Optional[str] = Field(default=None, description="响应代码")


class PaginatedResponse(BaseModel, Generic[T]):
    """
    分页响应格式
    
    用于列表查询的分页响应。
    
    Attributes:
        items: 数据列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    items: list[T] = Field(default_factory=list, description="数据列表")
    total: int = Field(default=0, description="总数量")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页数量")

