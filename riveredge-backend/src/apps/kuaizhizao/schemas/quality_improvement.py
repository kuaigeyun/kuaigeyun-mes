"""
质量改进模块 Schema

包含 8D、不合格品台账扩展、OQC、SPC 的请求/响应定义。
"""

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema
from apps.kuaizhizao.services.document_action_policy.types import (
    OQCInspectionCapabilities,
    EightDReportCapabilities,
)


class Quality8DBase(BaseSchema):
    quality_exception_id: Optional[int] = Field(None, description="关联质量异常ID")
    defect_record_id: Optional[int] = Field(None, description="关联不合格品台账ID")
    title: str = Field(..., description="8D 标题")
    status: str = Field("d1_team", description="8D 当前阶段")
    severity: str = Field("major", description="严重级别")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    owner_name: Optional[str] = Field(None, description="负责人姓名")
    due_date: Optional[datetime] = Field(None, description="计划完成日期")
    d1_team: Optional[str] = Field(None, description="D1 团队组建")
    d2_problem: Optional[str] = Field(None, description="D2 问题描述")
    d3_containment: Optional[str] = Field(None, description="D3 临时遏制措施")
    d4_root_cause: Optional[str] = Field(None, description="D4 根因分析")
    d5_corrective_action: Optional[str] = Field(None, description="D5 纠正措施")
    d6_implement_result: Optional[str] = Field(None, description="D6 实施验证")
    d7_prevent_recurrence: Optional[str] = Field(None, description="D7 防再发措施")
    d8_team_congratulation: Optional[str] = Field(None, description="D8 团队总结")
    verification_result: Optional[str] = Field(None, description="验证结果")
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class Quality8DCreate(Quality8DBase):
    report_code: Optional[str] = Field(None, description="8D 编码，可空自动生成")


class Quality8DUpdate(BaseSchema):
    status: Optional[str] = Field(None, description="8D 当前阶段")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    owner_name: Optional[str] = Field(None, description="负责人姓名")
    due_date: Optional[datetime] = Field(None, description="计划完成日期")
    d1_team: Optional[str] = None
    d2_problem: Optional[str] = None
    d3_containment: Optional[str] = None
    d4_root_cause: Optional[str] = None
    d5_corrective_action: Optional[str] = None
    d6_implement_result: Optional[str] = None
    d7_prevent_recurrence: Optional[str] = None
    d8_team_congratulation: Optional[str] = None
    verification_result: Optional[str] = None
    remarks: Optional[str] = None
    attachments: Optional[List[dict]] = None


class Quality8DTransition(BaseSchema):
    to_status: str = Field(..., description="目标阶段")
    remarks: Optional[str] = Field(None, description="流转备注")
    verification_result: Optional[str] = Field(None, description="关闭阶段验证结果")


class Quality8DLifecycleStage(BaseSchema):
    key: str
    label: str
    status: str = Field(..., description="done/active/pending")


class Quality8DHistoryEntry(BaseSchema):
    timestamp: datetime
    action: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    remarks: Optional[str] = None
    verification_result: Optional[str] = None


class Quality8DResponse(Quality8DBase):
    id: int
    report_code: str
    uuid: str
    tenant_id: int
    closed_at: Optional[datetime] = Field(None, description="关闭时间")
    lifecycle_stages: List[Quality8DLifecycleStage] = Field(default_factory=list)
    next_status: Optional[str] = Field(None, description="下一合法阶段")
    next_step_suggestions: List[str] = Field(default_factory=list)
    capabilities: Optional[EightDReportCapabilities] = Field(
        None, description="业务态 capabilities（不含 RBAC）"
    )
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Quality8DListResponse(BaseSchema):
    items: List[Quality8DResponse]
    total: int


