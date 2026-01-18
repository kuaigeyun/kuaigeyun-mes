"""
生产计划模块数据验证schema

提供生产计划相关的数据验证和序列化。

⚠️ 注意：MRP和LRP分离的Schema已废弃，应使用统一的需求计算Schema。

Author: Luigi Lu
Date: 2025-12-30
更新日期: 2025-01-27
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# 导入BaseSchema用于兼容性
from core.schemas.base import BaseSchema


# === 生产计划 ===

class ProductionPlanBase(BaseSchema):
    """生产计划基础schema"""
    plan_code: str = Field(..., max_length=50, description="计划编码")
    plan_name: str = Field(..., max_length=200, description="计划名称")
    plan_type: str = Field(..., max_length=20, description="计划类型（MRP/LRP）")
    source_type: str = Field(..., max_length=20, description="来源类型")
    source_id: int = Field(..., description="来源ID")
    source_code: str = Field(..., max_length=50, description="来源编码")
    plan_start_date: date = Field(..., description="计划开始日期")
    plan_end_date: date = Field(..., description="计划结束日期")
    status: str = Field("草稿", max_length=20, description="计划状态")
    execution_status: str = Field("未执行", max_length=20, description="执行状态")
    total_work_orders: int = Field(0, description="总工单数")
    total_purchase_orders: int = Field(0, description="总采购订单数")
    total_cost: float = Field(0, ge=0, description="总成本")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class ProductionPlanCreate(ProductionPlanBase):
    """生产计划创建schema"""
    pass


class ProductionPlanUpdate(ProductionPlanBase):
    """生产计划更新schema"""
    plan_code: Optional[str] = Field(None, max_length=50, description="计划编码")


class ProductionPlanResponse(ProductionPlanBase):
    """生产计划响应schema"""
    id: int = Field(..., description="计划ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class ProductionPlanListResponse(ProductionPlanResponse):
    """生产计划列表响应schema（简化版）"""
    pass


# === 生产计划明细 ===

class ProductionPlanItemBase(BaseSchema):
    """生产计划明细基础schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_type: str = Field(..., max_length=20, description="物料类型")
    planned_quantity: float = Field(..., gt=0, description="计划数量")
    planned_date: date = Field(..., description="计划日期")
    available_inventory: float = Field(0, ge=0, description="可用库存")
    safety_stock: float = Field(0, ge=0, description="安全库存")
    gross_requirement: float = Field(..., ge=0, description="毛需求")
    net_requirement: float = Field(..., ge=0, description="净需求")
    suggested_action: str = Field(..., max_length=20, description="建议行动")
    work_order_quantity: float = Field(0, ge=0, description="建议工单数量")
    purchase_order_quantity: float = Field(0, ge=0, description="建议采购数量")
    execution_status: str = Field("未执行", max_length=20, description="执行状态")
    work_order_id: Optional[int] = Field(None, description="生成的工单ID")
    purchase_order_id: Optional[int] = Field(None, description="生成的采购订单ID")
    lead_time: int = Field(0, ge=0, description="前置时间（天）")
    notes: Optional[str] = Field(None, description="备注")


class ProductionPlanItemCreate(ProductionPlanItemBase):
    """生产计划明细创建schema"""
    pass


class ProductionPlanItemUpdate(ProductionPlanItemBase):
    """生产计划明细更新schema"""
    pass


