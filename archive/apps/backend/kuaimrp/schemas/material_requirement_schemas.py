"""
物料需求 Schema 模块

定义物料需求相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class MaterialRequirementBase(BaseModel):
    """物料需求基础 Schema"""
    
    requirement_no: str = Field(..., max_length=50, description="需求编号")
    material_id: int = Field(..., description="物料ID")
    requirement_type: str = Field(..., max_length=20, description="需求类型（MRP、LRP）")
    plan_id: Optional[int] = Field(None, description="关联计划ID")
    requirement_date: datetime = Field(..., description="需求日期")
    gross_requirement: Decimal = Field(0, description="毛需求数量")
    available_stock: Decimal = Field(0, description="可用库存")
    in_transit_stock: Decimal = Field(0, description="在途库存")
    safety_stock: Decimal = Field(0, description="安全库存")
    net_requirement: Decimal = Field(0, description="净需求数量")
    suggested_order_qty: Optional[Decimal] = Field(None, description="建议采购/生产数量")
    suggested_order_date: Optional[datetime] = Field(None, description="建议采购/生产日期")
    suggested_type: Optional[str] = Field(None, max_length=20, description="建议类型（采购、生产、委外）")


class MaterialRequirementCreate(MaterialRequirementBase):
    """创建物料需求 Schema"""
    pass


class MaterialRequirementUpdate(BaseModel):
    """更新物料需求 Schema"""
    
    requirement_type: Optional[str] = Field(None, max_length=20, description="需求类型")
    plan_id: Optional[int] = Field(None, description="关联计划ID")
    requirement_date: Optional[datetime] = Field(None, description="需求日期")
    gross_requirement: Optional[Decimal] = Field(None, description="毛需求数量")
    available_stock: Optional[Decimal] = Field(None, description="可用库存")
    in_transit_stock: Optional[Decimal] = Field(None, description="在途库存")
    safety_stock: Optional[Decimal] = Field(None, description="安全库存")
    net_requirement: Optional[Decimal] = Field(None, description="净需求数量")
    suggested_order_qty: Optional[Decimal] = Field(None, description="建议采购/生产数量")
    suggested_order_date: Optional[datetime] = Field(None, description="建议采购/生产日期")
    suggested_type: Optional[str] = Field(None, max_length=20, description="建议类型")
    status: Optional[str] = Field(None, max_length=50, description="需求状态")


class MaterialRequirementResponse(MaterialRequirementBase):
    """物料需求响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
