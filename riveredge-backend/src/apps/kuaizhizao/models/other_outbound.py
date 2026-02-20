"""
其他出库单模型

提供其他出库单数据模型定义，用于盘亏/样品/报废/其他等杂项出库。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class OtherOutbound(BaseModel):
    """
    其他出库单

    用于记录无上游单据的杂项出库，通过 reason_type 区分（盘亏/样品/报废/其他）
    """
    tenant_id = fields.IntField(description="租户ID")
    outbound_code = fields.CharField(max_length=50, unique=True, description="出库单编码")

    # 出库原因
    reason_type = fields.CharField(max_length=20, description="原因类型：盘亏/样品/报废/其他")
    reason_desc = fields.TextField(null=True, description="原因说明")

    # 出库信息
    warehouse_id = fields.IntField(description="出库仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="出库仓库名称")
    delivery_time = fields.DatetimeField(null=True, description="实际出库时间")

    # 出库人信息
    deliverer_id = fields.IntField(null=True, description="出库人ID")
    deliverer_name = fields.CharField(max_length=100, null=True, description="出库人姓名")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待出库", description="出库状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总出库数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_other_outbounds"
        table_description = "快格轻制造 - 其他出库单"
        indexes = [
            ("tenant_id",),
            ("outbound_code",),
            ("warehouse_id",),
            ("reason_type",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
