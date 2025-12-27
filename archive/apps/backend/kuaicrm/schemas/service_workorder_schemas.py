"""
服务工单 Schema 模块

定义服务工单数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class ServiceWorkOrderBase(BaseModel):
    """服务工单基础 Schema"""
    
    workorder_no: str = Field(..., max_length=50, description="工单编号")
    workorder_type: str = Field(..., max_length=50, description="工单类型")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    status: str = Field("待分配", max_length=50, description="工单状态")
    priority: str = Field("普通", max_length=20, description="优先级")
    service_content: str = Field(..., description="服务内容")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    
    @validator("workorder_no")
    def validate_workorder_no(cls, v):
        """验证工单编号格式"""
        if not v or not v.strip():
            raise ValueError("工单编号不能为空")
        return v.strip().upper()
    
    @validator("service_content")
    def validate_service_content(cls, v):
        """验证服务内容格式"""
        if not v or not v.strip():
            raise ValueError("服务内容不能为空")
        return v.strip()


class ServiceWorkOrderCreate(ServiceWorkOrderBase):
    """创建服务工单 Schema"""
    pass


class ServiceWorkOrderUpdate(BaseModel):
    """更新服务工单 Schema"""
    
    workorder_type: Optional[str] = Field(None, max_length=50, description="工单类型")
    status: Optional[str] = Field(None, max_length=50, description="工单状态")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    service_content: Optional[str] = Field(None, description="服务内容")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    execution_result: Optional[str] = Field(None, description="执行结果")


class ServiceWorkOrderResponse(ServiceWorkOrderBase):
    """服务工单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    execution_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