class ProductionPlanItemResponse(ProductionPlanItemBase):
    """生产计划明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    plan_id: int = Field(..., description="生产计划ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === MRP运算结果（已废弃） ===
# ⚠️ 已废弃：根据《☆ 用户使用全场景推演.md》的设计理念，MRP和LRP已合并为统一的需求计算模型
# TODO: 将在统一需求计算Schema中重新实现，相关API路由已注释

class MRPResultBase(BaseSchema):
    """MRP运算结果基础schema"""
    forecast_id: int = Field(..., description="销售预测ID")
    material_id: int = Field(..., description="物料ID")
    planning_horizon: int = Field(..., gt=0, description="计划时域（天）")
    time_bucket: str = Field("日", max_length=20, description="时间段")
    current_inventory: float = Field(..., ge=0, description="当前库存")
    safety_stock: float = Field(0, ge=0, description="安全库存")
    reorder_point: float = Field(0, ge=0, description="再订货点")
    total_gross_requirement: float = Field(..., ge=0, description="总毛需求")
    total_net_requirement: float = Field(..., ge=0, description="总净需求")
    total_planned_receipt: float = Field(0, ge=0, description="总计划入库")
    total_planned_release: float = Field(0, ge=0, description="总计划发放")
    suggested_work_orders: int = Field(0, ge=0, description="建议工单数")
    suggested_purchase_orders: int = Field(0, ge=0, description="建议采购订单数")
    computation_status: str = Field("完成", max_length=20, description="运算状态")
    computation_time: datetime = Field(..., description="运算时间")
    demand_schedule: dict = Field(..., description="需求时间表")
    inventory_schedule: dict = Field(..., description="库存时间表")
    planned_order_schedule: dict = Field(..., description="计划订单时间表")
    notes: Optional[str] = Field(None, description="备注")


class MRPResultCreate(MRPResultBase):
    """MRP运算结果创建schema"""
    pass


class MRPResultResponse(MRPResultBase):
    """MRP运算结果响应schema"""
    id: int = Field(..., description="MRP结果ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class MRPResultListResponse(MRPResultResponse):
    """MRP运算结果列表响应schema（简化版）"""
    pass


# === LRP运算结果（已废弃） ===
# ⚠️ 已废弃：根据《☆ 用户使用全场景推演.md》的设计理念，MRP和LRP已合并为统一的需求计算模型
# TODO: 将在统一需求计算Schema中重新实现，相关API路由已注释

class LRPResultBase(BaseSchema):
    """LRP运算结果基础schema"""
    sales_order_id: int = Field(..., description="销售订单ID")
    material_id: int = Field(..., description="物料ID")
    delivery_date: date = Field(..., description="交货日期")
    planning_horizon: int = Field(..., gt=0, description="计划时域（天）")
    required_quantity: float = Field(..., gt=0, description="需求数量")
    available_inventory: float = Field(0, ge=0, description="可用库存")
    net_requirement: float = Field(..., ge=0, description="净需求")
    planned_production: float = Field(0, ge=0, description="计划生产")
    planned_procurement: float = Field(0, ge=0, description="计划采购")
    production_start_date: Optional[date] = Field(None, description="生产开始日期")
    production_completion_date: Optional[date] = Field(None, description="生产完成日期")
    procurement_start_date: Optional[date] = Field(None, description="采购开始日期")
    procurement_completion_date: Optional[date] = Field(None, description="采购完成日期")
    bom_id: Optional[int] = Field(None, description="使用的BOM ID")
    bom_version: Optional[str] = Field(None, max_length=20, description="BOM版本")
    computation_status: str = Field("完成", max_length=20, description="运算状态")
    computation_time: datetime = Field(..., description="运算时间")
    material_breakdown: dict = Field(..., description="物料分解")
    capacity_requirements: dict = Field(..., description="产能需求")
    procurement_schedule: dict = Field(..., description="采购时间表")
    notes: Optional[str] = Field(None, description="备注")


class LRPResultCreate(LRPResultBase):
    """LRP运算结果创建schema"""
    pass


class LRPResultResponse(LRPResultBase):
    """LRP运算结果响应schema"""
    id: int = Field(..., description="LRP结果ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class LRPResultListResponse(LRPResultResponse):
    """LRP运算结果列表响应schema（简化版）"""
    pass


# === MRP/LRP运算参数和结果（已废弃） ===
# ⚠️ 已废弃：根据《☆ 用户使用全场景推演.md》的设计理念，MRP和LRP已合并为统一的需求计算模型
# TODO: 将在统一需求计算Schema中重新实现，相关API路由已注释

class MRPComputationRequest(BaseSchema):
    """MRP运算请求"""
    forecast_id: int = Field(..., description="销售预测ID")
    planning_horizon: int = Field(30, gt=0, description="计划时域（天）")
    time_bucket: str = Field("周", description="时间段（日/周/月）")
    include_safety_stock: bool = Field(True, description="是否考虑安全库存")
    explosion_type: str = Field("single_level", description="展开类型")


class MRPComputationResult(BaseSchema):
    """MRP运算结果"""
    forecast_id: int = Field(..., description="销售预测ID")
    computation_time: datetime = Field(..., description="运算时间")
    total_materials: int = Field(..., description="涉及物料总数")
    suggested_work_orders: int = Field(..., description="建议工单总数")
    suggested_purchase_orders: int = Field(..., description="建议采购订单总数")
    material_results: List[dict] = Field(..., description="各物料运算结果")


class LRPComputationRequest(BaseSchema):
    """LRP运算请求"""
    sales_order_id: int = Field(..., description="销售订单ID")
    consider_capacity: bool = Field(True, description="是否考虑产能约束")
    consider_inventory: bool = Field(True, description="是否考虑现有库存")


class LRPComputationResult(BaseSchema):
    """LRP运算结果"""
    sales_order_id: int = Field(..., description="销售订单ID")
    computation_time: datetime = Field(..., description="运算时间")
    feasible: bool = Field(..., description="是否可行")
    production_schedule: List[dict] = Field(..., description="生产时间表")
    procurement_schedule: List[dict] = Field(..., description="采购时间表")
    capacity_utilization: dict = Field(..., description="产能利用率")


# === 高级排产 ===

class SchedulingConstraints(BaseSchema):
    """排产约束条件"""
    priority_weight: float = Field(0.3, ge=0, le=1, description="优先级权重（0-1）")
    due_date_weight: float = Field(0.3, ge=0, le=1, description="交期权重（0-1）")
    capacity_weight: float = Field(0.2, ge=0, le=1, description="产能权重（0-1）")
    setup_time_weight: float = Field(0.2, ge=0, le=1, description="换线时间权重（0-1）")
    optimize_objective: str = Field("min_makespan", description="优化目标（min_makespan/min_total_time/min_setup_time）")


class IntelligentSchedulingRequest(BaseSchema):
    """智能排产请求"""
    work_order_ids: Optional[List[int]] = Field(None, description="工单ID列表（可选，如果不提供则对所有待排产工单进行排产）")
    constraints: Optional[SchedulingConstraints] = Field(None, description="约束条件")


class ScheduledOrder(BaseSchema):
    """已排产工单"""
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    planned_end_date: Optional[datetime] = Field(None, description="计划结束时间")


class UnscheduledOrder(BaseSchema):
    """无法排产工单"""
    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    reason: str = Field(..., description="无法排产的原因")


class SchedulingStatistics(BaseSchema):
    """排产统计信息"""
    total_orders: int = Field(..., description="总工单数")
    scheduled_count: int = Field(..., description="已排产工单数")
    unscheduled_count: int = Field(..., description="无法排产工单数")
    scheduling_rate: float = Field(..., ge=0, le=1, description="排产成功率")


class IntelligentSchedulingResponse(BaseSchema):
    """智能排产响应"""
    scheduled_orders: List[ScheduledOrder] = Field(..., description="已排产的工单列表")
    unscheduled_orders: List[UnscheduledOrder] = Field(..., description="无法排产的工单列表")
    conflicts: List[Dict[str, Any]] = Field(default_factory=list, description="冲突列表")
    statistics: SchedulingStatistics = Field(..., description="统计信息")


class OptimizationParams(BaseSchema):
    """优化参数"""
    max_iterations: int = Field(100, gt=0, description="最大迭代次数")
    convergence_threshold: float = Field(0.01, gt=0, description="收敛阈值")
    optimization_objective: str = Field("min_makespan", description="优化目标")


class OptimizeScheduleRequest(BaseSchema):
    """优化排产计划请求"""
    schedule_id: Optional[int] = Field(None, description="排产计划ID（可选）")
    optimization_params: Optional[OptimizationParams] = Field(None, description="优化参数")


class OptimizeScheduleResponse(BaseSchema):
    """优化排产计划响应"""
    optimized: bool = Field(..., description="是否优化成功")
    improvement: float = Field(..., description="改进程度（百分比）")
    iterations: int = Field(..., description="迭代次数")
