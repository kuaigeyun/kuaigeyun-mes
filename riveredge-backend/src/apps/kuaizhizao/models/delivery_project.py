"""交付项目（订单交机）模型"""

from tortoise import fields

from core.models.base import BaseModel
from apps.kuaizhizao.constants.delivery_project import (
    DeliveryIssuePriority,
    DeliveryIssueStatus,
    DeliveryIssueType,
    DeliveryNodeReportStatus,
    DeliveryNodeStatus,
    DeliveryNodeTaskStatus,
    DeliveryProjectStatus,
)


class DeliveryProcessTemplate(BaseModel):
    """交付流程模板"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    template_code = fields.CharField(max_length=50, db_index=True, description="模板编码")
    template_name = fields.CharField(max_length=200, description="模板名称")
    project_type = fields.CharField(max_length=50, null=True, description="适用项目类型")
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_default = fields.BooleanField(default=False, description="是否默认模板")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_process_templates"
        table_description = "快制造 - 交付流程模板"
        indexes = [("tenant_id", "template_code"), ("tenant_id", "is_active")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryProcessTemplateNode(BaseModel):
    """交付流程模板节点"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    template_id = fields.IntField(description="模板ID")
    node_key = fields.CharField(max_length=50, description="节点标识")
    node_name = fields.CharField(max_length=100, description="节点名称")
    sort_order = fields.IntField(default=0, description="排序")
    default_owner_role = fields.CharField(max_length=50, null=True, description="默认负责人角色")
    planned_duration_days = fields.IntField(default=0, description="计划工期（天）")
    is_critical = fields.BooleanField(default=False, description="是否关键卡点")
    is_milestone = fields.BooleanField(default=False, description="是否里程碑")

    class Meta:
        table = "apps_kuaizhizao_delivery_process_template_nodes"
        table_description = "快制造 - 交付流程模板节点"
        unique_together = (("tenant_id", "template_id", "node_key"),)
        indexes = [("tenant_id", "template_id")]


