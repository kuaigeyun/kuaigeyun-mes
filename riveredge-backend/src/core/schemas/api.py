"""
接口 Schema 模块

定义接口相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class APIBase(BaseModel):
    """接口基础 Schema"""
    name: str = Field(..., max_length=100, description="接口名称")
    code: str = Field(..., max_length=50, description="接口代码")
    description: Optional[str] = Field(None, description="接口描述")
    path: str = Field(..., max_length=500, description="接口路径")
    method: str = Field(..., max_length=10, description="请求方法")
    request_headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    request_params: Optional[Dict[str, Any]] = Field(None, description="请求参数")
    request_body: Optional[Dict[str, Any]] = Field(None, description="请求体")
    response_format: Optional[Dict[str, Any]] = Field(None, description="响应格式")
    response_example: Optional[Dict[str, Any]] = Field(None, description="响应示例")
    is_active: bool = Field(True, description="是否启用")
    is_system: bool = Field(False, description="是否系统接口")


class APICreate(APIBase):
    """创建接口 Schema"""
    pass


class APIUpdate(BaseModel):
    """更新接口 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="接口名称")
    code: Optional[str] = Field(None, max_length=50, description="接口代码")
    description: Optional[str] = Field(None, description="接口描述")
    path: Optional[str] = Field(None, max_length=500, description="接口路径")
    method: Optional[str] = Field(None, max_length=10, description="请求方法")
    request_headers: Optional[Dict[str, Any]] = Field(None, description="请求头")
    request_params: Optional[Dict[str, Any]] = Field(None, description="请求参数")
    request_body: Optional[Dict[str, Any]] = Field(None, description="请求体")
    response_format: Optional[Dict[str, Any]] = Field(None, description="响应格式")
    response_example: Optional[Dict[str, Any]] = Field(None, description="响应示例")
    is_active: Optional[bool] = Field(None, description="是否启用")


class APIResponse(APIBase):
    """接口响应 Schema"""
    uuid: UUID = Field(..., description="接口UUID")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class APITestRequest(BaseModel):
    """接口测试请求 Schema"""
    headers: Optional[Dict[str, Any]] = Field(None, description="请求头（覆盖接口定义）")
    params: Optional[Dict[str, Any]] = Field(None, description="请求参数（覆盖接口定义）")
    body: Optional[Dict[str, Any]] = Field(None, description="请求体（覆盖接口定义）")


class APITestResponse(BaseModel):
    """接口测试响应 Schema"""
    status_code: int = Field(..., description="响应状态码")
    headers: Dict[str, Any] = Field(..., description="响应头")
    body: Any = Field(..., description="响应体")
    elapsed_time: float = Field(..., description="请求耗时（秒）")

