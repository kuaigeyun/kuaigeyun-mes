"""
不合格品记录 Schema 模块

定义不合格品记录相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class NonconformingProductBase(BaseModel):
    """不合格品记录基础 Schema"""
    
    record_no: str = Field(..., max_length=50, description="不合格品记录编号")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=50, description="来源编号")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    batch_no: Optional[str] = Field(None, max_length=50, description="批次号")
    serial_no: Optional[str] = Field(None, max_length=50, description="序列号")
    quantity: Decimal = Field(..., description="不合格数量")
    defect_type: Optional[int] = Field(None, description="缺陷类型")
    defect_type_name: Optional[str] = Field(None, max_length=200, description="缺陷类型名称")
    defect_description: str = Field(..., description="缺陷描述")
    defect_cause: Optional[str] = Field(None, description="缺陷原因")
    impact_assessment: Optional[str] = Field(None, max_length=20, description="影响评估")
    impact_scope: Optional[str] = Field(None, description="影响范围描述")
    remark: Optional[str] = Field(None, description="备注")


class NonconformingProductCreate(NonconformingProductBase):
    """创建不合格品记录 Schema"""
    pass


class NonconformingProductUpdate(BaseModel):
    """更新不合格品记录 Schema"""
    
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    quantity: Optional[Decimal] = Field(None, description="不合格数量")
    defect_type: Optional[int] = Field(None, description="缺陷类型")
    defect_type_name: Optional[str] = Field(None, max_length=200, description="缺陷类型名称")
    defect_description: Optional[str] = Field(None, description="缺陷描述")
    defect_cause: Optional[str] = Field(None, description="缺陷原因")
    impact_assessment: Optional[str] = Field(None, max_length=20, description="影响评估")
    impact_scope: Optional[str] = Field(None, description="影响范围描述")
    status: Optional[str] = Field(None, max_length=50, description="记录状态")
    remark: Optional[str] = Field(None, description="备注")


class NonconformingProductResponse(NonconformingProductBase):
    """不合格品记录响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