class DeliveryProcessTemplateNodeTask(BaseModel):
    """交付流程模板节点预置任务"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    template_node_id = fields.IntField(description="模板节点ID")
    task_key = fields.CharField(max_length=50, description="任务标识")
    task_name = fields.CharField(max_length=200, description="任务名称")
    sort_order = fields.IntField(default=0, description="排序")
    default_owner_role = fields.CharField(max_length=50, null=True, description="默认负责人角色")
    planned_duration_days = fields.IntField(default=0, description="计划工期（天）")

    class Meta:
        table = "apps_kuaizhizao_delivery_process_template_node_tasks"
        table_description = "快制造 - 交付流程模板节点预置任务"
        unique_together = (("tenant_id", "template_node_id", "task_key"),)
        indexes = [("tenant_id", "template_node_id")]


class DeliveryProject(BaseModel):
    """交付项目"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    project_code = fields.CharField(max_length=50, db_index=True, description="项目编码")
    project_name = fields.CharField(max_length=200, description="项目名称")
    process_template_id = fields.IntField(null=True, description="流程模板ID")
    process_template_name = fields.CharField(max_length=200, null=True, description="流程模板名称快照")
    sales_order_id = fields.IntField(null=True, description="来源销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="来源销售订单编码")
    customer_id = fields.IntField(null=True, description="客户ID")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称")
    delivery_date = fields.DateField(null=True, description="交期")
    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    material_id = fields.IntField(null=True, description="产品物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="产品编码")
    material_name = fields.CharField(max_length=200, null=True, description="产品名称")
    material_spec = fields.CharField(max_length=500, null=True, description="规格型号")
    material_lines_json = fields.TextField(null=True, description="订单明细物料 JSON")
    rd_project_id = fields.IntField(null=True, description="关联快研发项目ID")
    status = fields.CharField(
        max_length=30,
        default=DeliveryProjectStatus.DRAFT.value,
        description="项目状态",
    )
    progress_percent = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="总进度%")
    current_node_key = fields.CharField(max_length=50, null=True, description="当前节点标识")
    current_node_name = fields.CharField(max_length=100, null=True, description="当前节点名称")
    planned_start_date = fields.DateField(null=True, description="计划开始")
    planned_end_date = fields.DateField(null=True, description="计划结束")
    actual_start_date = fields.DateField(null=True, description="实际开始")
    actual_end_date = fields.DateField(null=True, description="实际结束")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_projects"
        table_description = "快制造 - 交付项目"
        indexes = [
            ("tenant_id", "project_code"),
            ("tenant_id", "status"),
            ("tenant_id", "sales_order_id"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "delivery_date"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryProjectNode(BaseModel):
    """交付项目节点实例"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    template_node_id = fields.IntField(null=True, description="模板节点ID")
    node_key = fields.CharField(max_length=50, description="节点标识")
    node_name = fields.CharField(max_length=100, description="节点名称")
    sort_order = fields.IntField(default=0, description="排序")
    status = fields.CharField(
        max_length=30,
        default=DeliveryNodeStatus.NOT_STARTED.value,
        description="节点状态",
    )
    progress_percent = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="完成%")
    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    planned_start_date = fields.DateField(null=True, description="计划开始")
    planned_end_date = fields.DateField(null=True, description="计划结束")
    actual_start_date = fields.DateField(null=True, description="实际开始")
    actual_end_date = fields.DateField(null=True, description="实际结束")
    is_critical = fields.BooleanField(default=False, description="是否关键卡点")
    is_milestone = fields.BooleanField(default=False, description="是否里程碑")

    class Meta:
        table = "apps_kuaizhizao_delivery_project_nodes"
        table_description = "快制造 - 交付项目节点"
        unique_together = (("tenant_id", "project_id", "node_key"),)
        indexes = [("tenant_id", "project_id"), ("tenant_id", "status")]


class DeliveryProjectMember(BaseModel):
    """交付项目成员（不含负责人）"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    user_id = fields.IntField(description="成员用户ID")
    user_name = fields.CharField(max_length=100, description="成员姓名快照")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_project_members"
        table_description = "快制造 - 交付项目成员"
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "user_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryProjectNodeTask(BaseModel):
    """交付项目节点任务实例"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    node_id = fields.IntField(description="节点ID")
    template_task_id = fields.IntField(null=True, description="模板任务ID")
    task_key = fields.CharField(max_length=50, null=True, description="任务标识")
    task_name = fields.CharField(max_length=200, description="任务名称")
    sort_order = fields.IntField(default=0, description="排序")
    status = fields.CharField(
        max_length=30,
        default=DeliveryNodeTaskStatus.TODO.value,
        description="任务状态",
    )
    owner_id = fields.IntField(null=True, description="负责人ID")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    members_json = fields.JSONField(null=True, description="成员快照 [{user_id,user_name}]")
    planned_start_date = fields.DateField(null=True, description="计划开始")
    planned_end_date = fields.DateField(null=True, description="计划结束")
    actual_start_date = fields.DateField(null=True, description="实际开始")
    actual_end_date = fields.DateField(null=True, description="实际结束")
    progress_percent = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="完成%")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_project_node_tasks"
        table_description = "快制造 - 交付项目节点任务"
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "node_id"),
            ("tenant_id", "status"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryNodeReport(BaseModel):
    """交付节点汇报"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    report_code = fields.CharField(max_length=50, db_index=True, description="汇报单号")
    project_id = fields.IntField(description="项目ID")
    project_code = fields.CharField(max_length=50, description="项目编码快照")
    node_id = fields.IntField(description="节点ID")
    node_key = fields.CharField(max_length=50, description="节点标识")
    node_name = fields.CharField(max_length=100, description="节点名称快照")
    reporter_id = fields.IntField(null=True, description="汇报人ID")
    reporter_name = fields.CharField(max_length=100, null=True, description="汇报人姓名")
    report_date = fields.DateField(description="汇报日期")
    progress_percent = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="完成%")
    content = fields.TextField(null=True, description="完成说明")
    attachments = fields.JSONField(null=True, description="附件")
    status = fields.CharField(
        max_length=30,
        default=DeliveryNodeReportStatus.DRAFT.value,
        description="汇报状态",
    )
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    review_notes = fields.TextField(null=True, description="审核意见")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_node_reports"
        table_description = "快制造 - 交付节点汇报"
        indexes = [
            ("tenant_id", "report_code"),
            ("tenant_id", "project_id"),
            ("tenant_id", "node_id"),
            ("tenant_id", "status"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryIssue(BaseModel):
    """交付项目问题"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    issue_code = fields.CharField(max_length=50, db_index=True, description="问题单号")
    project_id = fields.IntField(description="项目ID")
    project_code = fields.CharField(max_length=50, description="项目编码快照")
    node_id = fields.IntField(null=True, description="关联节点ID")
    node_name = fields.CharField(max_length=100, null=True, description="关联节点名称")
    issue_type = fields.CharField(
        max_length=30,
        default=DeliveryIssueType.OTHER.value,
        description="问题类型",
    )
    priority = fields.CharField(
        max_length=20,
        default=DeliveryIssuePriority.NORMAL.value,
        description="优先级",
    )
    status = fields.CharField(
        max_length=30,
        default=DeliveryIssueStatus.OPEN.value,
        description="问题状态",
    )
    title = fields.CharField(max_length=200, description="问题标题")
    description = fields.TextField(null=True, description="问题描述")
    assignee_id = fields.IntField(null=True, description="责任人ID")
    assignee_name = fields.CharField(max_length=100, null=True, description="责任人姓名")
    due_date = fields.DateField(null=True, description="期望解决日期")
    resolved_at = fields.DatetimeField(null=True, description="解决时间")
    resolution = fields.TextField(null=True, description="解决说明")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_issues"
        table_description = "快制造 - 交付项目问题"
        indexes = [
            ("tenant_id", "issue_code"),
            ("tenant_id", "project_id"),
            ("tenant_id", "status"),
            ("tenant_id", "priority"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryProjectNodeDocument(BaseModel):
    """交付项目节点关联单据"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    project_id = fields.IntField(description="项目ID")
    node_id = fields.IntField(description="节点ID")
    doc_type = fields.CharField(max_length=50, description="单据类型")
    doc_id = fields.IntField(description="单据ID")
    doc_code = fields.CharField(max_length=100, description="单据编码")
    title = fields.CharField(max_length=200, null=True, description="展示标题")
    linked_at = fields.DatetimeField(description="关联时间")
    linked_by = fields.IntField(null=True, description="关联人ID")
    linked_by_name = fields.CharField(max_length=100, null=True, description="关联人姓名")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_project_node_documents"
        table_description = "快制造 - 交付项目节点关联单据"
        indexes = [
            ("tenant_id", "project_id"),
            ("tenant_id", "node_id"),
            ("tenant_id", "doc_type", "doc_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class DeliveryProjectNodeAlertSent(BaseModel):
    """交付节点预警发送去重（同键不重复刷屏）"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    dedup_key = fields.CharField(max_length=200, description="去重键")
    sent_at = fields.DatetimeField(description="发送时间")

    class Meta:
        table = "apps_kuaizhizao_delivery_project_node_alert_sent"
        table_description = "快制造 - 交付节点预警发送记录"
        unique_together = (("tenant_id", "dedup_key"),)
        indexes = [("tenant_id", "sent_at")]
