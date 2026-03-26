"""
生产计划管控塔 Schema 模块
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


class MaterialReadinessItem(BaseModel):
    """工单齐套性明细项"""
    work_order_id: int
    work_order_code: str
    product_name: str
    quantity: float
    status: str
    readiness_rate: float = Field(..., description="齐套率（0-100）")
    shortage_count: int = Field(..., description="缺料品种数")
    planned_start_date: Optional[str] = None


class ResourceLoadItem(BaseModel):
    """工作中心负荷明细项"""
    work_center_id: int
    work_center_name: str
    load_hours: float = Field(..., description="已排产总工时")
    capacity_hours: float = Field(..., description="标准产能工时")
    load_rate: float = Field(..., description="负荷率（0-100）")


class DeliveryRiskItem(BaseModel):
    """交期风险明细项"""
    work_order_id: int
    work_order_code: str
    product_name: str
    status: str
    planned_end_date: Optional[str] = None
    so_required_date: Optional[str] = None
    risk_type: str = Field(..., description="风险类型：delayed(已延期), delivery_clash(晚于交付)")
    risk_desc: str
    delay_days: int


class ControlTowerSummary(BaseModel):
    """管控塔概览统计"""
    material_readiness: List[MaterialReadinessItem]
    resource_load: List[ResourceLoadItem]
    delivery_risks: List[DeliveryRiskItem]
    total_wip_count: int = Field(..., description="在制工单总数")
    total_risk_count: int = Field(..., description="风险工单总数")


class BulkReleaseRequest(BaseModel):
    """批量下达请求"""
    work_order_ids: List[int]


class UrgentOrderSimulationRequest(BaseModel):
    """紧急工单插单影响模拟请求"""
    product_id: int
    quantity: float
    planned_start_date: datetime
    planned_end_date: datetime
    priority: str = "urgent"
    workshop_id: Optional[int] = None
    work_center_id: Optional[int] = None


class ImpactedOrderItem(BaseModel):
    """受影响的现有工单"""
    work_order_id: int
    work_order_code: str
    product_name: str
    original_planned_start: datetime
    original_planned_end: datetime
    impact_type: str = Field(..., description="影响类型：material_conflict(切料/抢料), resource_delay(资源排队延期)")
    delay_days: int = 0
    shortage_items: List[str] = []


class SimulationResult(BaseModel):
    """模拟结果"""
    can_fulfill_material: bool = Field(..., description="物料是否可满足")
    readiness_rate: float
    shortage_items: List[Dict[str, Any]] = []
    impacted_orders: List[ImpactedOrderItem] = []
    resource_load_change: List[Dict[str, Any]] = []
    recommendation: str
