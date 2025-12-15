"""
数据接口 Schema 模块

定义数据接口相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any


class DataInterfaceBase(BaseModel):
    """数据接口基础 Schema"""
    
    interface_no: str = Field(..., max_length=100, description="接口编号")
    interface_name: str = Field(..., max_length=200, description="接口名称")
    interface_type: str = Field(..., max_length=50, description="接口类型")
    interface_url: Optional[str] = Field(None, max_length=500, description="接口URL")
    interface_method: Optional[str] = Field(None, max_length=20, description="接口方法")
    request_config: Optional[Any] = Field(None, description="请求配置")
    response_config: Optional[Any] = Field(None, description="响应配置")
    subscription_config: Optional[Any] = Field(None, description="订阅配置")
    performance_metrics: Optional[Any] = Field(None, description="性能指标")
    status: str = Field("启用", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DataInterfaceCreate(DataInterfaceBase):
    """创建数据接口 Schema"""
    pass


class DataInterfaceUpdate(BaseModel):
    """更新数据接口 Schema"""
    
    interface_name: Optional[str] = Field(None, max_length=200, description="接口名称")
    interface_type: Optional[str] = Field(None, max_length=50, description="接口类型")
    interface_url: Optional[str] = Field(None, max_length=500, description="接口URL")
    interface_method: Optional[str] = Field(None, max_length=20, description="接口方法")
    request_config: Optional[Any] = Field(None, description="请求配置")
    response_config: Optional[Any] = Field(None, description="响应配置")
    subscription_config: Optional[Any] = Field(None, description="订阅配置")
    performance_metrics: Optional[Any] = Field(None, description="性能指标")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class DataInterfaceResponse(DataInterfaceBase):
    """数据接口响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

