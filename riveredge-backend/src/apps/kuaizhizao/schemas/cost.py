"""
成本核算 Schema 模块

定义成本核算相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2026-01-05
"""

from datetime import datetime, date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from decimal import Decimal


# ========== 成本核算规则 Schema ==========

class CostRuleBase(BaseModel):
    """
    成本核算规则基础Schema
    
    包含所有成本核算规则的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    code: Optional[str] = Field(None, description="规则编码（可选，创建时自动生成）")
    name: str = Field(..., description="规则名称")
    rule_type: str = Field(..., description="规则类型（材料成本、人工成本、制造费用）")
    cost_type: str = Field(..., description="成本类型（直接材料、间接材料、直接人工、间接人工、制造费用等）")
    calculation_method: str = Field(..., description="计算方法（按数量、按工时、按比例、按固定值等）")
    calculation_formula: Optional[Dict[str, Any]] = Field(None, description="计算公式（JSON格式）")
    rule_parameters: Optional[Dict[str, Any]] = Field(None, description="规则参数（JSON格式）")
    is_active: bool = Field(True, description="是否启用")
    description: Optional[str] = Field(None, description="描述")

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str) -> str:
        """验证规则类型"""
        allowed_types = ["材料成本", "人工成本", "制造费用"]
        if v not in allowed_types:
            raise ValueError(f"规则类型必须是 {allowed_types} 之一")
        return v

    @field_validator("calculation_method")
    @classmethod
    def validate_calculation_method(cls, v: str) -> str:
        """验证计算方法"""
        allowed_methods = ["按数量", "按工时", "按比例", "按固定值", "自定义公式"]
        if v not in allowed_methods:
            raise ValueError(f"计算方法必须是 {allowed_methods} 之一")
        return v


class CostRuleCreate(CostRuleBase):
    """
    成本核算规则创建Schema
    
    用于创建新成本核算规则的请求数据。
    """
    code: Optional[str] = Field(None, description="规则编码（可选，如果不提供则自动生成）")


class CostRuleUpdate(BaseModel):
    """
    成本核算规则更新Schema
    
    用于更新成本核算规则的请求数据，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    name: Optional[str] = Field(None, description="规则名称")
    rule_type: Optional[str] = Field(None, description="规则类型")
    cost_type: Optional[str] = Field(None, description="成本类型")
    calculation_method: Optional[str] = Field(None, description="计算方法")
    calculation_formula: Optional[Dict[str, Any]] = Field(None, description="计算公式（JSON格式）")
    rule_parameters: Optional[Dict[str, Any]] = Field(None, description="规则参数（JSON格式）")
    is_active: Optional[bool] = Field(None, description="是否启用")
    description: Optional[str] = Field(None, description="描述")


class CostRuleResponse(CostRuleBase):
    """
    成本核算规则响应Schema
    
    用于返回成本核算规则数据。
    """
    id: int = Field(..., description="规则ID")
    uuid: str = Field(..., description="规则UUID")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")


