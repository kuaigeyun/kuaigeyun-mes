"""
工装运营扩展模型：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from tortoise import fields
from core.models.base import BaseModel


class ToolMaintenanceItem(BaseModel):
    """工装保养项"""

    class Meta:
        table = "apps_kuaizhizao_tool_maintenance_items"
        table_description = "快格轻制造 - 工装保养项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="保养项编码")
    name = fields.CharField(max_length=200, description="保养项名称")
    requirement = fields.TextField(null=True, description="保养要求")
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolMaintenanceScheme(BaseModel):
    """工装保养方案"""

    class Meta:
        table = "apps_kuaizhizao_tool_maintenance_schemes"
        table_description = "快格轻制造 - 工装保养方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="方案编码")
    name = fields.CharField(max_length=200, description="方案名称")
    description = fields.TextField(null=True)
    trigger_type = fields.CharField(max_length=32, default="usage_count", description="触发类型 days/usage_count")
    trigger_interval_days = fields.IntField(null=True, description="按天触发间隔")
    trigger_interval_usage = fields.IntField(null=True, description="按使用次数触发间隔")
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolMaintenanceSchemeLine(BaseModel):
    """工装保养方案行"""

    class Meta:
        table = "apps_kuaizhizao_tool_maintenance_scheme_lines"
        table_description = "快格轻制造 - 工装保养方案行"
        indexes = [("tenant_id",), ("scheme_id",)]

    id = fields.IntField(pk=True)
    scheme_id = fields.IntField(description="方案ID")
    item_id = fields.IntField(description="保养项ID")
    sort_order = fields.IntField(default=0)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolRepairItem(BaseModel):
    """工装维修项"""

    class Meta:
        table = "apps_kuaizhizao_tool_repair_items"
        table_description = "快格轻制造 - 工装维修项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="维修项编码")
    name = fields.CharField(max_length=200, description="维修项名称")
    requirement = fields.TextField(null=True, description="维修要求")
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolRepairScheme(BaseModel):
    """工装维修方案"""

    class Meta:
        table = "apps_kuaizhizao_tool_repair_schemes"
        table_description = "快格轻制造 - 工装维修方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="方案编码")
    name = fields.CharField(max_length=200, description="方案名称")
    description = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolRepairSchemeLine(BaseModel):
    """工装维修方案行"""

    class Meta:
        table = "apps_kuaizhizao_tool_repair_scheme_lines"
        table_description = "快格轻制造 - 工装维修方案行"
        indexes = [("tenant_id",), ("scheme_id",)]

    id = fields.IntField(pk=True)
    scheme_id = fields.IntField(description="方案ID")
    item_id = fields.IntField(description="维修项ID")
    sort_order = fields.IntField(default=0)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolSchemeBinding(BaseModel):
    """工装与方案绑定"""

    class Meta:
        table = "apps_kuaizhizao_tool_scheme_bindings"
        table_description = "快格轻制造 - 工装方案绑定"
        indexes = [("tenant_id",), ("tool_id",), ("scheme_type",)]

    id = fields.IntField(pk=True)
    tool_id = fields.IntField(description="工装ID")
    tool_uuid = fields.CharField(max_length=36)
    scheme_id = fields.IntField(description="方案ID")
    scheme_type = fields.CharField(max_length=32, default="maintenance", description="maintenance/repair")
    deleted_at = fields.DatetimeField(null=True)




class ToolOpsCalibration(BaseModel):
    """工装校验单"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_calibrations"
        table_description = "快格轻制造 - 工装校验单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("tool_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    calibration_date = fields.DateField()
    calibration_org = fields.CharField(max_length=200, null=True)
    certificate_no = fields.CharField(max_length=100, null=True)
    result = fields.CharField(max_length=50, description="合格/不合格/准用")
    expiry_date = fields.DateField(null=True)
    operator_id = fields.IntField(null=True)
    operator_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="进行中")
    attachment_uuid = fields.CharField(max_length=36, null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolBorrow(BaseModel):
    """工装领用单"""

    class Meta:
        table = "apps_kuaizhizao_tool_borrows"
        table_description = "快格轻制造 - 工装领用单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("tool_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    borrow_date = fields.DatetimeField()
    borrower_id = fields.IntField(null=True)
    borrower_name = fields.CharField(max_length=100, null=True)
    department_name = fields.CharField(max_length=200, null=True)
    expected_return_date = fields.DateField(null=True)
    source_type = fields.CharField(max_length=50, null=True)
    source_id = fields.IntField(null=True)
    source_no = fields.CharField(max_length=100, null=True)
    legacy_usage_no = fields.CharField(max_length=100, null=True, description="迁移自旧领用单号")
    status = fields.CharField(max_length=32, default="领用中")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolReturn(BaseModel):
    """工装归还单"""

    class Meta:
        table = "apps_kuaizhizao_tool_returns"
        table_description = "快格轻制造 - 工装归还单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("tool_id",), ("borrow_id",), ("reporting_record_id",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    borrow_id = fields.IntField(null=True, description="关联领用单ID")
    return_date = fields.DatetimeField()
    usage_count = fields.IntField(default=1)
    operator_id = fields.IntField(null=True)
    operator_name = fields.CharField(max_length=100, null=True)
    source_type = fields.CharField(max_length=50, null=True)
    source_id = fields.IntField(null=True)
    source_no = fields.CharField(max_length=100, null=True)
    reporting_record_id = fields.IntField(null=True, description="报工记录ID，幂等")
    status = fields.CharField(max_length=32, default="已完成")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolMaintenance(BaseModel):
    """工装保养单"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_maintenances"
        table_description = "快格轻制造 - 工装保养单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("tool_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    scheme_id = fields.IntField(null=True)
    planned_date = fields.DateField(null=True)
    maintenance_date = fields.DateField(null=True)
    applicant_id = fields.IntField(null=True)
    applicant_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="草稿")
    approver_id = fields.IntField(null=True)
    approver_name = fields.CharField(max_length=100, null=True)
    approved_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    completed_at = fields.DatetimeField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolMaintenanceLine(BaseModel):
    """工装保养单行"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_maintenance_lines"
        table_description = "快格轻制造 - 工装保养单行"
        indexes = [("tenant_id",), ("maintenance_id",)]

    id = fields.IntField(pk=True)
    maintenance_id = fields.IntField()
    line_no = fields.IntField(default=1)
    item_id = fields.IntField(null=True)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_done = fields.BooleanField(default=False)
    result_value = fields.TextField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolRepair(BaseModel):
    """工装维修单"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_repairs"
        table_description = "快格轻制造 - 工装维修单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("tool_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    scheme_id = fields.IntField(null=True)
    fault_description = fields.TextField(null=True)
    planned_date = fields.DateField(null=True)
    repair_date = fields.DateField(null=True)
    applicant_id = fields.IntField(null=True)
    applicant_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="草稿")
    approver_id = fields.IntField(null=True)
    approver_name = fields.CharField(max_length=100, null=True)
    approved_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    completed_at = fields.DatetimeField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolRepairLine(BaseModel):
    """工装维修单行"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_repair_lines"
        table_description = "快格轻制造 - 工装维修单行"
        indexes = [("tenant_id",), ("repair_id",)]

    id = fields.IntField(pk=True)
    repair_id = fields.IntField()
    line_no = fields.IntField(default=1)
    item_id = fields.IntField(null=True)
    item_code = fields.CharField(max_length=64, null=True)
    item_name = fields.CharField(max_length=200, null=True)
    requirement = fields.TextField(null=True)
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_done = fields.BooleanField(default=False)
    result_value = fields.TextField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class ToolScrapApplication(BaseModel):
    """工装报废申请"""

    class Meta:
        table = "apps_kuaizhizao_tool_ops_scrap_applications"
        table_description = "快格轻制造 - 工装报废申请"
        unique_together = [("tenant_id", "application_no")]
        indexes = [("tenant_id",), ("tool_id",), ("status",)]

    id = fields.IntField(pk=True)
    application_no = fields.CharField(max_length=64)
    tool_id = fields.IntField()
    tool_uuid = fields.CharField(max_length=36)
    tool_code = fields.CharField(max_length=50, null=True)
    tool_name = fields.CharField(max_length=200, null=True)
    reason = fields.TextField()
    scrap_date = fields.DateField(null=True)
    applicant_id = fields.IntField(null=True)
    applicant_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="草稿")
    approver_id = fields.IntField(null=True)
    approver_name = fields.CharField(max_length=100, null=True)
    approved_at = fields.DatetimeField(null=True)
    reject_reason = fields.TextField(null=True)
    attachments = fields.JSONField(null=True)
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


