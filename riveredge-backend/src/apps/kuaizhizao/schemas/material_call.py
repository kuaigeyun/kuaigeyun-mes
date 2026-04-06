"""
叫料请求 Schema 模块

单头 MaterialCallRequest + 明细 MaterialCallRequestItem。
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class MaterialCallLineCreate(BaseModel):
    """叫料明细行（创建）"""

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(default="", max_length=50)
    material_name: str = Field(default="", max_length=200)
    material_unit: Optional[str] = Field(default=None, max_length=20)
    requested_quantity: Decimal = Field(..., description="需求数量（须>0）")


class MaterialCallLineResponse(BaseModel):
    """叫料明细行（响应）"""

    id: int
    line_no: int
    material_id: int
    material_code: str
    material_name: str
    material_unit: Optional[str] = None
    requested_quantity: Decimal
    delivered_quantity: Decimal

    model_config = ConfigDict(from_attributes=True)


class MaterialCallRequestCreate(BaseModel):
    """
    发起叫料（单头 + 至少一行明细）

    call_type: FULL_ORDER | CUSTOM_SELECTION；兼容历史 SINGLE_MATERIAL（同 CUSTOM_SELECTION）
    """

    work_order_id: int
    work_order_code: str
    items: List[MaterialCallLineCreate] = Field(..., min_length=1, description="叫料明细")
    call_type: str = Field(
        default="CUSTOM_SELECTION",
        description="FULL_ORDER 整单；CUSTOM_SELECTION 单独叫料（自选多物料）；SINGLE_MATERIAL 兼容",
    )
    call_reason: Optional[str] = Field(
        default=None,
        description="单独叫料须填：数据字典 MATERIAL_CALL_REASON；整单可空",
    )
    source_warehouse_id: Optional[int] = None
    target_warehouse_id: Optional[int] = None
    priority: str = "normal"
    needed_at: Optional[datetime] = None
    remarks: Optional[str] = None


class MaterialCallRequestUpdate(BaseModel):
    """更新叫料请求（处理状态/头汇总送达数量等）"""

    requested_quantity: Optional[Decimal] = None
    delivered_quantity: Optional[Decimal] = None
    status: Optional[str] = None
    handler_id: Optional[int] = None
    handler_name: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


class MaterialCallRequestResponse(BaseModel):
    """叫料单响应：单头字段 + 明细列表（列表/详情通用）"""

    id: int
    code: str
    work_order_id: int
    work_order_code: str
    # 汇总 / 兼容单列展示
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_unit: Optional[str] = None
    requested_quantity: Decimal
    delivered_quantity: Decimal
    call_type: str = "CUSTOM_SELECTION"
    call_reason: Optional[str] = None
    source_warehouse_id: Optional[int] = None
    target_warehouse_id: Optional[int] = None
    production_picking_id: Optional[int] = Field(
        default=None, description="叫料完成生成的生产领料单ID"
    )
    priority: str = "normal"
    needed_at: Optional[datetime] = None
    remarks: Optional[str] = None
    status: str
    caller_id: int
    caller_name: str
    handler_id: Optional[int] = None
    handler_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    items: List[MaterialCallLineResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MaterialCallRequestListResponse(BaseModel):
    """列表项（精简，可不含明细）"""

    id: int
    code: str
    work_order_code: str
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    requested_quantity: Decimal
    delivered_quantity: Decimal
    status: str
    call_type: str = "CUSTOM_SELECTION"
    priority: str
    caller_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialCallBatchFromWorkOrderRequest(BaseModel):
    """按工单整单发起叫料（齐套缺料生成一张单、多行明细）"""

    work_order_id: int = Field(..., description="工单ID")
