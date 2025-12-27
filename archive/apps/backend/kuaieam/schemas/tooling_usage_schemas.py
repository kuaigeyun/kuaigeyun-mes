"""
工装夹具使用记录 Schema 模块

定义工装夹具使用记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ToolingUsageBase(BaseModel):
    """工装夹具使用记录基础 Schema"""
    
    usage_no: str = Field(..., max_length=100, description="使用记录编号")
    tooling_id: int = Field(..., description="工装夹具ID")
    tooling_name: str = Field(..., max_length=200, description="工装夹具名称")
    tooling_code: Optional[str] = Field(None, max_length=100, description="工装夹具编码")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=100, description="来源编号")
    usage_date: datetime = Field(..., description="使用日期")
    usage_count: int = Field(1, description="使用次数")
    total_usage_count: Optional[int] = Field(None, description="累计使用次数")
    operator_id: Optional[int] = Field(None, description="操作人员ID")
    operator_name: Optional[str] = Field(None, max_length=100, description="操作人员姓名")
    return_date: Optional[datetime] = Field(None, description="归还日期")
    remark: Optional[str] = Field(None, description="备注")


class ToolingUsageCreate(ToolingUsageBase):
    """创建工装夹具使用记录 Schema"""
    pass


class ToolingUsageUpdate(BaseModel):
    """更新工装夹具使用记录 Schema"""
    
    usage_count: Optional[int] = Field(None, description="使用次数")
    total_usage_count: Optional[int] = Field(None, description="累计使用次数")
    status: Optional[str] = Field(None, max_length=50, description="使用状态")
    return_date: Optional[datetime] = Field(None, description="归还日期")
    remark: Optional[str] = Field(None, description="备注")


class ToolingUsageResponse(ToolingUsageBase):
    """工装夹具使用记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
