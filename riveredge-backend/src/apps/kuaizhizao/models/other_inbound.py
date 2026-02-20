"""
其他入库单模型

提供其他入库单数据模型定义，用于盘盈/样品/报废/其他等杂项入库。

Author: RiverEdge Team
Date: 2026-02-19
"""

from tortoise import fields
from core.models.base import BaseModel


class OtherInbound(BaseModel):
    """
    其他入库单

    用于记录无上游单据的杂项入库，通过 reason_type 区分（盘盈/样品/报废/其他）
    """
    tenant_id = fields.IntField(description="租户ID")
    inbound_code = fields.CharField(max_length=50, unique=True, description="入库单编码")

    # 入库原因
    reason_type = fields.CharField(max_length=20, description="原因类型：盘盈/样品/报废/其他")
    reason_desc = fields.TextField(null=True, description="原因说明")

    # 入库信息
    warehouse_id = fields.IntField(description="入库仓库ID")
    warehouse_name = fields.CharField(max_length=100, description="入库仓库名称")
    receipt_time = fields.DatetimeField(null=True, description="实际入库时间")

    # 入库人信息
    receiver_id = fields.IntField(null=True, description="入库人ID")
    receiver_name = fields.CharField(max_length=100, null=True, description="入库人姓名")

    # 审核信息
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    review_time = fields.DatetimeField(null=True, description="审核时间")
    review_status = fields.CharField(max_length=20, default="待审核", description="审核状态")
    review_remarks = fields.TextField(null=True, description="审核备注")

    status = fields.CharField(max_length=20, default="待入库", description="入库状态")
    total_quantity = fields.DecimalField(max_digits=10, decimal_places=2, default=0, description="总入库数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    notes = fields.TextField(null=True, description="备注")
    is_active = fields.BooleanField(default=True, description="是否有效")
    created_by = fields.IntField(null=True, description="创建人ID")
    updated_by = fields.IntField(null=True, description="更新人ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_other_inbounds"
        table_description = "快格轻制造 - 其他入库单"
        indexes = [
            ("tenant_id",),
            ("inbound_code",),
            ("warehouse_id",),
            ("reason_type",),
            ("status",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
