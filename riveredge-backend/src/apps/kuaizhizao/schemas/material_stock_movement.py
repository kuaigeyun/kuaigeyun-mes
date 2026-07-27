"""生产物料库存移动流水 Schema"""

from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class WorkOrderMaterialMovementItem(BaseSchema):
    id: Optional[int] = None
    source: Literal["ledger", "document"] = "ledger"
    movement_type: str
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    batch_no: Optional[str] = None
    quantity: Decimal
    qty_before: Optional[Decimal] = None
    qty_after: Optional[Decimal] = None
    from_warehouse_id: Optional[int] = None
    from_warehouse_name: Optional[str] = None
    to_warehouse_id: Optional[int] = None
    to_warehouse_name: Optional[str] = None
    source_doc_type: Optional[str] = None
    source_doc_id: Optional[int] = None
    source_doc_code: Optional[str] = None
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    operator_id: Optional[int] = None
    operator_name: Optional[str] = None
    remark: Optional[str] = None
    occurred_at: Optional[datetime] = None


class WorkOrderMaterialHistoryMaterial(BaseSchema):
    """物料履历左栏：工单 BOM/成品物料（即使尚无履历事件也列出）。"""
    material_id: int
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None


class WorkOrderMaterialMovementListResponse(BaseSchema):
    work_order_id: int
    total: int = 0
    items: List[WorkOrderMaterialMovementItem] = Field(default_factory=list)
    materials: List[WorkOrderMaterialHistoryMaterial] = Field(
        default_factory=list,
        description="工单 BOM/成品物料列表（左栏数据源，含无履历事件的物料）",
    )
    source_mode: Literal["ledger", "document", "mixed"] = "ledger"
