"""
模具运营扩展模型：保养/维修主数据与业务单据。

Author: RiverEdge
Date: 2026-06-29
"""

from tortoise import fields
from core.models.base import BaseModel


class MoldMaintenanceItem(BaseModel):
    """模具保养项"""

    class Meta:
        table = "apps_kuaizhizao_mold_maintenance_items"
        table_description = "快格轻制造 - 模具保养项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="保养项编码")
    name = fields.CharField(max_length=200, description="保养项名称")
    requirement = fields.TextField(null=True, description="保养要求")
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class MoldMaintenanceScheme(BaseModel):
    """模具保养方案"""

    class Meta:
        table = "apps_kuaizhizao_mold_maintenance_schemes"
        table_description = "快格轻制造 - 模具保养方案"
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


class MoldMaintenanceSchemeLine(BaseModel):
    """模具保养方案行"""

    class Meta:
        table = "apps_kuaizhizao_mold_maintenance_scheme_lines"
        table_description = "快格轻制造 - 模具保养方案行"
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


class MoldRepairItem(BaseModel):
    """模具维修项"""

    class Meta:
        table = "apps_kuaizhizao_mold_repair_items"
        table_description = "快格轻制造 - 模具维修项"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="维修项编码")
    name = fields.CharField(max_length=200, description="维修项名称")
    requirement = fields.TextField(null=True, description="维修要求")
    standard_hours = fields.DecimalField(max_digits=10, decimal_places=2, null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class MoldRepairScheme(BaseModel):
    """模具维修方案"""

    class Meta:
        table = "apps_kuaizhizao_mold_repair_schemes"
        table_description = "快格轻制造 - 模具维修方案"
        unique_together = [("tenant_id", "code")]
        indexes = [("tenant_id",), ("code",)]

    id = fields.IntField(pk=True)
    code = fields.CharField(max_length=64, description="方案编码")
    name = fields.CharField(max_length=200, description="方案名称")
    description = fields.TextField(null=True)
    is_active = fields.BooleanField(default=True)
    deleted_at = fields.DatetimeField(null=True)


class MoldRepairSchemeLine(BaseModel):
    """模具维修方案行"""

    class Meta:
        table = "apps_kuaizhizao_mold_repair_scheme_lines"
        table_description = "快格轻制造 - 模具维修方案行"
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


class MoldSchemeBinding(BaseModel):
    """模具与方案绑定"""

    class Meta:
        table = "apps_kuaizhizao_mold_scheme_bindings"
        table_description = "快格轻制造 - 模具方案绑定"
        indexes = [("tenant_id",), ("mold_id",), ("scheme_type",)]

    id = fields.IntField(pk=True)
    mold_id = fields.IntField(description="模具ID")
    mold_uuid = fields.CharField(max_length=36)
    scheme_id = fields.IntField(description="方案ID")
    scheme_type = fields.CharField(max_length=32, default="maintenance", description="maintenance/repair")
    deleted_at = fields.DatetimeField(null=True)


class MoldTrial(BaseModel):
    """模具试模单"""

    class Meta:
        table = "apps_kuaizhizao_mold_trials"
        table_description = "快格轻制造 - 模具试模单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("mold_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
    trial_date = fields.DateField()
    trial_result = fields.CharField(max_length=50, null=True, description="合格/不合格")
    operator_id = fields.IntField(null=True)
    operator_name = fields.CharField(max_length=100, null=True)
    status = fields.CharField(max_length=32, default="进行中")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class MoldBorrow(BaseModel):
    """模具领用单"""

    class Meta:
        table = "apps_kuaizhizao_mold_borrows"
        table_description = "快格轻制造 - 模具领用单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("mold_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
    borrow_date = fields.DatetimeField()
    borrower_id = fields.IntField(null=True)
    borrower_name = fields.CharField(max_length=100, null=True)
    department_name = fields.CharField(max_length=200, null=True)
    expected_return_date = fields.DateField(null=True)
    source_type = fields.CharField(max_length=50, null=True)
    source_id = fields.IntField(null=True)
    source_no = fields.CharField(max_length=100, null=True)
    legacy_usage_no = fields.CharField(max_length=100, null=True, description="迁移自旧使用单号")
    status = fields.CharField(max_length=32, default="领用中")
    remark = fields.TextField(null=True)
    deleted_at = fields.DatetimeField(null=True)


class MoldReturn(BaseModel):
    """模具归还单"""

    class Meta:
        table = "apps_kuaizhizao_mold_returns"
        table_description = "快格轻制造 - 模具归还单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("mold_id",), ("borrow_id",), ("reporting_record_id",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
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


class MoldMaintenance(BaseModel):
    """模具保养单"""

    class Meta:
        table = "apps_kuaizhizao_mold_maintenances"
        table_description = "快格轻制造 - 模具保养单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("mold_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
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


class MoldMaintenanceLine(BaseModel):
    """模具保养单行"""

    class Meta:
        table = "apps_kuaizhizao_mold_maintenance_lines"
        table_description = "快格轻制造 - 模具保养单行"
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


class MoldRepair(BaseModel):
    """模具维修单"""

    class Meta:
        table = "apps_kuaizhizao_mold_repairs"
        table_description = "快格轻制造 - 模具维修单"
        unique_together = [("tenant_id", "document_no")]
        indexes = [("tenant_id",), ("mold_id",), ("status",)]

    id = fields.IntField(pk=True)
    document_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
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


class MoldRepairLine(BaseModel):
    """模具维修单行"""

    class Meta:
        table = "apps_kuaizhizao_mold_repair_lines"
        table_description = "快格轻制造 - 模具维修单行"
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


class MoldScrapApplication(BaseModel):
    """模具报废申请"""

    class Meta:
        table = "apps_kuaizhizao_mold_ops_scrap_applications"
        table_description = "快格轻制造 - 模具报废申请"
        unique_together = [("tenant_id", "application_no")]
        indexes = [("tenant_id",), ("mold_id",), ("status",)]

    id = fields.IntField(pk=True)
    application_no = fields.CharField(max_length=64)
    mold_id = fields.IntField()
    mold_uuid = fields.CharField(max_length=36)
    mold_code = fields.CharField(max_length=50, null=True)
    mold_name = fields.CharField(max_length=200, null=True)
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
