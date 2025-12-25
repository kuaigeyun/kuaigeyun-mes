"""
运输需求 Schema 模块

定义运输需求相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class TransportDemandBase(BaseModel):
    """运输需求基础 Schema"""
    
    demand_no: str = Field(..., max_length=100, description="需求单编号")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=100, description="来源编号")
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    delivery_address: Optional[str] = Field(None, description="收货地址")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人")
    contact_phone: Optional[str] = Field(None, max_length=50, description="联系电话")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    quantity: Optional[Decimal] = Field(None, description="数量")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    required_date: Optional[datetime] = Field(None, description="要求到货日期")
    priority: Optional[str] = Field("中", max_length=20, description="优先级")
    remark: Optional[str] = Field(None, description="备注")


class TransportDemandCreate(TransportDemandBase):
    """创建运输需求 Schema"""
    pass


class TransportDemandUpdate(BaseModel):
    """更新运输需求 Schema"""
    
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    delivery_address: Optional[str] = Field(None, description="收货地址")
    contact_person: Optional[str] = Field(None, max_length=100, description="联系人")
    contact_phone: Optional[str] = Field(None, max_length=50, description="联系电话")
    material_id: Optional[int] = Field(None, description="物料ID")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    quantity: Optional[Decimal] = Field(None, description="数量")
    required_date: Optional[datetime] = Field(None, description="要求到货日期")
    priority: Optional[str] = Field(None, max_length=20, description="优先级")
    status: Optional[str] = Field(None, max_length=50, description="需求状态")
    remark: Optional[str] = Field(None, description="备注")


class TransportDemandResponse(TransportDemandBase):
    """运输需求响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

