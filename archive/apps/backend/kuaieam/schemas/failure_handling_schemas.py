"""
故障处理 Schema 模块

定义故障处理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class FailureHandlingBase(BaseModel):
    """故障处理基础 Schema"""
    
    handling_no: str = Field(..., max_length=100, description="处理单编号")
    report_id: Optional[int] = Field(None, description="故障报修ID")
    report_uuid: Optional[str] = Field(None, max_length=36, description="故障报修UUID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., max_length=200, description="设备名称")
    handling_start_date: Optional[datetime] = Field(None, description="处理开始时间")
    handling_end_date: Optional[datetime] = Field(None, description="处理结束时间")
    handler_id: Optional[int] = Field(None, description="处理人员ID")
    handler_name: Optional[str] = Field(None, max_length=100, description="处理人员姓名")
    handling_method: Optional[str] = Field(None, description="处理方法")
    handling_result: Optional[str] = Field(None, max_length=50, description="处理结果")
    root_cause: Optional[str] = Field(None, description="根本原因")
    handling_cost: Optional[Decimal] = Field(None, description="处理成本")
    spare_parts_used: Optional[Any] = Field(None, description="使用备件")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果")
    remark: Optional[str] = Field(None, description="备注")


class FailureHandlingCreate(FailureHandlingBase):
    """创建故障处理 Schema"""
    pass


class FailureHandlingUpdate(BaseModel):
    """更新故障处理 Schema"""
    
    handling_start_date: Optional[datetime] = Field(None, description="处理开始时间")
    handling_end_date: Optional[datetime] = Field(None, description="处理结束时间")
    handler_id: Optional[int] = Field(None, description="处理人员ID")
    handler_name: Optional[str] = Field(None, max_length=100, description="处理人员姓名")
    handling_method: Optional[str] = Field(None, description="处理方法")
    handling_result: Optional[str] = Field(None, max_length=50, description="处理结果")
    root_cause: Optional[str] = Field(None, description="根本原因")
    handling_cost: Optional[Decimal] = Field(None, description="处理成本")
    spare_parts_used: Optional[Any] = Field(None, description="使用备件")
    status: Optional[str] = Field(None, max_length=50, description="处理状态")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果")
    remark: Optional[str] = Field(None, description="备注")


class FailureHandlingResponse(FailureHandlingBase):
    """故障处理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
