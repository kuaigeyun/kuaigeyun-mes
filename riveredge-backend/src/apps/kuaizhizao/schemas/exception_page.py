"""异常列表分页响应（工作台异常管理各页共用）。"""

from typing import List, TypeVar, Generic

from pydantic import BaseModel, Field

T = TypeVar("T")


class ExceptionListPageResponse(BaseModel, Generic[T]):
    items: List[T] = Field(default_factory=list)
    total: int = Field(0, description="符合条件的总记录数")
