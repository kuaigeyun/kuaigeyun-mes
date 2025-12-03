"""
数据源 Schema 模块

定义数据源相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class DataSourceBase(BaseModel):
    """数据源基础 Schema"""
    name: str = Field(..., max_length=100, description="数据源名称")
    code: str = Field(..., max_length=50, description="数据源代码")
    description: Optional[str] = Field(None, description="数据源描述")
    type: str = Field(..., max_length=20, description="数据源类型")
    config: Dict[str, Any] = Field(..., description="连接配置")
    is_active: bool = Field(True, description="是否启用")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证数据源类型"""
        allowed_types = ['postgresql', 'mysql', 'mongodb', 'api']
        if v not in allowed_types:
            raise ValueError(f'数据源类型必须是 {allowed_types} 之一')
        return v


class DataSourceCreate(DataSourceBase):
    """创建数据源 Schema"""
    pass


class DataSourceUpdate(BaseModel):
    """更新数据源 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="数据源名称")
    code: Optional[str] = Field(None, max_length=50, description="数据源代码")
    description: Optional[str] = Field(None, description="数据源描述")
    type: Optional[str] = Field(None, max_length=20, description="数据源类型")
    config: Optional[Dict[str, Any]] = Field(None, description="连接配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class DataSourceResponse(DataSourceBase):
    """数据源响应 Schema"""
    uuid: UUID = Field(..., description="数据源UUID")
    tenant_id: int = Field(..., description="组织ID")
    is_connected: bool = Field(..., description="是否已连接")
    last_connected_at: Optional[datetime] = Field(None, description="最后连接时间")
    last_error: Optional[str] = Field(None, description="最后连接错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class TestConnectionResponse(BaseModel):
    """测试连接响应 Schema"""
    success: bool = Field(..., description="连接是否成功")
    message: str = Field(..., description="连接消息")
    elapsed_time: float = Field(..., description="连接耗时（秒）")

