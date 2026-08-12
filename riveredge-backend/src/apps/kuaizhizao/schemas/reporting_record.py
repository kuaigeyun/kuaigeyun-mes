"""
报工记录数据验证Schema模块

定义报工记录相关的Pydantic数据验证Schema。
"""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator
from decimal import Decimal

from core.schemas.base import BaseSchema
from apps.kuaizhizao.services.document_action_policy.types import ReportingRecordCapabilities


class ReportingRecordBase(BaseSchema):
    """
    报工记录基础Schema

    包含所有报工记录的基本字段。
    """
    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_name: str = Field(..., description="工单名称")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    worker_id: Optional[int] = Field(None, description="操作工ID（生产人员；按小组报工时可空）")
    worker_name: Optional[str] = Field(None, description="操作工姓名（生产人员）")
    team_id: Optional[int] = Field(None, description="工作小组ID")
    team_name: Optional[str] = Field(None, max_length=100, description="工作小组名称")
    reported_quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    unqualified_quantity: Decimal = Field(..., description="不合格数量")
    work_hours: Decimal = Field(..., description="工时（小时）")
    work_start_time: Optional[datetime] = Field(None, description="工序开始时间")
    work_end_time: Optional[datetime] = Field(None, description="工序完成时间")
    status: str = Field("pending", description="审核状态")
    reported_at: datetime = Field(..., description="报工时间")
    remarks: Optional[str] = Field(None, description="备注")
    device_info: Optional[Any] = Field(None, description="设备信息")
    sop_parameters: Optional[Any] = Field(None, description="SOP参数数据（JSON格式，存储报工时收集的SOP参数）")
    inbound_warehouse_id: Optional[int] = Field(None, description="末道工序入库仓库 ID")
    inbound_warehouse_name: Optional[str] = Field(None, description="末道工序入库仓库名称")


class ReportingRecordCreate(ReportingRecordBase):
    """
    报工记录创建Schema

    用于创建新报工记录的数据验证。须指定生产人员或工作小组。
    """

    @model_validator(mode="before")
    @classmethod
    def validate_producer(cls, data: Any):
        if not isinstance(data, dict):
            return data
        has_worker = data.get("worker_id") is not None
        has_team = data.get("team_id") is not None
        if not has_worker and not has_team:
            raise ValueError("须指定生产人员或工作小组")
        if has_team:
            name = (data.get("team_name") or "").strip()
            if not name:
                raise ValueError("工作小组名称必填")
            data["team_name"] = name
            if not (str(data.get("worker_name") or "").strip()):
                data["worker_name"] = name
        elif has_worker and not (str(data.get("worker_name") or "").strip()):
            raise ValueError("生产人员姓名必填")
        return data


class ReportingRecordUpdate(BaseModel):
    """
    报工记录更新Schema

    用于更新报工记录的数据验证，允许部分字段更新。
    """
    model_config = ConfigDict(from_attributes=True)

    reported_quantity: Optional[Decimal] = Field(None, description="报工数量")
    qualified_quantity: Optional[Decimal] = Field(None, description="合格数量")
    unqualified_quantity: Optional[Decimal] = Field(None, description="不合格数量")
    work_hours: Optional[Decimal] = Field(None, description="工时（小时）")
    work_start_time: Optional[datetime] = Field(None, description="工序开始时间")
    work_end_time: Optional[datetime] = Field(None, description="工序完成时间")
    reported_at: Optional[datetime] = Field(None, description="报工时间")
    remarks: Optional[str] = Field(None, description="备注")
    sop_parameters: Optional[Any] = Field(None, description="SOP参数数据（JSON格式）")
    status: Optional[str] = Field(None, description="审核状态")
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_by_name: Optional[str] = Field(None, description="审核人姓名")
    rejection_reason: Optional[str] = Field(None, description="驳回原因")


