"""图档借阅单"""

from tortoise import fields

from core.models.base import BaseModel


class DrawingLoan(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_loans"
        table_description = "基础数据管理 - 图档借阅单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("status",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, description="借阅单号")
    name = fields.CharField(max_length=200, description="借阅单名称")
    purpose = fields.CharField(max_length=500, null=True, description="借阅用途")
    due_at = fields.DatetimeField(description="应还时间")
    status = fields.CharField(
        max_length=20,
        default="Draft",
        description="Draft/Pending/Borrowed/Returned",
    )
    returned_at = fields.DatetimeField(null=True, description="归还时间")
    returned_by = fields.IntField(null=True, description="归还人ID")
    returned_by_name = fields.CharField(max_length=100, null=True, description="归还人姓名")
    deleted_at = fields.DatetimeField(null=True, description="软删除")
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    def __str__(self) -> str:
        return self.code


class DrawingLoanLine(BaseModel):
    class Meta:
        table = "apps_master_data_drawing_loan_lines"
        table_description = "基础数据管理 - 图档借阅明细"
        indexes = [
            ("tenant_id",),
            ("loan_id",),
            ("drawing_id",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    loan_id = fields.IntField(description="借阅单ID")
    drawing_id = fields.IntField(description="图纸ID")
    drawing_uuid = fields.CharField(max_length=36, description="图纸UUID")
    drawing_code = fields.CharField(max_length=50, description="图号")
    drawing_name = fields.CharField(max_length=200, description="图纸名称")
    drawing_revision = fields.CharField(max_length=20, description="修订版")
    security_level = fields.CharField(max_length=20, description="借出时密级")