class CostRuleListResponse(BaseModel):
    """
    成本核算规则列表响应Schema
    
    用于返回成本核算规则列表数据。
    """
    items: List[CostRuleResponse] = Field(..., description="规则列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# ========== 成本核算记录 Schema ==========

class CostCalculationBase(BaseModel):
    """
    成本核算记录基础Schema
    
    包含所有成本核算记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    calculation_no: Optional[str] = Field(None, description="核算单号（可选，创建时自动生成）")
    calculation_type: str = Field(..., description="核算类型（工单成本、产品成本、标准成本、实际成本）")
    work_order_id: Optional[int] = Field(None, description="工单ID（工单成本核算时关联）")
    work_order_code: Optional[str] = Field(None, description="工单编码")
    product_id: Optional[int] = Field(None, description="产品ID（产品成本核算时关联）")
    product_code: Optional[str] = Field(None, description="产品编码")
    product_name: Optional[str] = Field(None, description="产品名称")
    quantity: Decimal = Field(..., description="数量")
    material_cost: Decimal = Field(0, description="材料成本")
    labor_cost: Decimal = Field(0, description="人工成本")
    manufacturing_cost: Decimal = Field(0, description="制造费用")
    total_cost: Decimal = Field(0, description="总成本")
    unit_cost: Decimal = Field(0, description="单位成本")
    cost_details: Optional[Dict[str, Any]] = Field(None, description="成本明细（JSON格式）")
    calculation_date: date = Field(..., description="核算日期")
    calculation_status: str = Field("草稿", description="核算状态（草稿、已核算、已审核）")
    remark: Optional[str] = Field(None, description="备注")

    @field_validator("calculation_type")
    @classmethod
    def validate_calculation_type(cls, v: str) -> str:
        """验证核算类型"""
        allowed_types = ["工单成本", "产品成本", "标准成本", "实际成本"]
        if v not in allowed_types:
            raise ValueError(f"核算类型必须是 {allowed_types} 之一")
        return v

    @field_validator("calculation_status")
    @classmethod
    def validate_calculation_status(cls, v: str) -> str:
        """验证核算状态"""
        allowed_statuses = ["草稿", "已核算", "已审核"]
        if v not in allowed_statuses:
            raise ValueError(f"核算状态必须是 {allowed_statuses} 之一")
        return v


class CostCalculationCreate(CostCalculationBase):
    """
    成本核算记录创建Schema
    
    用于创建新成本核算记录的请求数据。
    """
    calculation_no: Optional[str] = Field(None, description="核算单号（可选，如果不提供则自动生成）")


class CostCalculationUpdate(BaseModel):
    """
    成本核算记录更新Schema
    
    用于更新成本核算记录的请求数据，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    material_cost: Optional[Decimal] = Field(None, description="材料成本")
    labor_cost: Optional[Decimal] = Field(None, description="人工成本")
    manufacturing_cost: Optional[Decimal] = Field(None, description="制造费用")
    total_cost: Optional[Decimal] = Field(None, description="总成本")
    unit_cost: Optional[Decimal] = Field(None, description="单位成本")
    cost_details: Optional[Dict[str, Any]] = Field(None, description="成本明细（JSON格式）")
    calculation_status: Optional[str] = Field(None, description="核算状态")
    remark: Optional[str] = Field(None, description="备注")


class CostCalculationResponse(CostCalculationBase):
    """
    成本核算记录响应Schema
    
    用于返回成本核算记录数据。
    """
    id: int = Field(..., description="核算记录ID")
    uuid: str = Field(..., description="核算记录UUID")
    tenant_id: int = Field(..., description="组织ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")


class CostCalculationListResponse(BaseModel):
    """
    成本核算记录列表响应Schema
    
    用于返回成本核算记录列表数据。
    """
    items: List[CostCalculationResponse] = Field(..., description="核算记录列表")
    total: int = Field(..., description="总数量")
    skip: int = Field(..., description="跳过数量")
    limit: int = Field(..., description="限制数量")


# ========== 成本核算请求 Schema ==========

class WorkOrderCostCalculationRequest(BaseModel):
    """
    工单成本核算请求Schema
    
    用于请求核算工单成本的请求数据。
    """
    work_order_id: int = Field(..., description="工单ID")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")
    remark: Optional[str] = Field(None, description="备注")


class ProductCostCalculationRequest(BaseModel):
    """
    产品成本核算请求Schema
    
    用于请求核算产品成本的请求数据。
    """
    product_id: int = Field(..., description="产品ID")
    quantity: Decimal = Field(..., description="数量")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")
    calculation_type: str = Field("标准成本", description="核算类型（标准成本、实际成本）")
    remark: Optional[str] = Field(None, description="备注")


# ========== 成本对比 Schema ==========

class CostComparisonResponse(BaseModel):
    """
    成本对比响应Schema
    
    用于返回标准成本和实际成本对比数据。
    """
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    standard_cost: Decimal = Field(..., description="标准成本")
    actual_cost: Decimal = Field(..., description="实际成本")
    cost_difference: Decimal = Field(..., description="成本差异")
    cost_difference_rate: Decimal = Field(..., description="成本差异率（百分比）")
    material_cost_difference: Decimal = Field(..., description="材料成本差异")
    labor_cost_difference: Decimal = Field(..., description="人工成本差异")
    manufacturing_cost_difference: Decimal = Field(..., description="制造费用差异")
    difference_analysis: Optional[str] = Field(None, description="差异原因分析")


# ========== 成本分析 Schema ==========

class CostAnalysisResponse(BaseModel):
    """
    成本分析响应Schema
    
    用于返回成本分析数据。
    """
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    cost_composition: Dict[str, Decimal] = Field(..., description="成本构成（材料成本、人工成本、制造费用）")
    cost_trend: List[Dict[str, Any]] = Field(..., description="成本趋势（时间序列数据）")
    cost_breakdown: Dict[str, Any] = Field(..., description="成本明细（JSON格式）")


class CostOptimizationResponse(BaseModel):
    """
    成本优化建议响应Schema
    
    用于返回成本优化建议数据。
    """
    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    suggestions: List[Dict[str, Any]] = Field(..., description="优化建议列表")
    potential_savings: Decimal = Field(..., description="潜在节省金额")
    priority: str = Field(..., description="优先级（高、中、低）")


# ========== 生产成本核算 Schema ==========

class ProductionCostCalculationRequest(BaseModel):
    """
    生产成本核算请求Schema
    
    用于请求核算生产成本的请求数据。
    """
    material_id: int = Field(..., description="物料ID")
    quantity: Decimal = Field(..., gt=0, description="数量")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（配置件时必须提供）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class ProductionCostCalculationResponse(BaseModel):
    """
    生产成本核算响应Schema
    
    用于返回生产成本核算结果。
    """
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    source_type: str = Field(..., description="物料来源类型（Make/Buy/Phantom/Outsource/Configure）")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（配置件时提供）")
    quantity: Decimal = Field(..., description="数量")
    material_cost: Decimal = Field(..., description="材料成本")
    labor_cost: Decimal = Field(..., description="加工成本（工序成本）")
    manufacturing_cost: Decimal = Field(..., description="制造费用")
    total_cost: Decimal = Field(..., description="总成本")
    unit_cost: Decimal = Field(..., description="单位成本")
    cost_details: Dict[str, Any] = Field(..., description="成本明细（JSON格式）")
    calculation_date: date = Field(..., description="核算日期")


# ========== 委外成本核算 Schema ==========

class OutsourceCostCalculationRequest(BaseModel):
    """
    委外成本核算请求Schema
    
    用于请求核算委外成本的请求数据。
    """
    material_id: Optional[int] = Field(None, description="物料ID（委外件物料ID，用于计算标准成本）")
    outsource_work_order_id: Optional[int] = Field(None, description="委外工单ID（用于计算实际成本）")
    quantity: Optional[Decimal] = Field(None, gt=0, description="数量（计算标准成本时必须提供）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class OutsourceCostCalculationResponse(BaseModel):
    """
    委外成本核算响应Schema
    
    用于返回委外成本核算结果。
    """
    outsource_work_order_id: Optional[int] = Field(None, description="委外工单ID（实际成本时提供）")
    outsource_work_order_code: Optional[str] = Field(None, description="委外工单编码（实际成本时提供）")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    supplier_id: Optional[int] = Field(None, description="供应商ID（实际成本时提供）")
    supplier_code: Optional[str] = Field(None, description="供应商编码（实际成本时提供）")
    supplier_name: Optional[str] = Field(None, description="供应商名称（实际成本时提供）")
    source_type: str = Field("Outsource", description="物料来源类型（Outsource）")
    quantity: Decimal = Field(..., description="数量")
    material_cost: Decimal = Field(..., description="材料成本（提供给委外供应商的原材料）")
    processing_cost: Decimal = Field(..., description="委外加工费用（委外数量 × 委外单价）")
    total_cost: Decimal = Field(..., description="总成本")
    unit_cost: Decimal = Field(..., description="单位成本")
    cost_details: Dict[str, Any] = Field(..., description="成本明细（JSON格式）")
    calculation_type: str = Field(..., description="核算类型（标准成本/实际成本）")
    calculation_date: date = Field(..., description="核算日期")


# ========== 采购成本核算 Schema ==========

class PurchaseCostCalculationRequest(BaseModel):
    """
    采购成本核算请求Schema
    
    用于请求核算采购成本的请求数据。
    """
    material_id: Optional[int] = Field(None, description="物料ID（采购件物料ID，用于计算标准成本）")
    purchase_order_id: Optional[int] = Field(None, description="采购订单ID（用于计算实际成本，整单）")
    purchase_order_item_id: Optional[int] = Field(None, description="采购订单明细ID（用于计算实际成本，单个明细）")
    quantity: Optional[Decimal] = Field(None, gt=0, description="数量（计算标准成本时必须提供）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class PurchaseCostCalculationResponse(BaseModel):
    """
    采购成本核算响应Schema
    
    用于返回采购成本核算结果。
    """
    purchase_order_id: Optional[int] = Field(None, description="采购订单ID（实际成本时提供）")
    purchase_order_code: Optional[str] = Field(None, description="采购订单编码（实际成本时提供）")
    purchase_order_item_id: Optional[int] = Field(None, description="采购订单明细ID（实际成本时提供）")
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    supplier_id: Optional[int] = Field(None, description="供应商ID（实际成本时提供）")
    supplier_name: Optional[str] = Field(None, description="供应商名称（实际成本时提供）")
    source_type: str = Field("Buy", description="物料来源类型（Buy）")
    quantity: Decimal = Field(..., description="数量")
    purchase_price: Decimal = Field(..., description="采购价格")
    purchase_fee: Decimal = Field(..., description="采购费用（税费、运输费等）")
    total_cost: Decimal = Field(..., description="总成本")
    unit_cost: Decimal = Field(..., description="单位成本")
    cost_details: Dict[str, Any] = Field(..., description="成本明细（JSON格式）")
    calculation_type: str = Field(..., description="核算类型（标准成本/实际成本/实际成本（整单））")
    calculation_date: date = Field(..., description="核算日期")


# ========== 质量成本核算 Schema ==========

class QualityCostCalculationRequest(BaseModel):
    """
    质量成本核算请求Schema
    
    用于请求核算质量成本的请求数据。
    """
    start_date: Optional[date] = Field(None, description="开始日期（可选，用于统计时间范围）")
    end_date: Optional[date] = Field(None, description="结束日期（可选，用于统计时间范围）")
    material_id: Optional[int] = Field(None, description="物料ID（可选，用于核算特定物料的质量成本）")
    work_order_id: Optional[int] = Field(None, description="工单ID（可选，用于核算特定工单的质量成本）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class QualityCostCalculationResponse(BaseModel):
    """
    质量成本核算响应Schema
    
    用于返回质量成本核算结果。
    """
    prevention_cost: Decimal = Field(..., description="预防成本")
    appraisal_cost: Decimal = Field(..., description="鉴定成本")
    internal_failure_cost: Decimal = Field(..., description="内部损失成本")
    external_failure_cost: Decimal = Field(..., description="外部损失成本")
    total_quality_cost: Decimal = Field(..., description="总质量成本")
    cost_details: Dict[str, Any] = Field(..., description="成本明细（JSON格式）")
    calculation_type: str = Field("质量成本", description="核算类型")
    calculation_date: date = Field(..., description="核算日期")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    material_id: Optional[int] = Field(None, description="物料ID")
    work_order_id: Optional[int] = Field(None, description="工单ID")


# ========== 成本对比 Schema ==========

class CostComparisonRequest(BaseModel):
    """
    成本对比请求Schema
    
    用于请求对比标准成本和实际成本的请求数据。
    """
    material_id: int = Field(..., description="物料ID（必须提供，用于确定物料来源类型和计算标准成本）")
    work_order_id: Optional[int] = Field(None, description="工单ID（自制件实际成本时提供）")
    purchase_order_id: Optional[int] = Field(None, description="采购订单ID（采购件实际成本时提供，整单）")
    purchase_order_item_id: Optional[int] = Field(None, description="采购订单明细ID（采购件实际成本时提供，单个明细）")
    outsource_work_order_id: Optional[int] = Field(None, description="委外工单ID（委外件实际成本时提供）")
    quantity: Decimal = Field(..., gt=0, description="数量（计算标准成本时必须提供）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class CostComparisonResponse(BaseModel):
    """
    成本对比响应Schema
    
    用于返回标准成本和实际成本对比结果。
    """
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    source_type: str = Field(..., description="物料来源类型（Make/Buy/Outsource/Phantom/Configure）")
    quantity: Decimal = Field(..., description="数量")
    standard_cost: Dict[str, Any] = Field(..., description="标准成本")
    actual_cost: Dict[str, Any] = Field(..., description="实际成本")
    cost_variance: Dict[str, Any] = Field(..., description="成本差异")
    calculation_date: date = Field(..., description="核算日期")


class CostComparisonBySourceTypeRequest(BaseModel):
    """
    按物料来源类型对比成本请求Schema
    
    用于请求批量对比多个物料的标准成本和实际成本，按物料来源类型分组统计。
    """
    material_ids: List[int] = Field(..., min_items=1, description="物料ID列表")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class CostComparisonBySourceTypeResponse(BaseModel):
    """
    按物料来源类型对比成本响应Schema
    
    用于返回按物料来源类型分组的成本对比结果。
    """
    comparisons_by_source: Dict[str, List[Dict[str, Any]]] = Field(..., description="按物料来源类型分组的成本对比")
    source_type_summary: Dict[str, Dict[str, Any]] = Field(..., description="按物料来源类型的汇总统计")
    total_summary: Dict[str, Any] = Field(..., description="总汇总统计")
    calculation_date: date = Field(..., description="核算日期")


# ========== 成本优化建议 Schema ==========

class CostOptimizationRequest(BaseModel):
    """
    成本优化建议请求Schema
    
    用于请求生成成本优化建议的请求数据。
    """
    material_id: Optional[int] = Field(None, description="物料ID（单个物料分析）")
    material_ids: Optional[List[int]] = Field(None, min_items=1, description="物料ID列表（批量分析）")
    quantity: Decimal = Field(Decimal(1), gt=0, description="数量（用于计算成本，默认1）")
    calculation_date: Optional[date] = Field(None, description="核算日期（可选，默认为当前日期）")


class CostOptimizationResponse(BaseModel):
    """
    成本优化建议响应Schema
    
    用于返回成本优化建议结果。
    """
    material_id: Optional[int] = Field(None, description="物料ID（单个物料分析时提供）")
    material_code: Optional[str] = Field(None, description="物料编码（单个物料分析时提供）")
    material_name: Optional[str] = Field(None, description="物料名称（单个物料分析时提供）")
    current_source_type: Optional[str] = Field(None, description="当前来源类型（单个物料分析时提供）")
    current_cost: Optional[Dict[str, Any]] = Field(None, description="当前成本（单个物料分析时提供）")
    alternative_costs: Optional[Dict[str, Dict[str, Any]]] = Field(None, description="其他来源类型的成本（单个物料分析时提供）")
    suggestions: List[Dict[str, Any]] = Field(..., description="优化建议列表")
    calculation_date: date = Field(..., description="核算日期")


class CostOptimizationBatchResponse(BaseModel):
    """
    批量成本优化建议响应Schema
    
    用于返回批量物料的成本优化建议结果。
    """
    materials_count: int = Field(..., description="物料数量")
    suggestions: List[CostOptimizationResponse] = Field(..., description="各物料的优化建议列表")
    total_potential_savings: Decimal = Field(..., description="总潜在节约成本")
    calculation_date: date = Field(..., description="核算日期")


# ========== 成本报表分析 Schema ==========

class CostTrendAnalysisRequest(BaseModel):
    """
    成本趋势分析请求Schema
    
    用于请求成本趋势分析的请求数据。
    """
    start_date: date = Field(..., description="开始日期")
    end_date: date = Field(..., description="结束日期")
    material_id: Optional[int] = Field(None, description="物料ID（可选，用于分析特定物料）")
    source_type: Optional[str] = Field(None, description="物料来源类型（可选，用于按来源类型筛选）")
    group_by: str = Field("month", description="分组方式（month/week/day，默认month）")


class CostTrendAnalysisResponse(BaseModel):
    """
    成本趋势分析响应Schema
    
    用于返回成本趋势分析结果。
    """
    start_date: date = Field(..., description="开始日期")
    end_date: date = Field(..., description="结束日期")
    group_by: str = Field(..., description="分组方式")
    trend_data: List[Dict[str, Any]] = Field(..., description="趋势数据列表")
    summary: Dict[str, Any] = Field(..., description="汇总统计")


class CostStructureAnalysisRequest(BaseModel):
    """
    成本结构分析请求Schema
    
    用于请求成本结构分析的请求数据。
    """
    start_date: Optional[date] = Field(None, description="开始日期（可选）")
    end_date: Optional[date] = Field(None, description="结束日期（可选）")
    material_id: Optional[int] = Field(None, description="物料ID（可选，用于分析特定物料）")
    source_type: Optional[str] = Field(None, description="物料来源类型（可选，用于按来源类型筛选）")


class CostStructureAnalysisResponse(BaseModel):
    """
    成本结构分析响应Schema
    
    用于返回成本结构分析结果。
    """
    total_cost: float = Field(..., description="总成本")
    cost_composition: Dict[str, float] = Field(..., description="成本构成（材料成本、人工成本、制造费用）")
    cost_rates: Dict[str, float] = Field(..., description="成本占比（材料成本率、人工成本率、制造费用率）")
    by_source_type: Dict[str, Dict[str, Any]] = Field(..., description="按物料来源类型的成本结构")
    summary: Dict[str, Any] = Field(..., description="汇总统计")


class CostReportRequest(BaseModel):
    """
    成本报表请求Schema
    
    用于请求生成成本报表的请求数据。
    """
    report_type: str = Field(..., description="报表类型（trend/structure/comprehensive）")
    start_date: Optional[date] = Field(None, description="开始日期（可选，默认最近30天）")
    end_date: Optional[date] = Field(None, description="结束日期（可选，默认今天）")
    material_id: Optional[int] = Field(None, description="物料ID（可选）")
    source_type: Optional[str] = Field(None, description="物料来源类型（可选）")
    group_by: str = Field("month", description="分组方式（month/week/day，默认month）")


class CostReportResponse(BaseModel):
    """
    成本报表响应Schema
    
    用于返回成本报表数据。
    """
    report_type: str = Field(..., description="报表类型")
    start_date: date = Field(..., description="开始日期")
    end_date: date = Field(..., description="结束日期")
    material_id: Optional[int] = Field(None, description="物料ID")
    source_type: Optional[str] = Field(None, description="物料来源类型")
    generated_at: str = Field(..., description="生成时间")
    trend_analysis: Optional[CostTrendAnalysisResponse] = Field(None, description="成本趋势分析（trend或comprehensive时提供）")
    structure_analysis: Optional[CostStructureAnalysisResponse] = Field(None, description="成本结构分析（structure或comprehensive时提供）")