class NonconformingDispositionUpdate(BaseSchema):
    disposition: str = Field(..., description="处置方式")
    status: Optional[str] = Field(None, description="台账状态")
    quarantine_location: Optional[str] = Field(None, description="隔离库位")
    remarks: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class OQCInspectionBase(BaseSchema):
    source_type: str = Field("shipment_notice", description="来源类型")
    source_id: int = Field(..., description="来源单据ID")
    source_code: str = Field(..., description="来源单据编码")
    shipment_notice_id: Optional[int] = Field(None, description="发货通知ID")
    shipment_notice_code: Optional[str] = Field(None, description="发货通知编码")
    sales_order_id: Optional[int] = Field(None, description="销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="销售订单编码")
    customer_id: Optional[int] = Field(None, description="客户ID")
    customer_name: Optional[str] = Field(None, description="客户名称")
    material_id: int = Field(..., description="成品物料ID")
    material_code: str = Field(..., description="成品物料编码")
    material_name: str = Field(..., description="成品物料名称")
    batch_number: Optional[str] = Field(None, description="批次号")
    inspection_quantity: float = Field(..., description="检验数量")
    qualified_quantity: float = Field(0, description="合格数量")
    unqualified_quantity: float = Field(0, description="不合格数量")
    inspection_result: str = Field("待检验", description="检验结果")
    quality_status: str = Field("合格", description="质量状态")
    release_decision: str = Field("pending", description="放行结论")
    release_note: Optional[str] = Field(None, description="放行说明")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")


class OQCInspectionCreate(OQCInspectionBase):
    inspection_code: Optional[str] = Field(None, description="OQC 检验单号，可空自动生成")


class OQCInspectionConduct(BaseSchema):
    inspection_result: str = Field(..., description="检验结果")
    quality_status: str = Field(..., description="质量状态")
    qualified_quantity: float = Field(0, description="合格数量")
    unqualified_quantity: float = Field(0, description="不合格数量")
    release_decision: str = Field("pending", description="放行结论")
    release_note: Optional[str] = Field(None, description="放行说明")
    notes: Optional[str] = Field(None, description="备注")
    attachments: Optional[List[dict]] = Field(None, description="附件列表")
    measurement_data: Optional[dict] = Field(None, description="测量数据")
    item_results: Optional[dict] = Field(None, description="检验项判定结果（legacy）")
    conduct_step_results: Optional[dict] = Field(None, description="方案步骤检验结果（按 step_key）")


class OQCInspectionResponse(OQCInspectionBase):
    id: int
    inspection_code: str
    uuid: str
    tenant_id: int
    inspector_id: Optional[int]
    inspector_name: Optional[str]
    inspection_time: Optional[datetime]
    reviewer_id: Optional[int]
    reviewer_name: Optional[str]
    review_time: Optional[datetime]
    review_status: str
    status: str
    inspection_standard: Optional[str] = None
    other_checks: Optional[dict] = None
    capabilities: Optional[OQCInspectionCapabilities] = Field(
        None, description="业务态 capabilities（不含 RBAC）"
    )
    created_by: Optional[int] = Field(None, description="创建人ID")
    created_by_name: Optional[str] = Field(None, description="创建人姓名")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    updated_by_name: Optional[str] = Field(None, description="更新人姓名")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SPCSampleBase(BaseSchema):
    chart_type: str = Field("imr", description="控制图类型")
    characteristic_name: str = Field(..., description="质量特性")
    sample_time: datetime = Field(..., description="采样时间")
    sample_value: float = Field(..., description="采样值")
    sample_size: int = Field(1, description="样本量")
    sample_group: Optional[str] = Field(None, description="样本组")
    source_type: Optional[str] = Field(None, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_code: Optional[str] = Field(None, description="来源编码")
    remarks: Optional[str] = Field(None, description="备注")


class SPCSampleCreate(SPCSampleBase):
    pass


class SPCSampleResponse(SPCSampleBase):
    id: int
    uuid: str
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SPCSampleListResponse(BaseSchema):
    items: List[SPCSampleResponse]
    total: int


class SPCPoint(BaseSchema):
    sample_time: datetime
    sample_value: float
    out_of_control: bool = False
    triggered_rules: List[str] = Field(default_factory=list)


class SPCChartResponse(BaseSchema):
    characteristic_name: str
    chart_type: str
    mean: float
    sigma: float
    ucl: float
    lcl: float
    points: List[SPCPoint]
    triggered_summary: List[str] = Field(default_factory=list)
