"""
借料单模型

提供借料单数据模型定义，用于工具间/研发等无工单借料。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialBorrow(BaseModel):
    """
    借料单

    用于记录无工单的物料借出，如工具间、研发借料
    """
    tenant_id = fields.IntField(description="租户ID")
    borrow_code = fields.CharField(max_length=50, unique=True, description="借料单编码")

    # 借出仓库
    warehouse_id = fields.IntField(description="借出仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="借出仓库名称")

    # 借料人信息
    borrower_id = fields.IntField(null=True, description="借料人ID")
    borrower_name = fields.CharField(max_length=100, null=True, description="借料人姓名")
    department = fields.CharField(max_length=100, null=True, description="部门")
    expected_return_date = fields.DateField(null=True, description="预计归还日期")

    # 借出时间
    borrow_time = fields.DatetimeField(null=True, description="实际借出时间")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待借出", description="借料状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总借出数量")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_material_borrows"
        table_description = "快格轻制造 - 借料单"
        indexes = [
            ("tenant_id",),
            ("borrow_code",),
            ("warehouse_id",),
            ("borrower_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
