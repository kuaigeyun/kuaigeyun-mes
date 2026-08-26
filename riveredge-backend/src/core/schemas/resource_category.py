"""
资源分类 Schema 模块
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class ResourceCategoryBase(BaseModel):
    """资源分类基础 Schema"""

    name: str = Field(..., max_length=100, description="分类名称")
    code: str = Field(..., max_length=50, description="分类代码")
    description: Optional[str] = Field(None, description="分类描述")
    sort_order: int = Field(0, description="排序")
    is_active: bool = Field(True, description="是否启用")


class ResourceCategoryCreate(ResourceCategoryBase):
    """创建资源分类 Schema"""

    pass


class ResourceCategoryUpdate(BaseModel):
    """更新资源分类 Schema"""

    name: Optional[str] = Field(None, max_length=100, description="分类名称")
    code: Optional[str] = Field(None, max_length=50, description="分类代码")
    description: Optional[str] = Field(None, description="分类描述")
    sort_order: Optional[int] = Field(None, description="排序")
    is_active: Optional[bool] = Field(None, description="是否启用")


class ResourceCategoryResponse(ResourceCategoryBase):
    """资源分类响应 Schema"""

    uuid: UUID = Field(..., description="分类UUID")
    tenant_id: int = Field(..., description="组织ID")
    resource_type: str = Field(..., description="资源类型")
    item_count: int = Field(0, description="分类下资源数量")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class ResourceCategoryListResponse(BaseModel):
    """资源分类列表响应"""

    items: List[ResourceCategoryResponse] = Field(default_factory=list)
    total_count: int = Field(0, description="全部资源数量")
    uncategorized_count: int = Field(0, description="未分类资源数量")
