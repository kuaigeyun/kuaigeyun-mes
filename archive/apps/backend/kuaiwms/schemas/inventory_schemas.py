"""
库存 Schema 模块

定义库存相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InventoryResponse(BaseModel):
    """库存响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    material_id: int
    warehouse_id: int
    location_id: Optional[int] = None
    quantity: Decimal
    available_quantity: Decimal
    reserved_quantity: Decimal
    in_transit_quantity: Decimal
    unit: Optional[str] = None
    batch_no: Optional[str] = None
    lot_no: Optional[str] = None
    expiry_date: Optional[datetime] = None
    cost_price: Decimal
    total_cost: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
