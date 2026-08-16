"""请假出差模型。"""

from tortoise import fields

from core.models.base import BaseModel


class KuaioaLeaveRequest(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    request_code = fields.CharField(max_length=50, description="申请单号")
    leave_type = fields.CharField(max_length=30, description="类型")
    title = fields.CharField(max_length=200, description="标题")
    start_at = fields.DatetimeField(description="开始时间")
    end_at = fields.DatetimeField(description="结束时间")
    days = fields.DecimalField(max_digits=8, decimal_places=2, null=True, description="天数")
    destination = fields.CharField(max_length=200, null=True, description="出差目的地")
    reason = fields.TextField(null=True, description="事由")
    status = fields.CharField(max_length=30, default="draft", description="状态")
    applicant_id = fields.IntField(null=True, description="申请人")
    applicant_name = fields.CharField(max_length=100, null=True, description="申请人姓名")
    department_name = fields.CharField(max_length=100, null=True, description="申请部门")
    notes = fields.TextField(null=True, description="备注")
    submitted_at = fields.DatetimeField(null=True, description="提交时间")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaioa_leave_requests"
        table_description = "轻办公 - 请假出差申请"
        unique_together = (("tenant_id", "request_code"),)
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "applicant_id"),
            ("tenant_id", "leave_type"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
