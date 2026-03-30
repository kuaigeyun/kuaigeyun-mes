"""
报工记录数据验证Schema模块

定义报工记录相关的Pydantic数据验证Schema。
"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class ReportingRecordBase(BaseModel):
    """
    报工记录基础Schema

    包含所有报工记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    work_order_id: int = Field(..., description="工单ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_name: str = Field(..., description="工单名称")
    operation_id: int = Field(..., description="工序ID")
    operation_code: str = Field(..., description="工序编码")
    operation_name: str = Field(..., description="工序名称")
    worker_id: int = Field(..., description="操作工ID")
    worker_name: str = Field(..., description="操作工姓名")
    reported_quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    unqualified_quantity: Decimal = Field(..., description="不合格数量")
    work_hours: Decimal = Field(..., description="工时（小时）")
    status: str = Field("pending", description="审核状态")
    reported_at: datetime = Field(..., description="报工时间")
    remarks: Optional[str] = Field(None, description="备注")
    device_info: Optional[Any] = Field(None, description="设备信息")
    sop_parameters: Optional[Any] = Field(None, description="SOP参数数据（JSON格式，存储报工时收集的SOP参数）")


class ReportingRecordCreate(ReportingRecordBase):
    """
    报工记录创建Schema

    用于创建新报工记录的数据验证。
    """
    pass


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
    approved_at: Optional[datetime] = Field(None, description="审核时间")
    approved_by: Optional[int] = Field(None, description="审核人ID")
    approved_by_name: Optional[str] = Field(None, description="审核人姓名")
    rejection_reason: Optional[str] = Field(None, description="驳回原因")
    device_info: Optional[Any] = Field(None, description="设备信息")
    sop_parameters: Optional[Any] = Field(None, description="SOP参数数据（JSON格式）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ReportingRecordListResponse(BaseModel):
    """
    报工记录列表响应Schema

    用于报工记录列表API的响应数据格式。
    """
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="报工记录ID")
    uuid: str = Field(..., description="业务ID")
    work_order_code: str = Field(..., description="工单编码")
    work_order_name: str = Field(..., description="工单名称")
    operation_name: str = Field(..., description="工序名称")
    worker_name: str = Field(..., description="操作工姓名")
    reported_quantity: Decimal = Field(..., description="报工数量")
    qualified_quantity: Decimal = Field(..., description="合格数量")
    unqualified_quantity: Decimal = Field(..., description="不合格数量")
    work_hours: Decimal = Field(..., description="工时（小时）")
    status: str = Field(..., description="审核状态")
    reported_at: datetime = Field(..., description="报工时间")
    created_at: datetime = Field(..., description="创建时间")


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


class ReportingWorkerStatisticsItemResponse(BaseModel):
    """按操作工统计项。"""

    worker_name: str = Field(..., description="操作工姓名")
    count: int = Field(..., description="报工次数")
    reported_quantity: float = Field(..., description="报工数量")
    qualified_quantity: float = Field(..., description="合格数量")
    work_hours: float = Field(..., description="工时")
    qualification_rate: float = Field(..., description="合格率")


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
