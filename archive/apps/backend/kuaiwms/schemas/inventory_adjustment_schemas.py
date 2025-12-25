"""
库存调整 Schema 模块

定义库存调整相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class InventoryAdjustmentBase(BaseModel):
    """库存调整基础 Schema"""
    
    adjustment_no: str = Field(..., max_length=50, description="调整单编号")
    adjustment_date: datetime = Field(..., description="调整日期")
    warehouse_id: int = Field(..., description="仓库ID")
    adjustment_type: str = Field(..., max_length=50, description="调整类型")
    adjustment_reason: str = Field(..., description="调整原因")
    adjustment_items: Optional[List[Dict[str, Any]]] = Field(None, description="调整明细")
    total_amount: Decimal = Field(0, description="调整总金额")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class InventoryAdjustmentCreate(InventoryAdjustmentBase):
    """创建库存调整 Schema"""
    pass


class InventoryAdjustmentUpdate(BaseModel):
    """更新库存调整 Schema"""
    
    adjustment_date: Optional[datetime] = Field(None, description="调整日期")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    adjustment_type: Optional[str] = Field(None, max_length=50, description="调整类型")
    adjustment_reason: Optional[str] = Field(None, description="调整原因")
    status: Optional[str] = Field(None, max_length=50, description="调整状态")
    adjustment_items: Optional[List[Dict[str, Any]]] = Field(None, description="调整明细")
    total_amount: Optional[Decimal] = Field(None, description="调整总金额")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class InventoryAdjustmentResponse(InventoryAdjustmentBase):
    """库存调整响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    approval_instance_id: Optional[int] = None
    approval_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
