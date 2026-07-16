"""可视排产 API Schema。"""



from typing import Any, Dict, List, Optional



from pydantic import Field



from core.schemas.base import BaseSchema





class VisualSchedulingScanRequest(BaseSchema):

    work_order_ids: Optional[List[int]] = Field(None, description="限定工单范围")

    work_center_id: Optional[int] = Field(None, description="工作中心筛选")

    horizon_days: int = Field(14, ge=1, le=90, description="负荷统计天数")





class VisualSchedulingConflictItem(BaseSchema):

    type: str = Field(..., description="冲突类型")

    work_order_id: Optional[int] = None

    work_order_code: Optional[str] = None

    operation_id: Optional[int] = None

    task_id: Optional[str] = Field(None, description="甘特任务 id，如 op-123")

    station_id: Optional[int] = None

    resource_id: Optional[int] = None

    message: str = Field(..., description="说明")





class VisualSchedulingMaterialIssueItem(BaseSchema):

    work_order_id: int

    work_order_code: str

    readiness_rate: Optional[float] = None

    message: str





class VisualSchedulingUnscheduledItem(BaseSchema):

    work_order_id: int

    work_order_code: str

    reason: str





class VisualSchedulingLoadItem(BaseSchema):

    work_center_id: int

    work_center_name: str

    day: str

    hours: float

    rate: float

    overloaded: bool = False





class VisualSchedulingStationLoadItem(BaseSchema):

    station_id: int

    station_name: str

    day: str

    hours: float

    rate: float

    overloaded: bool = False





class VisualSchedulingScanResponse(BaseSchema):

    conflicts: List[VisualSchedulingConflictItem] = Field(default_factory=list)

    unscheduled_orders: List[VisualSchedulingUnscheduledItem] = Field(default_factory=list)

    material_issues: List[VisualSchedulingMaterialIssueItem] = Field(default_factory=list)

    load_by_work_center: List[VisualSchedulingLoadItem] = Field(default_factory=list)

    load_by_station: List[VisualSchedulingStationLoadItem] = Field(default_factory=list)

    conflict_count: int = 0

    unscheduled_count: int = 0

    material_issue_count: int = 0

    overloaded_station_count: int = 0





class WorkOrderDateAdjustment(BaseSchema):

    work_order_id: int

    planned_start_date: str

    planned_end_date: str





class OperationDateAdjustment(BaseSchema):

    operation_id: int

    planned_start_date: str

    planned_end_date: str





class OperationStationAdjustment(BaseSchema):

    operation_id: int

    assigned_station_id: int





class VisualSchedulingValidateRequest(BaseSchema):

    work_order_updates: List[WorkOrderDateAdjustment] = Field(default_factory=list)

    operation_updates: List[OperationDateAdjustment] = Field(default_factory=list)

    operation_station_updates: List[OperationStationAdjustment] = Field(default_factory=list)





class VisualSchedulingValidateResponse(BaseSchema):

    valid: bool

    conflicts: List[VisualSchedulingConflictItem] = Field(default_factory=list)

    conflict_count: int = 0





class BatchUpdateFailureItem(BaseSchema):

    id: int

    reason: str





class WorkOrderBatchUpdateDatesResult(BaseSchema):

    updated: List[int] = Field(default_factory=list)

    skipped_frozen: List[int] = Field(default_factory=list)

    skipped_freeze_window: List[int] = Field(default_factory=list)

    failed: List[BatchUpdateFailureItem] = Field(default_factory=list)





class OperationBatchUpdateDatesResult(BaseSchema):

    updated: List[int] = Field(default_factory=list)

    skipped_frozen: List[int] = Field(default_factory=list)

    skipped_freeze_window: List[int] = Field(default_factory=list)

    failed: List[BatchUpdateFailureItem] = Field(default_factory=list)





class OperationBatchUpdateStationsResult(BaseSchema):

    updated: List[int] = Field(default_factory=list)

    skipped_frozen: List[int] = Field(default_factory=list)

    failed: List[BatchUpdateFailureItem] = Field(default_factory=list)





class OperationBatchUpdateAssignmentsResult(BaseSchema):

    updated: List[int] = Field(default_factory=list)

    skipped_frozen: List[int] = Field(default_factory=list)

    failed: List[BatchUpdateFailureItem] = Field(default_factory=list)





class SchedulingRateCoverageInputItem(BaseSchema):

    worker_id: int

    operation_id: int

    material_id: Optional[int] = None





class SchedulingRateCoverageItem(BaseSchema):

    worker_id: int

    operation_id: int

    material_id: Optional[int] = None

    missing: List[str] = Field(default_factory=list, description="缺失项：hourly_rate/piece_rate")

    calc_mode: Optional[str] = None





class SchedulingRateCoverageRequest(BaseSchema):

    items: List[SchedulingRateCoverageInputItem] = Field(default_factory=list)





class SchedulingRateCoverageResponse(BaseSchema):

    items: List[SchedulingRateCoverageItem] = Field(default_factory=list)





class SchedulingAutoRescheduleRequest(BaseSchema):

    work_order_ids: List[int] = Field(default_factory=list, description="待重排工单ID")

    scope: str = Field("selected", description="selected/overdue/unscheduled")

    plan_date: Optional[str] = Field(None, description="滚动计划日（可选）")





class SchedulingAdjustmentProposal(BaseSchema):

    summary: Optional[str] = None

    warnings: List[str] = Field(default_factory=list)

    unfreezed: List[int] = Field(default_factory=list, description="自动重排时已解冻的逾期工单 ID")

    work_order_adjustments: List[WorkOrderDateAdjustment] = Field(default_factory=list)

    operation_adjustments: List[OperationDateAdjustment] = Field(default_factory=list)

    operation_station_adjustments: List[OperationStationAdjustment] = Field(default_factory=list)





class SchedulingAutoRescheduleResponse(BaseSchema):

    proposal: SchedulingAdjustmentProposal





class SchedulingDeepLinkMixin(BaseSchema):

    scheduling_deep_link: Optional[str] = Field(None, description="可视排产页深链")

    scheduling_notice: Optional[str] = Field(None, description="提示文案")