class ReportingRecordResponse(ReportingRecordBase):
    """
    报工记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="报工记录ID")
    uuid: str = Field(..., description="业务ID")
    tenant_id: int = Field(..., description="组织ID")
    rework_order_id: Optional[int] = Field(None, description="返工单 ID（返工报工时有值）")
    recorded_by: Optional[int] = Field(None, description="记录人用户ID（提交报工者）")
    recorded_by_name: Optional[str] = Field(None, description="记录人姓名")
    rework_order_id: Optional[int] = Field(None, description="返工单 ID（返工报工时有值）")
    approved_at: Optional[datetime] = Field(None, description="审核时间")
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_by_name: Optional[str] = Field(None, description="审核人姓名")
    rejection_reason: Optional[str] = Field(None, description="驳回原因")
    inbound_warehouse_id: Optional[int] = Field(None, description="末道工序入库仓库 ID")
    inbound_warehouse_name: Optional[str] = Field(None, description="末道工序入库仓库名称")
    device_info: Optional[Any] = Field(None, description="设备信息")
    sop_parameters: Optional[Any] = Field(None, description="SOP参数数据（JSON格式）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    capabilities: Optional[ReportingRecordCapabilities] = Field(
        None, description="业务态动作能力（document_action_policy）"
    )


class ReportingRecordListResponse(BaseSchema):
    """
    报工记录列表响应Schema

    用于报工记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="报工记录ID")
    uuid: str = Field(..., description="业务ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_name: str = Field(..., description="工单名称")
    operation_code: Optional[str] = Field(None, description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    product_name: Optional[str] = Field(None, description="产品名称（来自工单）")
    product_code: Optional[str] = Field(None, description="产品编码（来自工单）")
    material_spec: Optional[str] = Field(None, description="产品规格（来自物料主数据）")
    worker_name: Optional[str] = Field(None, description="操作工姓名（生产人员）")
    team_id: Optional[int] = Field(None, description="工作小组ID")
    team_name: Optional[str] = Field(None, description="工作小组名称")
    recorded_by_name: Optional[str] = Field(None, description="记录人姓名")
    reported_quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    unqualified_quantity: Decimal = Field(..., description="不合格数量")
    work_hours: Decimal = Field(..., description="工时（小时）")
    status: str = Field(..., description="审核状态")
    reported_at: datetime = Field(..., description="报工时间")
    created_at: datetime = Field(..., description="创建时间")
    lifecycle: Optional[dict] = Field(None, description="生命周期（后端计算）")
    capabilities: Optional[ReportingRecordCapabilities] = Field(
        None, description="业务态动作能力（document_action_policy）"
    )
    audit: Optional[Dict[str, Any]] = Field(
        None,
        description="审核相位（唯一来源：{entity_type, phase, enabled, allowed_actions}，供 uni-audit 渲染）",
    )


class ReportingStatisticsTrendsResponse(BaseModel):
    """报工统计趋势数据。"""

    hours: list[float] = Field(default_factory=list, description="工时趋势")
    wages: list[float] = Field(default_factory=list, description="工资趋势")
    efficiency: list[float] = Field(default_factory=list, description="效率趋势")


class ReportingOverviewStatisticsResponse(BaseModel):
    """报工概览统计（指标卡片）。"""

    cumulative_hours: float = Field(0, description="累计工时")
    estimated_wages: float = Field(0, description="预估工资")
    downtime_records: int = Field(0, description="停机记录数")
    exception_reports: int = Field(0, description="异常报工数")
    efficiency: float = Field(0, description="效率")
    trends: ReportingStatisticsTrendsResponse = Field(
        default_factory=ReportingStatisticsTrendsResponse,
        description="趋势数据",
    )


class ReportingOperationStatisticsItemResponse(BaseModel):
    """按工序统计项。"""

    operation_name: str = Field(..., description="工序名称")
    count: int = Field(..., description="报工次数")
    reported_quantity: float = Field(..., description="报工数量")
    qualified_quantity: float = Field(..., description="合格数量")
    work_hours: float = Field(..., description="工时")
    qualification_rate: float = Field(..., description="合格率")
    first_pass_yield_rate: float = Field(0, description="直通率（首次报工，不含返工后再合格）")


class ReportingWorkerStatisticsItemResponse(BaseModel):
    """按操作工统计项。"""

    worker_name: str = Field(..., description="操作工姓名")
    count: int = Field(..., description="报工次数")
    reported_quantity: float = Field(..., description="报工数量")
    qualified_quantity: float = Field(..., description="合格数量")
    work_hours: float = Field(..., description="工时")
    qualification_rate: float = Field(..., description="合格率")
    first_pass_yield_rate: float = Field(0, description="直通率（首次报工，不含返工后再合格）")


class ReportingPullCandidateItem(BaseSchema):
    """报工加载源（工单工序）候选行。"""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        arbitrary_types_allowed=True,
    )

    pull_row_key: str = Field(..., description="行键 work_order_id-operation_id")
    work_order_id: int = Field(..., description="工单ID")
    code: str = Field(..., description="工单编码")
    name: Optional[str] = Field(None, description="工单名称")
    product_name: Optional[str] = Field(None, description="产品名称")
    quantity: Decimal = Field(..., description="工单计划数量")
    planned_start_date: Optional[datetime] = Field(None, description="计划开始时间")
    operation_id: int = Field(..., description="工序主数据ID")
    operation_code: Optional[str] = Field(None, description="工序编码")
    operation_name: Optional[str] = Field(None, description="工序名称")
    operation_sequence: Optional[int] = Field(None, description="工序顺序")
    reportable_quantity_cap: Decimal = Field(
        ...,
        description="计划侧可累计完成上限（规则超报与不合格补报取较大；已报+本次可报不超过该值，前序不足时本次可报更小）",
    )
    reportable_quantity_pushed: Decimal = Field(..., description="已报工数量")
    reportable_quantity_max: Decimal = Field(..., description="本次可报剩余")


class ReportingPullCandidateListResponse(BaseModel):
    """报工加载源分页列表。"""

    data: list[ReportingPullCandidateItem] = Field(default_factory=list)
    total: int = Field(0, description="总行数")
    success: bool = Field(True)


class ReportingDetailedStatisticsResponse(BaseModel):
    """报工详细统计。"""

    total_count: int = Field(0, description="总报工数")
    pending_count: int = Field(0, description="待审核数")
    approved_count: int = Field(0, description="已审核数")
    rejected_count: int = Field(0, description="已驳回数")
    total_reported_quantity: float = Field(0, description="总报工数量")
    total_qualified_quantity: float = Field(0, description="总合格数量")
    total_unqualified_quantity: float = Field(0, description="总不合格数量")
    total_work_hours: float = Field(0, description="总工时")
    cumulative_hours: float = Field(0, description="累计工时")
    estimated_wages: float = Field(0, description="预估工资")
    qualification_rate: float = Field(0, description="合格率")
    first_pass_yield_rate: float = Field(0, description="直通率（首次报工，不含返工后再合格）")
    first_pass_reported_quantity: float = Field(0, description="首次报工数量")
    first_pass_qualified_quantity: float = Field(0, description="首次报工合格数量")
    unqualified_rate: float = Field(0, description="不合格率")
    avg_quantity_per_hour: float = Field(0, description="平均每小时报工数量")
    efficiency: float = Field(0, description="效率")
    operation_stats: list[ReportingOperationStatisticsItemResponse] = Field(
        default_factory=list,
        description="按工序统计",
    )
    worker_stats: list[ReportingWorkerStatisticsItemResponse] = Field(
        default_factory=list,
        description="按操作工统计",
    )
    trends: ReportingStatisticsTrendsResponse = Field(
        default_factory=ReportingStatisticsTrendsResponse,
        description="趋势数据",
    )
