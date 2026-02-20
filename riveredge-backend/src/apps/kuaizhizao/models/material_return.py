"""
还料单模型

提供还料单数据模型定义，用于借料归还。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialReturn(BaseModel):
    """
    还料单

    用于记录借料归还，关联借料单
    """
    tenant_id = fields.IntField(description="租户ID")
    return_code = fields.CharField(max_length=50, unique=True, description="还料单编码")

    # 关联借料单
    borrow_id = fields.IntField(description="借料单ID")
    borrow_code = fields.CharField(max_length=50, description="借料单编码")

    # 归还仓库
    warehouse_id = fields.IntField(description="归还仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="归还仓库名称")

    # 归还人信息
    returner_id = fields.IntField(null=True, description="归还人ID")
    returner_name = fields.CharField(max_length=100, null=True, description="归还人姓名")
    return_time = fields.DatetimeField(null=True, description="实际归还时间")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待归还", description="还料状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总归还数量")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_material_returns"
        table_description = "快格轻制造 - 还料单"
        indexes = [
            ("tenant_id",),
            ("return_code",),
            ("borrow_id",),
            ("warehouse_id",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
