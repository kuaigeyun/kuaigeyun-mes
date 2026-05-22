"""
生产协调看板 Schema
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CoordinationAction(BaseModel):
    type: str = Field(..., description="navigate | refresh | release_kitted")
    label: str
    route: Optional[str] = None


class CoordinationOrderLine(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    material_spec: Optional[str] = None
    unit: Optional[str] = None
    quantity: float = 0
    delivery_date: Optional[str] = None
    available_quantity: float = 0


class CoordinationStage(BaseModel):
    key: str
    title: str
    status: str = Field(..., description="done | pending | blocked | partial | skipped")
    summary: str = ""
    blockers: List[str] = Field(default_factory=list)
    actions: List[CoordinationAction] = Field(default_factory=list)
    lines: List[CoordinationOrderLine] = Field(default_factory=list)


class CoordinationDocumentItem(BaseModel):
    id: int
    code: str
    status: str
    extra: Optional[Dict[str, Any]] = None


class CoordinationDocuments(BaseModel):
    work_orders: List[CoordinationDocumentItem] = Field(default_factory=list)
    outsource_work_orders: List[CoordinationDocumentItem] = Field(default_factory=list)
    purchase_orders: List[CoordinationDocumentItem] = Field(default_factory=list)
    purchase_requisitions: List[CoordinationDocumentItem] = Field(default_factory=list)


class CoordinationComputationBrief(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    status: Optional[str] = None
    demand_id: Optional[int] = None


class CoordinationSalesOrderBrief(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    delivery_date: Optional[str] = None


class CoordinationPipeline(BaseModel):
    computation: Optional[CoordinationComputationBrief] = None
    sales_order: Optional[CoordinationSalesOrderBrief] = None
    stages: List[CoordinationStage]
    documents: CoordinationDocuments
    work_order_ids: List[int] = Field(default_factory=list)
    dynamic_monitor_alerts: List[str] = Field(default_factory=list)


class ActiveComputationItem(BaseModel):
    id: int
    code: str
    status: str
    demand_id: Optional[int] = None
    sales_order_code: Optional[str] = None
    incomplete_work_orders: int = 0
    updated_at: Optional[str] = None


class ActiveOrderItem(BaseModel):
    sales_order_id: int
    sales_order_code: str
    delivery_date: Optional[str] = None
    computation_id: Optional[int] = None
    computation_code: Optional[str] = None
    demand_id: Optional[int] = None
    bom_status: str = "pending"
    incomplete_work_orders: int = 0
    updated_at: Optional[str] = None


class ActiveOrdersResponse(BaseModel):
    items: List[ActiveOrderItem]


class ActiveComputationsResponse(BaseModel):
    items: List[ActiveComputationItem]
