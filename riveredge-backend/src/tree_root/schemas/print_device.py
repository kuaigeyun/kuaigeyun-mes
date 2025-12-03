"""
打印设备 Schema 模块

定义打印设备相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class PrintDeviceBase(BaseModel):
    """打印设备基础 Schema"""
    name: str = Field(..., max_length=200, description="设备名称")
    code: str = Field(..., max_length=50, description="设备代码")
    type: str = Field(..., max_length=50, description="设备类型")
    description: Optional[str] = Field(None, description="设备描述")
    config: Dict[str, Any] = Field(..., description="设备配置")
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v):
        """验证设备类型"""
        allowed_types = ['local', 'network', 'cloud', 'other']
        if v not in allowed_types:
            raise ValueError(f'设备类型必须是 {allowed_types} 之一')
        return v


class PrintDeviceCreate(PrintDeviceBase):
    """创建打印设备 Schema"""
    pass


class PrintDeviceUpdate(BaseModel):
    """更新打印设备 Schema"""
    name: Optional[str] = Field(None, max_length=200, description="设备名称")
    description: Optional[str] = Field(None, description="设备描述")
    config: Optional[Dict[str, Any]] = Field(None, description="设备配置")
    is_active: Optional[bool] = Field(None, description="是否启用")
    is_default: Optional[bool] = Field(None, description="是否默认设备")


class PrintDeviceTestRequest(BaseModel):
    """测试打印设备请求 Schema"""
    test_content: Optional[str] = Field(None, description="测试内容")


class PrintDevicePrintRequest(BaseModel):
    """打印请求 Schema"""
    template_uuid: str = Field(..., description="打印模板UUID")
    data: Dict[str, Any] = Field(..., description="打印数据")
    async_execution: bool = Field(False, description="是否异步执行（通过 Inngest）")


class PrintDeviceResponse(PrintDeviceBase):
    """打印设备响应 Schema"""
    uuid: UUID = Field(..., description="打印设备UUID")
    tenant_id: int = Field(..., description="组织ID")
    is_active: bool = Field(..., description="是否启用")
    is_default: bool = Field(..., description="是否默认设备")
    is_online: bool = Field(..., description="是否在线")
    inngest_function_id: Optional[str] = Field(None, description="Inngest 函数ID")
    last_connected_at: Optional[datetime] = Field(None, description="最后连接时间")
    usage_count: int = Field(..., description="使用次数")
    last_used_at: Optional[datetime] = Field(None, description="最后使用时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PrintDeviceTestResponse(BaseModel):
    """打印设备测试响应 Schema"""
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="测试结果消息")
    error: Optional[str] = Field(None, description="错误信息")


class PrintDevicePrintResponse(BaseModel):
    """打印响应 Schema"""
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="打印结果消息")
    error: Optional[str] = Field(None, description="错误信息")
    inngest_run_id: Optional[str] = Field(None, description="Inngest 运行ID（如果异步执行）")

