"""交付项目 Pydantic 模型"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# --- 人员（负责人 + 成员）---

class DeliveryMemberInput(BaseModel):
    user_id: int
    user_name: Optional[str] = None


class DeliveryMemberResponse(BaseModel):
    user_id: int
    user_name: str


# --- 流程模板 ---

class DeliveryProcessTemplateNodeTaskBase(BaseModel):
    task_key: str
    task_name: str
    sort_order: int = 0
    default_owner_role: Optional[str] = None
    planned_duration_days: int = 0


class DeliveryProcessTemplateNodeTaskCreate(DeliveryProcessTemplateNodeTaskBase):
    pass


class DeliveryProcessTemplateNodeTaskResponse(DeliveryProcessTemplateNodeTaskBase):
    id: int
    template_node_id: int

    class Config:
        from_attributes = True


class DeliveryProcessTemplateNodeBase(BaseModel):
    node_key: str
    node_name: str
    sort_order: int = 0
    default_owner_role: Optional[str] = None
    planned_duration_days: int = 0
    is_critical: bool = False
    is_milestone: bool = False
    tasks: List[DeliveryProcessTemplateNodeTaskCreate] = Field(default_factory=list)


class DeliveryProcessTemplateNodeCreate(DeliveryProcessTemplateNodeBase):
    pass


class DeliveryProcessTemplateNodeResponse(BaseModel):
    id: int
    template_id: int
    node_key: str
    node_name: str
    sort_order: int = 0
    default_owner_role: Optional[str] = None
    planned_duration_days: int = 0
    is_critical: bool = False
    is_milestone: bool = False
    tasks: List[DeliveryProcessTemplateNodeTaskResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DeliveryProcessTemplateCreate(BaseModel):
    template_name: str
    project_type: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None
    nodes: List[DeliveryProcessTemplateNodeCreate] = Field(default_factory=list)


class DeliveryProcessTemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    project_type: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    nodes: Optional[List[DeliveryProcessTemplateNodeCreate]] = None


class DeliveryProcessTemplateResponse(BaseModel):
    id: int
    template_code: str
    template_name: str
    project_type: Optional[str] = None
    is_active: bool
    is_default: bool
    notes: Optional[str] = None
    nodes: List[DeliveryProcessTemplateNodeResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeliveryProcessTemplateListEnvelope(BaseModel):
    items: List[DeliveryProcessTemplateResponse]
    total: int


# --- 交付项目 ---

class DeliveryProjectNodeTaskResponse(BaseModel):
    id: int
    project_id: int
    node_id: int
    template_task_id: Optional[int] = None
    task_key: Optional[str] = None
    task_name: str
    sort_order: int = 0
    status: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    members: List[DeliveryMemberResponse] = Field(default_factory=list)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    progress_percent: Decimal = Decimal("0")

    class Config:
        from_attributes = True


class DeliveryProjectNodeTaskCreate(BaseModel):
    node_id: int
    task_name: str
    sort_order: int = 0
    owner_id: Optional[int] = None
    members: List[DeliveryMemberInput] = Field(default_factory=list)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None


class DeliveryProjectNodeTaskUpdate(BaseModel):
    task_name: Optional[str] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    owner_id: Optional[int] = None
    members: Optional[List[DeliveryMemberInput]] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    progress_percent: Optional[Decimal] = None


class DeliveryProjectNodeResponse(BaseModel):
    id: int
    project_id: int
    node_key: str
    node_name: str
    sort_order: int
    status: str
    progress_percent: Decimal
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_critical: bool
    is_milestone: bool
    tasks: List[DeliveryProjectNodeTaskResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class DeliveryProjectCreate(BaseModel):
    project_name: str
    process_template_id: Optional[int] = None
    sales_order_id: Optional[int] = None
    customer_id: Optional[int] = None
    delivery_date: Optional[date] = None
    owner_id: Optional[int] = None
    members: List[DeliveryMemberInput] = Field(default_factory=list)
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    notes: Optional[str] = None


class DeliveryProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    delivery_date: Optional[date] = None
    owner_id: Optional[int] = None
    members: Optional[List[DeliveryMemberInput]] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None


class DeliveryProjectCompleteRequest(BaseModel):
    force: bool = False
    reason: Optional[str] = None


class DeliveryProjectChangeTemplateRequest(BaseModel):
    process_template_id: int


class DeliveryProjectNodeUpdate(BaseModel):
    owner_id: Optional[int] = None


class DeliveryProjectResponse(BaseModel):
    id: int
    project_code: str
    project_name: str
    process_template_id: Optional[int] = None
    process_template_name: Optional[str] = None
    sales_order_id: Optional[int] = None
    sales_order_code: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    delivery_date: Optional[date] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    members: List[DeliveryMemberResponse] = Field(default_factory=list)
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    material_lines: List[Dict[str, Any]] = Field(default_factory=list)
    rd_project_id: Optional[int] = None
    status: str
    progress_percent: Decimal
    current_node_key: Optional[str] = None
    current_node_name: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    notes: Optional[str] = None
    nodes: List[DeliveryProjectNodeResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryProjectListResponse(BaseModel):
    id: int
    project_code: str
    project_name: str
    sales_order_code: Optional[str] = None
    customer_name: Optional[str] = None
    delivery_date: Optional[date] = None
    owner_name: Optional[str] = None
    member_count: int = 0
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    status: str
    progress_percent: Decimal
    current_node_name: Optional[str] = None
    nodes: List[DeliveryProjectNodeResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryLinkedRdProjectSummary(BaseModel):
    id: int
    project_code: str
    project_name: str


class DeliveryProjectListEnvelope(BaseModel):
    items: List[DeliveryProjectListResponse]
    total: int


class PushDeliveryProjectFromSalesOrderRequest(BaseModel):
    process_template_id: Optional[int] = None
    project_name: Optional[str] = None
    owner_id: Optional[int] = None


class PushDeliveryProjectPreviewResponse(BaseModel):
    sales_order_id: int
    sales_order_code: str
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    delivery_date: Optional[date] = None
    material_lines: List[Dict[str, Any]] = Field(default_factory=list)
    existing_project_id: Optional[int] = None
    existing_project_code: Optional[str] = None
    default_template_id: Optional[int] = None
    default_template_name: Optional[str] = None


# --- 节点汇报 ---

class DeliveryNodeReportCreate(BaseModel):
    project_id: int
    node_id: int
    report_date: date
    progress_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    content: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class DeliveryNodeReportUpdate(BaseModel):
    report_date: Optional[date] = None
    progress_percent: Optional[Decimal] = Field(default=None, ge=0, le=100)
    content: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None


class DeliveryNodeReportResponse(BaseModel):
    id: int
    report_code: str
    project_id: int
    project_code: str
    node_id: int
    node_key: str
    node_name: str
    reporter_id: Optional[int] = None
    reporter_name: Optional[str] = None
    report_date: date
    progress_percent: Decimal
    content: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    status: str
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryNodeReportListEnvelope(BaseModel):
    items: List[DeliveryNodeReportResponse]
    total: int


class DeliveryNodeReportReviewRequest(BaseModel):
    approved: bool
    review_notes: Optional[str] = None


# --- 问题跟踪 ---

class DeliveryIssueCreate(BaseModel):
    project_id: int
    node_id: Optional[int] = None
    issue_type: str = "other"
    priority: str = "normal"
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None


class DeliveryIssueUpdate(BaseModel):
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    resolution: Optional[str] = None


class DeliveryIssueResponse(BaseModel):
    id: int
    issue_code: str
    project_id: int
    project_code: str
    node_id: Optional[int] = None
    node_name: Optional[str] = None
    issue_type: str
    priority: str
    status: str
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    assignee_name: Optional[str] = None
    due_date: Optional[date] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryIssueListEnvelope(BaseModel):
    items: List[DeliveryIssueResponse]
    total: int


class DeliveryProjectWorkbenchResponse(DeliveryProjectResponse):
    recent_reports: List[DeliveryNodeReportResponse] = Field(default_factory=list)
    open_issues: List[DeliveryIssueResponse] = Field(default_factory=list)
    linked_rd_project: Optional[DeliveryLinkedRdProjectSummary] = None


# --- 交付中心 / 跟进表 ---

class DeliveryDashboardKpi(BaseModel):
    active_projects: int = 0
    overdue_nodes: int = 0
    at_risk_projects: int = 0
    open_issues: int = 0


class DeliveryGanttItem(BaseModel):
    """交付中心甘特图行（项目节点）"""

    id: int = Field(description="甘特行唯一 ID（project_id * 100000 + node_id）")
    project_id: int
    node_id: int
    project_code: str
    project_name: str
    node_name: str
    customer_name: Optional[str] = None
    node_status: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    progress: float = 0


class DeliveryDashboardResponse(BaseModel):
    kpis: DeliveryDashboardKpi
    recent_projects: List[DeliveryProjectListResponse] = Field(default_factory=list)
    overdue_nodes: List[Dict[str, Any]] = Field(default_factory=list)
    project_gantt: List[DeliveryGanttItem] = Field(default_factory=list)


class DeliveryFollowUpRow(BaseModel):
    project_id: int
    project_code: str
    project_name: str
    customer_name: Optional[str] = None
    delivery_date: Optional[date] = None
    status: str
    progress_percent: Decimal
    current_node_name: Optional[str] = None
    nodes: List[DeliveryProjectNodeResponse] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class DeliveryFollowUpListEnvelope(BaseModel):
    items: List[DeliveryFollowUpRow]
    total: int


class DeliveryProgressSummaryRow(BaseModel):
    id: int
    project_code: str
    project_name: str
    customer_name: Optional[str] = None
    sales_order_code: Optional[str] = None
    delivery_date: Optional[date] = None
    owner_name: Optional[str] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    status: str
    progress_percent: Decimal
    current_node_name: Optional[str] = None
    planned_end_date: Optional[date] = None
    overdue_node_count: int = 0
    open_issue_count: int = 0
    days_to_delivery: Optional[int] = None
    node_summary: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryProgressSummaryEnvelope(BaseModel):
    items: List[DeliveryProgressSummaryRow]
    total: int


class DeliveryProcessProgressRow(BaseModel):
    """项目流程进度表：一行一节点（含项目头信息）"""

    id: str
    project_id: int
    project_code: str
    project_name: str
    sales_order_code: Optional[str] = None
    customer_name: Optional[str] = None
    project_owner_name: Optional[str] = None
    material_name: Optional[str] = None
    delivery_date: Optional[date] = None
    node_id: int
    node_key: str
    node_name: str
    sort_order: int
    node_status: str
    progress_percent: Decimal
    node_owner_name: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    reporter_name: Optional[str] = None
    issue_count: int = 0
    is_critical: bool = False
    is_milestone: bool = False


class DeliveryProcessProgressEnvelope(BaseModel):
    items: List[DeliveryProcessProgressRow]
    total: int


class DeliveryScheduleRow(BaseModel):
    """项目流程排单表"""

    project_id: int
    project_code: str
    project_name: str
    customer_name: Optional[str] = None
    delivery_date: Optional[date] = None
    owner_name: Optional[str] = None
    status: str
    progress_percent: Decimal
    current_node_name: Optional[str] = None
    schedule_node_name: Optional[str] = None
    schedule_node_owner_name: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    node_status: Optional[str] = None
    report_overdue: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class DeliveryScheduleListEnvelope(BaseModel):
    items: List[DeliveryScheduleRow]
    total: int


class DeliveryIssueProgressRow(BaseModel):
    """项目进度问题报表"""

    id: int
    issue_code: str
    project_code: str
    project_name: str
    customer_name: Optional[str] = None
    node_name: Optional[str] = None
    issue_type: str
    priority: str
    status: str
    title: str
    assignee_name: Optional[str] = None
    due_date: Optional[date] = None
    created_at: Optional[datetime] = None


class DeliveryIssueProgressEnvelope(BaseModel):
    items: List[DeliveryIssueProgressRow]
    total: int
