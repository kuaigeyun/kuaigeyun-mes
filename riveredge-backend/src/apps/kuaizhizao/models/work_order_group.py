"""
工单组数据模型

按需求行（成品）将 BOM 展开的多张生产/委外工单编为一组。
"""

from tortoise import fields
from core.models.base import BaseModel


class WorkOrderGroup(BaseModel):
    """
    工单组：一次需求行 BOM 展开产生的成品 + 半成品 + 委外工单集合。
    """

    class Meta:
        table = "apps_kuaizhizao_work_order_groups"
        table_description = "快格轻制造 - 工单组"
        indexes = [
            ("tenant_id",),
            ("group_code",),
            ("demand_computation_id",),
            ("root_demand_item_id",),
            ("root_material_id",),
            ("status",),
            ("sales_order_id",),
        ]
        unique_together = [("tenant_id", "group_code")]

    id = fields.IntField(pk=True, description="主键ID")
    group_code = fields.CharField(max_length=50, description="工单组编码（组织内唯一）")
    group_name = fields.CharField(max_length=200, null=True, description="工单组名称")

    root_demand_item_id = fields.IntField(description="组成品需求行 ID")
    root_material_id = fields.IntField(description="组成品物料 ID")
    root_material_code = fields.CharField(max_length=50, description="组成品物料编码")
    root_material_name = fields.CharField(max_length=200, description="组成品物料名称")

    demand_id = fields.IntField(null=True, description="需求 ID")
    demand_computation_id = fields.IntField(description="需求计算 ID")
    sales_order_id = fields.IntField(null=True, description="销售订单 ID（MTO）")

    status = fields.CharField(
        max_length=20,
        default="draft",
        description="组状态：draft/released/in_progress/completed/cancelled",
    )
    has_direct_supply = fields.BooleanField(
        default=False,
        description="组内是否含直接生产（不入库）半成品",
    )

    root_work_order_id = fields.IntField(null=True, description="组成品生产工单 ID")
    member_count = fields.IntField(default=0, description="组成员工单数（含委外）")

    remarks = fields.TextField(null=True, description="备注")
    created_by = fields.IntField(null=True, description="创建人 ID")
    updated_by = fields.IntField(null=True, description="更新人 ID")
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
