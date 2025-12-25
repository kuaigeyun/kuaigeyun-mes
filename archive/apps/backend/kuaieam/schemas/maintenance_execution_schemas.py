"""
维护执行记录 Schema 模块

定义维护执行记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class MaintenanceExecutionBase(BaseModel):
    """维护执行记录基础 Schema"""
    
    execution_no: str = Field(..., max_length=100, description="执行记录编号")
    workorder_id: Optional[int] = Field(None, description="维护工单ID")
    workorder_uuid: Optional[str] = Field(None, max_length=36, description="维护工单UUID")
    equipment_id: int = Field(..., description="设备ID")
    equipment_name: str = Field(..., max_length=200, description="设备名称")
    execution_date: datetime = Field(..., description="执行日期")
    executor_id: Optional[int] = Field(None, description="执行人员ID")
    executor_name: Optional[str] = Field(None, max_length=100, description="执行人员姓名")
    execution_content: Optional[str] = Field(None, description="执行内容")
    execution_result: Optional[str] = Field(None, max_length=50, description="执行结果")
    maintenance_cost: Optional[Decimal] = Field(None, description="维护成本")
    spare_parts_used: Optional[Any] = Field(None, description="使用备件")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果")
    remark: Optional[str] = Field(None, description="备注")


class MaintenanceExecutionCreate(MaintenanceExecutionBase):
    """创建维护执行记录 Schema"""
    pass


class MaintenanceExecutionUpdate(BaseModel):
    """更新维护执行记录 Schema"""
    
    execution_content: Optional[str] = Field(None, description="执行内容")
    execution_result: Optional[str] = Field(None, max_length=50, description="执行结果")
    maintenance_cost: Optional[Decimal] = Field(None, description="维护成本")
    spare_parts_used: Optional[Any] = Field(None, description="使用备件")
    status: Optional[str] = Field(None, max_length=50, description="记录状态")
    acceptance_person_id: Optional[int] = Field(None, description="验收人员ID")
    acceptance_person_name: Optional[str] = Field(None, max_length=100, description="验收人员姓名")
    acceptance_date: Optional[datetime] = Field(None, description="验收日期")
    acceptance_result: Optional[str] = Field(None, max_length=50, description="验收结果")
    remark: Optional[str] = Field(None, description="备注")


class MaintenanceExecutionResponse(MaintenanceExecutionBase):
    """维护执行记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
