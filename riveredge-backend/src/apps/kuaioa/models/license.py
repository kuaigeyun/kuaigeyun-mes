"""证照台账模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaLicense(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    license_code = fields.CharField(max_length=50, description="证照编号")
    license_name = fields.CharField(max_length=200, description="证照名称")
    license_type = fields.CharField(max_length=50, default="business", description="证照类型")
    issuing_authority = fields.CharField(max_length=200, null=True, description="发证机关")
    holder_name = fields.CharField(max_length=100, null=True, description="持有主体")
    issue_date = fields.DateField(null=True, description="发证日期")
    expiry_date = fields.DateField(null=True, description="到期日期")
    status = fields.CharField(max_length=30, default="valid", description="状态")
    reminder_days = fields.IntField(default=30, description="到期提醒天数")
    file_uuid = fields.CharField(max_length=36, null=True, description="附件UUID")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_licenses"
        table_description = "轻办公 - 证照台账"
        unique_together = (("tenant_id", "license_code"),)
        indexes = [("tenant_id", "license_type"), ("tenant_id", "expiry_date")]

    class PydanticMeta:
        exclude = ["deleted_at"]
