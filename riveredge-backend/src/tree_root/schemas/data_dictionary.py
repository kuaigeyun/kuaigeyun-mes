"""
数据字典 Schema 模块

定义数据字典相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class DataDictionaryBase(BaseModel):
    """
    数据字典基础 Schema
    
    包含数据字典的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="字典名称")
    code: str = Field(..., min_length=1, max_length=50, description="字典代码（唯一，用于程序识别）")
    description: Optional[str] = Field(None, description="字典描述")
    is_system: bool = Field(default=False, description="是否系统字典（系统字典不可删除）")
    is_active: bool = Field(default=True, description="是否启用")


class DataDictionaryCreate(DataDictionaryBase):
    """
    数据字典创建 Schema
    
    用于创建新数据字典的请求数据。
    """
    pass


class DataDictionaryUpdate(BaseModel):
    """
    数据字典更新 Schema
    
    用于更新数据字典的请求数据，所有字段可选。
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="字典名称")
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="字典代码")
    description: Optional[str] = Field(None, description="字典描述")
    is_active: Optional[bool] = Field(None, description="是否启用")


class DataDictionaryResponse(DataDictionaryBase):
    """
    数据字典响应 Schema
    
    用于返回数据字典信息。
    """
    uuid: str = Field(..., description="字典UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)

