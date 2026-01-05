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

