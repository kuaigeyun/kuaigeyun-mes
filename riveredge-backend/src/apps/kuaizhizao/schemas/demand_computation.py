"""
统一需求计算Schema

提供统一需求计算相关的数据验证Schema。

Author: Luigi Lu
Date: 2025-01-14

computation_params（MRP）中小企业常用键白名单（JSON 存取，与前端表单一致）：

- 净算与库存：include_safety_stock, include_in_transit, include_reserved, include_reorder_point；
  safety_stock / reorder_point（全局覆盖物料主数据）。
- 建议量依据：mrp_suggestion_basis: "net" | "gross"（默认 net）。
  net=建议工单/采购/委外量按净需求，供需净算四项按参数参与；
  gross=建议量按毛需求（BOM 汇总），服务端强制关闭安全库存/在途/预留/再订货点对净需求的参与，与前端隐藏供需净算一致。
- 仓库范围：warehouse_ids: int[]；缺省时后端按全部启用且 warehouse_type=normal 的仓库汇总线边库存；
  MaterialBatch 主仓批次不按仓过滤（全量计入）。
- 时间窗：planning_horizon: int（天），有交期的需求行交期晚于「今天+horizon」则跳过；缺省或 <=0 不裁剪。
- BOM：bom_version, material_bom_versions；bom_expand_level: int（1–100，展开最大层级，默认 10）。
- 建议量：apply_lot_sizing: bool（默认 true）；suggested_qty_min / suggested_qty_max / suggested_qty_multiple（全局覆盖）；
  物料级规则：defaults.purchase（Buy）与 defaults.production（Make/Outsource）中的 min/max/multiple 等别名键。
- 排程缓冲：schedule_buffer_days: int（≥0，默认 0），在物料来源提前期基础上，将计划开工/请购日再整体向前多留若干天（中小企业应对波动）。
- 4M（仅占位，供排产扩展）：consider_capacity, consider_material_readiness,
  consider_equipment_availability, consider_mold_tool_availability；当前不参与净算与建议量，仅保留配置键。
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, model_validator

from apps.kuaizhizao.services.document_action_policy.types import DemandComputationCapabilities


class DemandComputationItemBase(BaseModel):
    """需求计算明细基础Schema"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="物料规格")
    material_unit: str = Field(..., max_length=20, description="物料单位")
    
    # 物料来源信息（核心功能，新增）
    material_source_type: Optional[str] = Field(None, max_length=20, description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）")
    material_source_config: Optional[Dict[str, Any]] = Field(None, description="物料来源配置信息（JSON格式）")
    source_validation_passed: bool = Field(True, description="物料来源验证是否通过")
    source_validation_errors: Optional[List[str]] = Field(None, description="物料来源验证错误信息列表")
    
    # 需求信息（通用）
    required_quantity: Decimal = Field(..., ge=0, description="需求数量")
    available_inventory: Decimal = Field(0, ge=0, description="可用库存")
    net_requirement: Decimal = Field(..., ge=0, description="净需求")
    
    # MRP专用字段
    gross_requirement: Optional[Decimal] = Field(None, ge=0, description="毛需求（MRP专用）")
    safety_stock: Optional[Decimal] = Field(None, ge=0, description="安全库存（MRP专用）")
    reorder_point: Optional[Decimal] = Field(None, ge=0, description="再订货点（MRP专用）")
    planned_receipt: Optional[Decimal] = Field(None, ge=0, description="计划入库（MRP专用）")
    planned_release: Optional[Decimal] = Field(None, ge=0, description="计划发放（MRP专用）")
    
    # LRP专用字段
    delivery_date: Optional[date] = Field(None, description="交货日期（LRP专用）")
    planned_production: Optional[Decimal] = Field(None, ge=0, description="计划生产（LRP专用）")
    planned_procurement: Optional[Decimal] = Field(None, ge=0, description="计划采购（LRP专用）")
    production_start_date: Optional[date] = Field(None, description="生产开始日期（LRP专用）")
    production_completion_date: Optional[date] = Field(None, description="生产完成日期（LRP专用）")
    procurement_start_date: Optional[date] = Field(None, description="采购开始日期（LRP专用）")
    procurement_completion_date: Optional[date] = Field(None, description="采购完成日期（LRP专用）")
    
    # BOM信息
    bom_id: Optional[int] = Field(None, description="使用的BOM ID")
    bom_version: Optional[str] = Field(None, max_length=20, description="BOM版本")
    
    # 建议行动
    suggested_work_order_quantity: Optional[Decimal] = Field(None, ge=0, description="建议工单数量")
    suggested_purchase_order_quantity: Optional[Decimal] = Field(None, ge=0, description="建议采购订单数量")
    
    # 详细结果
    detail_results: Optional[Dict[str, Any]] = Field(None, description="详细结果（JSON格式）")
    notes: Optional[str] = Field(None, description="备注")


class DemandComputationBase(BaseModel):
    """需求计算基础Schema"""
    demand_id: Optional[int] = Field(None, description="需求ID（单需求时使用）")
    demand_ids: Optional[List[int]] = Field(None, description="需求ID列表（多需求合并时使用，与 demand_id 二选一）")
    computation_type: str = Field("MRP", max_length=20, description="计算类型（仅 MRP；传入 LRP 时归一为 MRP）")
    computation_params: Dict[str, Any] = Field(
        ...,
        description="计算参数 JSON；键说明见模块文档 computation_params 白名单",
    )
    notes: Optional[str] = Field(None, description="备注")
    
    @field_validator("computation_type")
    @classmethod
    def validate_computation_type(cls, v):
        """仅允许 MRP；旧客户端传 LRP 时归一为 MRP"""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "MRP"
        if v == "LRP":
            return "MRP"
        if v != "MRP":
            raise ValueError("计算类型必须为 MRP")
        return v

    @field_validator("demand_ids")
    @classmethod
    def validate_demand_ids(cls, v):
        """demand_ids 不能为空列表"""
        if v is not None and len(v) == 0:
            raise ValueError("demand_ids 不能为空列表")
        return v

    @model_validator(mode="after")
    def validate_demand_source(self):
        """demand_id 与 demand_ids 二选一，至少提供一个"""
        if self.demand_id is None and (self.demand_ids is None or len(self.demand_ids) == 0):
            raise ValueError("必须提供 demand_id 或 demand_ids")
        if self.demand_id is not None and self.demand_ids is not None:
            raise ValueError("demand_id 与 demand_ids 二选一，不能同时提供")
        return self


class DemandComputationCreate(DemandComputationBase):
    """创建需求计算Schema"""
    items: Optional[List[DemandComputationItemBase]] = Field(default_factory=list, description="计算结果明细列表")


class ExecuteComputationRequest(BaseModel):
    """执行需求计算请求Schema（可选临时覆盖参数）"""
    computation_params: Optional[Dict[str, Any]] = Field(
        None,
        description="临时覆盖的计算参数，仅本次执行生效，不持久化"
    )


class DemandComputationReadinessGapItem(BaseModel):
    """需求计算执行前：物料主数据缺失项"""
    material_id: int
    material_uuid: str
    material_code: str
    material_name: str
    source_type: Optional[str] = None
    field: str = Field(..., description="补齐字段路径，如 source_config.production_lead_time")
    label: str = Field(..., description="展示文案")
    current: Optional[Any] = None
    suggested: Optional[Any] = Field(None, description="表单初值，不静默生效")
    value_type: str = Field("number", description="number|int|supplier_id")


class DemandComputationReadinessResponse(BaseModel):
    ready: bool = True
    gaps: List[DemandComputationReadinessGapItem] = Field(default_factory=list)
    material_count: int = 0
    gap_count: int = 0


class DemandComputationMaterialBackfillItem(BaseModel):
    material_id: int
    field: str
    value: Any


class DemandComputationMaterialBackfillRequest(BaseModel):
    items: List[DemandComputationMaterialBackfillItem] = Field(..., min_length=1)


class DemandComputationMaterialBackfillResponse(BaseModel):
    updated_material_ids: List[int] = Field(default_factory=list)
    updated_count: int = 0


class DemandComputationUpdate(BaseModel):
    """更新需求计算Schema"""
    computation_status: Optional[str] = Field(None, max_length=20, description="计算状态")
    computation_summary: Optional[Dict[str, Any]] = Field(None, description="计算结果汇总")
    error_message: Optional[str] = Field(None, description="错误信息")
    notes: Optional[str] = Field(None, description="备注")


class DemandComputationItemResponse(DemandComputationItemBase):
    """需求计算明细响应Schema"""
    id: int
    computation_id: int
    
    # 计划员赋能增强字段 (Computed)
    readiness_status: Optional[str] = Field(None, description="物料就绪状态 (Ready/Partial/Shortage)")
    readiness_rate: Optional[float] = Field(None, description="库存就绪比例 (0.0-1.0)")
    is_overdue_risk: bool = Field(False, description="是否存在交期风险")
    
    class Config:
        from_attributes = True


class DemandComputationResponse(DemandComputationBase):
    """需求计算响应Schema"""
    id: int
    uuid: str
    tenant_id: int
    computation_code: str
    demand_code: str
    demand_type: str
    business_mode: str
    computation_status: str
    computation_start_time: Optional[datetime]
    computation_end_time: Optional[datetime]
    computation_summary: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    items: Optional[List[DemandComputationItemResponse]] = Field(default_factory=list)
    downstream_push_progress: Optional[float] = Field(
        None, description="下推进度 0-100（列表用）"
    )
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算，供 UniLifecycleStepper 展示）")
    capabilities: Optional[DemandComputationCapabilities] = Field(
        None,
        description="业务态动作 capabilities（不含 RBAC）",
    )

    class Config:
        from_attributes = True
