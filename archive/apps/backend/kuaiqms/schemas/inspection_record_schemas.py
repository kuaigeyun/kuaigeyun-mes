"""
质量检验记录 Schema 模块

定义质量检验记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class InspectionRecordBase(BaseModel):
    """质量检验记录基础 Schema"""
    
    record_no: str = Field(..., max_length=50, description="检验记录编号")
    task_id: Optional[int] = Field(None, description="检验任务ID")
    task_uuid: Optional[str] = Field(None, max_length=36, description="检验任务UUID")
    inspection_type: str = Field(..., max_length=50, description="检验类型")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    quantity: Decimal = Field(..., description="检验数量")
    qualified_quantity: Optional[Decimal] = Field(0, description="合格数量")
    defective_quantity: Optional[Decimal] = Field(0, description="不合格数量")
    inspection_result: str = Field(..., max_length=50, description="检验结果")
    inspection_date: datetime = Field(..., description="检验日期")
    inspector_id: Optional[int] = Field(None, description="检验员ID")
    inspector_name: Optional[str] = Field(None, max_length=100, description="检验员姓名")
    inspection_standard_id: Optional[int] = Field(None, description="检验标准ID")
    inspection_standard_name: Optional[str] = Field(None, max_length=200, description="检验标准名称")
    inspection_data: Optional[Any] = Field(None, description="检验数据（JSON）")
    remark: Optional[str] = Field(None, description="备注")


class InspectionRecordCreate(InspectionRecordBase):
    """创建质量检验记录 Schema"""
    pass


class InspectionRecordUpdate(BaseModel):
    """更新质量检验记录 Schema"""
    
    quantity: Optional[Decimal] = Field(None, description="检验数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    defective_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    inspection_result: Optional[str] = Field(None, max_length=50, description="检验结果")
    inspection_data: Optional[Any] = Field(None, description="检验数据（JSON）")
    status: Optional[str] = Field(None, max_length=50, description="记录状态")
    remark: Optional[str] = Field(None, description="备注")


class InspectionRecordResponse(InspectionRecordBase):
    """质量检验记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
