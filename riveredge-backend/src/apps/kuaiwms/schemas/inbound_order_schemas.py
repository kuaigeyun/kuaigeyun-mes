"""
入库单 Schema 模块

定义入库单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class InboundOrderBase(BaseModel):
    """入库单基础 Schema"""
    
    order_no: str = Field(..., max_length=50, description="入库单编号")
    order_date: datetime = Field(..., description="入库日期")
    order_type: str = Field(..., max_length=50, description="入库类型")
    warehouse_id: int = Field(..., description="仓库ID")
    total_amount: Decimal = Field(0, description="入库总金额")
    source_order_id: Optional[int] = Field(None, description="来源订单ID")
    source_order_no: Optional[str] = Field(None, max_length=50, description="来源订单编号")
    order_items: Optional[List[Dict[str, Any]]] = Field(None, description="入库明细")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class InboundOrderCreate(InboundOrderBase):
    """创建入库单 Schema"""
    pass


class InboundOrderUpdate(BaseModel):
    """更新入库单 Schema"""
    
    order_date: Optional[datetime] = Field(None, description="入库日期")
    order_type: Optional[str] = Field(None, max_length=50, description="入库类型")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    status: Optional[str] = Field(None, max_length=50, description="入库状态")
    total_amount: Optional[Decimal] = Field(None, description="入库总金额")
    order_items: Optional[List[Dict[str, Any]]] = Field(None, description="入库明细")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class InboundOrderResponse(InboundOrderBase):
    """入库单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
