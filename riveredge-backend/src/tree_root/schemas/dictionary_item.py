"""
字典项 Schema 模块

定义字典项相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class DictionaryItemBase(BaseModel):
    """
    字典项基础 Schema
    
    包含字典项的基本字段，用于创建和更新操作。
    """
    label: str = Field(..., min_length=1, max_length=100, description="字典项标签（显示名称）")
    value: str = Field(..., min_length=1, max_length=100, description="字典项值（用于程序识别）")
    description: Optional[str] = Field(None, description="字典项描述")
    color: Optional[str] = Field(None, max_length=20, description="标签颜色（可选）")
    icon: Optional[str] = Field(None, max_length=50, description="图标（可选）")
    sort_order: int = Field(default=0, description="排序顺序")
    is_active: bool = Field(default=True, description="是否启用")


class DictionaryItemCreate(DictionaryItemBase):
    """
    字典项创建 Schema
    
    用于创建新字典项的请求数据。
    """
    dictionary_uuid: str = Field(..., description="字典UUID")


class DictionaryItemUpdate(BaseModel):
    """
    字典项更新 Schema
    
    用于更新字典项的请求数据，所有字段可选。
    """
    label: Optional[str] = Field(None, min_length=1, max_length=100, description="字典项标签")
    value: Optional[str] = Field(None, min_length=1, max_length=100, description="字典项值")
    description: Optional[str] = Field(None, description="字典项描述")
    color: Optional[str] = Field(None, max_length=20, description="标签颜色")
    icon: Optional[str] = Field(None, max_length=50, description="图标")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    is_active: Optional[bool] = Field(None, description="是否启用")


class DictionaryItemResponse(DictionaryItemBase):
    """
    字典项响应 Schema
    
    用于返回字典项信息。
    """
    uuid: str = Field(..., description="字典项UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    dictionary_uuid: str = Field(..., description="字典UUID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

