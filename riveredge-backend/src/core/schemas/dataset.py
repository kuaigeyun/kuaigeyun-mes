"""
数据集 Schema 模块

定义数据集相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class DatasetBase(BaseModel):
    """数据集基础 Schema"""
    name: str = Field(..., max_length=100, description="数据集名称")
    code: str = Field(..., max_length=50, description="数据集代码")
    description: Optional[str] = Field(None, description="数据集描述")
    query_type: str = Field(..., max_length=20, description="查询类型")
    query_config: Dict[str, Any] = Field(..., description="查询配置")
    is_active: bool = Field(True, description="是否启用")
    
    @field_validator('query_type')
    @classmethod
    def validate_query_type(cls, v):
        """验证查询类型"""
        allowed_types = ['sql', 'api']
        if v not in allowed_types:
            raise ValueError(f'查询类型必须是 {allowed_types} 之一')
        return v


class DatasetCreate(DatasetBase):
    """创建数据集 Schema"""
    data_source_uuid: UUID = Field(..., description="数据源UUID")


class DatasetUpdate(BaseModel):
    """更新数据集 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="数据集名称")
    code: Optional[str] = Field(None, max_length=50, description="数据集代码")
    description: Optional[str] = Field(None, description="数据集描述")
    query_type: Optional[str] = Field(None, max_length=20, description="查询类型")
    query_config: Optional[Dict[str, Any]] = Field(None, description="查询配置")
    is_active: Optional[bool] = Field(None, description="是否启用")


class DatasetResponse(DatasetBase):
    """数据集响应 Schema"""
    uuid: UUID = Field(..., description="数据集UUID")
    tenant_id: int = Field(..., description="组织ID")
    data_source_uuid: UUID = Field(..., description="数据源UUID")
    last_executed_at: Optional[datetime] = Field(None, description="最后执行时间")
    last_error: Optional[str] = Field(None, description="最后执行错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class ExecuteQueryRequest(BaseModel):
    """执行查询请求 Schema"""
    parameters: Optional[Dict[str, Any]] = Field(None, description="查询参数（覆盖数据集定义）")
    limit: Optional[int] = Field(100, ge=1, le=10000, description="限制返回行数")
    offset: Optional[int] = Field(0, ge=0, description="偏移量")


class ExecuteQueryResponse(BaseModel):
    """执行查询响应 Schema"""
    success: bool = Field(..., description="查询是否成功")
    data: List[Dict[str, Any]] = Field(..., description="查询结果数据")
    total: Optional[int] = Field(None, description="总行数（如果支持）")
    columns: Optional[List[str]] = Field(None, description="列信息")
    elapsed_time: float = Field(..., description="查询耗时（秒）")
    error: Optional[str] = Field(None, description="错误信息")

