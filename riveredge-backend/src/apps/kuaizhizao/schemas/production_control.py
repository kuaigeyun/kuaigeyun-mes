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
    picking_score: Optional[float] = Field(None, description="备料场景综合分")
    picking_rank_band: Optional[str] = Field(None, description="备料等级带 A/B/C")


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
    scheduling_score: Optional[float] = Field(None, description="排程综合分")
    scheduling_rank_band: Optional[str] = Field(None, description="等级带 A/B/C")


class ControlTowerStats(BaseModel):
    """管控塔计划类 KPI"""
    total_count: int = Field(0, description="需求计算总数")
    pending_review_count: int = Field(0, description="进行中计算数")
    executed_count: int = Field(0, description="已完成计算数")
    overdue_plans_count: int = Field(0, description="交期风险/逾期数")


class ControlTowerSummary(BaseModel):
    """管控塔概览统计"""
    material_readiness: List[MaterialReadinessItem]
    resource_load: List[ResourceLoadItem]
    delivery_risks: List[DeliveryRiskItem]
    total_wip_count: int = Field(..., description="在制工单总数")
    total_risk_count: int = Field(..., description="风险工单总数")
    stats: Optional[ControlTowerStats] = Field(None, description="计划类 KPI")


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
    scheduling_score: Optional[float] = Field(None, description="当前排程综合分")
    scheduling_rank_band: Optional[str] = Field(None, description="等级带 A/B/C")


class SchedulingScorePreview(BaseModel):
    """插单 What-if 排程综合分预览"""
    scheduling_score: float
    scheduling_rank_band: str
    queue_rank: int = Field(..., description="预估排位（含插单）")
    queue_total: int = Field(..., description="队列工单总数（含插单）")
    breakdown: Optional[Dict[str, Any]] = None


class SimulationResult(BaseModel):
    """模拟结果"""
    can_fulfill_material: bool = Field(..., description="物料是否可满足")
    readiness_rate: float
    shortage_items: List[Dict[str, Any]] = []
    impacted_orders: List[ImpactedOrderItem] = []
    resource_load_change: List[Dict[str, Any]] = []
    recommendation: str
    scheduling_score_preview: Optional[SchedulingScorePreview] = Field(
        None, description="APS-Lite 排程综合分 What-if 预览（不写库）"
    )
