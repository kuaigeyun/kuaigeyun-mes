"""可视排产 AI 助手 Schema。"""



from typing import List, Optional



from pydantic import ConfigDict, Field



from core.schemas.base import BaseSchema





class SchedulingAiExplainRequest(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    text: str = Field(..., min_length=1, description="用户问题或指令")

    work_order_ids: Optional[List[int]] = Field(None, alias="workOrderIds", description="待排池工单 ID 范围")

    plan_date: Optional[str] = Field(None, alias="planDate", description="计划日 YYYY-MM-DD")

    selected_work_order_ids: Optional[List[int]] = Field(

        None, alias="selectedWorkOrderIds", description="当前勾选工单"

    )





class SchedulingAiExplainResponse(BaseSchema):

    answer: str = Field(..., description="AI 解读回答（Markdown 纯文本）")





class SchedulingAiPriorityRequest(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    text: Optional[str] = Field(None, description="排序偏好说明")

    work_order_ids: Optional[List[int]] = Field(None, alias="workOrderIds", description="待排池工单 ID 范围")

    plan_date: Optional[str] = Field(None, alias="planDate", description="计划日 YYYY-MM-DD")

    selected_work_order_ids: Optional[List[int]] = Field(

        None, alias="selectedWorkOrderIds", description="限定在选中工单内排序"

    )





class SchedulingAiPriorityResponse(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    suggested_pool_order: List[int] = Field(

        default_factory=list, alias="suggestedPoolOrder", description="建议工单 ID 顺序"

    )

    rationale: str = Field(..., description="排序理由")

    confidence_notes: Optional[str] = Field(None, alias="confidenceNotes", description="置信度说明")





class SchedulingAiWorkOrderAdjustment(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    work_order_id: int = Field(..., alias="workOrderId")

    planned_start_date: str = Field(..., alias="plannedStartDate")

    planned_end_date: str = Field(..., alias="plannedEndDate")





class SchedulingAiOperationAdjustment(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    operation_id: int = Field(..., alias="operationId")

    planned_start_date: Optional[str] = Field(None, alias="plannedStartDate")

    planned_end_date: Optional[str] = Field(None, alias="plannedEndDate")

    assigned_station_id: Optional[int] = Field(None, alias="assignedStationId")





class SchedulingAiValidationPreview(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    valid: bool = False

    conflict_count: int = Field(0, alias="conflictCount")





class SchedulingAiProposal(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    summary: Optional[str] = None

    confidence_notes: Optional[str] = Field(None, alias="confidenceNotes")

    warnings: List[str] = Field(default_factory=list)

    work_order_adjustments: List[SchedulingAiWorkOrderAdjustment] = Field(

        default_factory=list, alias="workOrderAdjustments"

    )

    operation_adjustments: List[SchedulingAiOperationAdjustment] = Field(

        default_factory=list, alias="operationAdjustments"

    )

    pool_reorder: List[int] = Field(default_factory=list, alias="poolReorder")

    validation_preview: Optional[SchedulingAiValidationPreview] = Field(None, alias="validationPreview")





class SchedulingAiSuggestAdjustmentsRequest(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    text: str = Field(..., min_length=1)

    work_order_ids: Optional[List[int]] = Field(None, alias="workOrderIds")

    plan_date: Optional[str] = Field(None, alias="planDate")

    selected_work_order_ids: Optional[List[int]] = Field(None, alias="selectedWorkOrderIds")

    context: Optional[SchedulingAiProposal] = Field(

        None,

        description="上一轮改期提案，用于多轮修订",

    )





class SchedulingAiSuggestAdjustmentsResponse(BaseSchema):

    model_config = ConfigDict(populate_by_name=True)



    proposal: SchedulingAiProposal

