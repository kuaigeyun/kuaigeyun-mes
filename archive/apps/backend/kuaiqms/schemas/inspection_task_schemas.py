"""
质量检验任务 Schema 模块

定义质量检验任务相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InspectionTaskBase(BaseModel):
    """质量检验任务基础 Schema"""
    
    task_no: str = Field(..., max_length=50, description="检验任务编号")
    inspection_type: str = Field(..., max_length=50, description="检验类型")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=50, description="来源编号")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    quantity: Decimal = Field(..., description="检验数量")
    inspector_id: Optional[int] = Field(None, description="检验员ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验员姓名")
    inspection_standard_id: Optional[int] = Field(None, description="检验标准ID")
    inspection_standard_name: Optional[str] = Field(None, max_length=200, description="检验标准名称")
    planned_inspection_date: Optional[datetime] = Field(None, description="计划检验日期")
    priority: str = Field("中", max_length=20, description="优先级")
    remark: Optional[str] = Field(None, description="备注")


class InspectionTaskCreate(InspectionTaskBase):
    """创建质量检验任务 Schema"""
    pass


class InspectionTaskUpdate(BaseModel):
    """更新质量检验任务 Schema"""
    
    inspection_type: Optional[str] = Field(None, max_length=50, description="检验类型")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    quantity: Optional[Decimal] = Field(None, description="检验数量")
    inspector_id: Optional[int] = Field(None, description="检验员ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验员姓名")
    status: Optional[str] = Field(None, max_length=50, description="任务状态")
    planned_inspection_date: Optional[datetime] = Field(None, description="计划检验日期")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    remark: Optional[str] = Field(None, description="备注")


class InspectionTaskResponse(InspectionTaskBase):
    """质量检验任务响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
