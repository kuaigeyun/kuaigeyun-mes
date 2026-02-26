"""
员工绩效 Schema 模块

定义员工绩效配置、计件单价、工时单价、KPI、绩效汇总的 Pydantic Schema。
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Any, List

from pydantic import BaseModel, Field, ConfigDict


# ==================== 员工绩效配置 ====================

class EmployeePerformanceConfigBase(BaseModel):
    employee_id: int = Field(..., description="员工ID（User.id）")
    employee_name: Optional[str] = Field(None, max_length=100, description="员工姓名")
    calc_mode: str = Field("time", max_length=20, description="计算模式：time/piece/mixed")
    piece_rate_mode: Optional[str] = Field(None, max_length=20, description="计件单价来源")
    hourly_rate: Optional[Decimal] = Field(None, description="工时单价（元/小时）")
    default_piece_rate: Optional[Decimal] = Field(None, description="默认计件单价（元/件）")
    base_salary: Optional[Decimal] = Field(None, description="月保障工资（元）")
    effective_from: Optional[date] = Field(None, description="生效日期")
    effective_to: Optional[date] = Field(None, description="失效日期")
    is_active: bool = Field(True, description="是否启用")

    model_config = ConfigDict(populate_by_name=True)


class EmployeePerformanceConfigCreate(EmployeePerformanceConfigBase):
    pass


class EmployeePerformanceConfigUpdate(BaseModel):
    employee_name: Optional[str] = None
    calc_mode: Optional[str] = None
    piece_rate_mode: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    default_piece_rate: Optional[Decimal] = None
    base_salary: Optional[Decimal] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True)


class EmployeePerformanceConfigResponse(EmployeePerformanceConfigBase):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==================== 计件单价 ====================

class PieceRateBase(BaseModel):
    operation_id: int = Field(..., description="工序ID")
    operation_code: Optional[str] = Field(None, max_length=50)
    operation_name: Optional[str] = Field(None, max_length=200)
    material_id: Optional[int] = Field(None, description="物料ID（可选）")
    material_code: Optional[str] = Field(None, max_length=50)
    rate: Decimal = Field(..., description="单价（元/件）")
    effective_from: Optional[date] = Field(None, description="生效日期")
    effective_to: Optional[date] = Field(None, description="失效日期")
    is_active: bool = Field(True, description="是否启用")

    model_config = ConfigDict(populate_by_name=True)


class PieceRateCreate(PieceRateBase):
    pass


class PieceRateUpdate(BaseModel):
    operation_code: Optional[str] = None
    operation_name: Optional[str] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    rate: Optional[Decimal] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True)


class PieceRateResponse(PieceRateBase):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==================== 工时单价 ====================

class HourlyRateBase(BaseModel):
    department_id: Optional[int] = Field(None, description="部门ID")
    department_name: Optional[str] = Field(None, max_length=100)
    position_id: Optional[int] = Field(None, description="职位ID")
    position_name: Optional[str] = Field(None, max_length=100)
    rate: Decimal = Field(..., description="工时单价（元/小时）")
    effective_from: Optional[date] = Field(None, description="生效日期")
    effective_to: Optional[date] = Field(None, description="失效日期")
    is_active: bool = Field(True, description="是否启用")

    model_config = ConfigDict(populate_by_name=True)


class HourlyRateCreate(HourlyRateBase):
    pass


class HourlyRateUpdate(BaseModel):
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    position_id: Optional[int] = None
    position_name: Optional[str] = None
    rate: Optional[Decimal] = None
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True)


class HourlyRateResponse(HourlyRateBase):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==================== KPI 定义 ====================

class KPIDefinitionBase(BaseModel):
    code: str = Field(..., max_length=50, description="指标编码")
    name: str = Field(..., max_length=200, description="指标名称")
    weight: Decimal = Field(1, description="权重")
    calc_type: str = Field(..., max_length=50, description="计算类型：quality/efficiency/attendance/output")
    formula_json: Optional[Any] = Field(None, description="计算公式（JSON）")
    is_active: bool = Field(True, description="是否启用")

    model_config = ConfigDict(populate_by_name=True)


class KPIDefinitionCreate(KPIDefinitionBase):
    pass


class KPIDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    weight: Optional[Decimal] = None
    calc_type: Optional[str] = None
    formula_json: Optional[Any] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(populate_by_name=True)


class KPIDefinitionResponse(KPIDefinitionBase):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==================== 绩效汇总 ====================

class PerformanceSummaryResponse(BaseModel):
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, description="租户ID")
    employee_id: int = Field(..., description="员工ID")
    employee_name: Optional[str] = Field(None, description="员工姓名")
    period: str = Field(..., description="周期（YYYY-MM）")
    total_hours: Decimal = Field(0, description="总工时（小时）")
    total_pieces: Decimal = Field(0, description="总件数（合格）")
    total_unqualified: Decimal = Field(0, description="不合格件数")
    time_amount: Decimal = Field(0, description="计时金额（元）")
    piece_amount: Decimal = Field(0, description="计件金额（元）")
    total_amount: Decimal = Field(0, description="应发总额（元）")
    kpi_score: Optional[Decimal] = Field(None, description="KPI综合分")
    kpi_coefficient: Optional[Decimal] = Field(None, description="绩效系数")
    status: str = Field("draft", description="状态")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PerformanceDetailItem(BaseModel):
    """绩效明细项（单条报工记录）"""
    reporting_record_id: int = Field(..., description="报工记录ID")
    work_order_code: str = Field(..., description="工单编码")
    operation_name: str = Field(..., description="工序名称")
    reported_at: datetime = Field(..., description="报工时间")
    reported_quantity: Decimal = Field(0, description="报工数量")
    qualified_quantity: Decimal = Field(0, description="合格数量")
    unqualified_quantity: Decimal = Field(0, description="不合格数量")
    work_hours: Decimal = Field(0, description="工时（小时）")
    piece_rate: Optional[Decimal] = Field(None, description="计件单价")
    piece_amount: Optional[Decimal] = Field(None, description="计件金额")
    time_amount: Optional[Decimal] = Field(None, description="计时金额")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PerformanceDetailResponse(BaseModel):
    """绩效明细（含报工记录列表）"""
    employee_id: int = Field(..., description="员工ID")
    employee_name: Optional[str] = Field(None, description="员工姓名")
    period: str = Field(..., description="周期（YYYY-MM）")
    summary: Optional[PerformanceSummaryResponse] = Field(None, description="汇总信息")
    items: List[PerformanceDetailItem] = Field(default_factory=list, description="报工明细列表")

    model_config = ConfigDict(populate_by_name=True)
