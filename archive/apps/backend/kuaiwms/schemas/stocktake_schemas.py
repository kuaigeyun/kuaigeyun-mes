"""
盘点单 Schema 模块

定义盘点单相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


class StocktakeBase(BaseModel):
    """盘点单基础 Schema"""
    
    stocktake_no: str = Field(..., max_length=50, description="盘点单编号")
    stocktake_date: datetime = Field(..., description="盘点日期")
    warehouse_id: int = Field(..., description="仓库ID")
    location_id: Optional[int] = Field(None, description="库位ID")
    stocktake_type: str = Field("全盘", max_length=50, description="盘点类型")
    stocktake_items: Optional[List[Dict[str, Any]]] = Field(None, description="盘点明细")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class StocktakeCreate(StocktakeBase):
    """创建盘点单 Schema"""
    pass


class StocktakeUpdate(BaseModel):
    """更新盘点单 Schema"""
    
    stocktake_date: Optional[datetime] = Field(None, description="盘点日期")
    warehouse_id: Optional[int] = Field(None, description="仓库ID")
    location_id: Optional[int] = Field(None, description="库位ID")
    status: Optional[str] = Field(None, max_length=50, description="盘点状态")
    stocktake_type: Optional[str] = Field(None, max_length=50, description="盘点类型")
    stocktake_items: Optional[List[Dict[str, Any]]] = Field(None, description="盘点明细")
    difference_amount: Optional[Decimal] = Field(None, description="差异金额")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class StocktakeResponse(StocktakeBase):
    """盘点单响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    difference_amount: Decimal
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
