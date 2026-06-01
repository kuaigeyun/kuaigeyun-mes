"""工单组 Schema。"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class WorkOrderGroupMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    product_id: int
    product_code: str
    product_name: str
    quantity: float
    status: str
    group_role: Optional[str] = None
    bom_parent_work_order_id: Optional[int] = None
    supply_mode: Optional[str] = None
    readiness_rate: Optional[float] = None
    kind: str = Field(..., description="work_order | outsource_work_order")


class WorkOrderGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    group_code: str
    group_name: Optional[str] = None
    root_demand_item_id: int
    root_material_id: int
    root_material_code: str
    root_material_name: str
    demand_computation_id: int
    demand_id: Optional[int] = None
    sales_order_id: Optional[int] = None
    status: str
    has_direct_supply: bool = False
    root_work_order_id: Optional[int] = None
    member_count: int = 0
    min_readiness_rate: Optional[float] = None
    members: List[WorkOrderGroupMemberResponse] = Field(default_factory=list)
    created_at: datetime
