"""
备件需求 Schema 模块

定义备件需求相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SparePartDemandBase(BaseModel):
    """备件需求基础 Schema"""
    
    demand_no: str = Field(..., max_length=100, description="需求单编号")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=100, description="来源编号")
    material_id: int = Field(..., description="物料ID")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    demand_quantity: int = Field(..., description="需求数量")
    demand_date: datetime = Field(..., description="需求日期")
    required_date: Optional[datetime] = Field(None, description="要求到货日期")
    applicant_id: Optional[int] = Field(None, description="申请人ID")
    applicant_name: Optional[str] = Field(None, max_length=100, description="申请人姓名")
    remark: Optional[str] = Field(None, description="备注")


class SparePartDemandCreate(SparePartDemandBase):
    """创建备件需求 Schema"""
    pass


class SparePartDemandUpdate(BaseModel):
    """更新备件需求 Schema"""
    
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    demand_quantity: Optional[int] = Field(None, description="需求数量")
    required_date: Optional[datetime] = Field(None, description="要求到货日期")
    status: Optional[str] = Field(None, max_length=50, description="需求状态")
    remark: Optional[str] = Field(None, description="备注")


class SparePartDemandResponse(SparePartDemandBase):
    """备件需求响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
