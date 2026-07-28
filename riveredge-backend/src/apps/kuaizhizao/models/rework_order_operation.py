"""
返工单关联工序数据模型模块

定义返工单与工单工序的关联，用于记录返工单涉及哪几道工序。

Author: Luigi Lu
Date: 2026-03-04
"""

from tortoise import fields
from core.models.base import BaseModel


class ReworkOrderOperation(BaseModel):
    """继承 BaseModel 获得 id, uuid, tenant_id, created_at, updated_at"""
    """
    返工单关联工序模型

    用于记录返工单涉及原工单的哪几道工序需要返工。

    Attributes:
        id: 主键ID
        rework_order_id: 返工单ID（关联ReworkOrder）
        work_order_operation_id: 工单工序ID（关联WorkOrderOperation）
        sequence: 工序顺序（用于展示排序）
    """

    class Meta:
        table = "apps_kuaizhizao_rework_order_operations"
        table_description = "快格轻制造 - 返工单关联工序"
        indexes = [
            ("tenant_id",),
            ("rework_order_id",),
            ("work_order_operation_id",),
        ]
        unique_together = [("tenant_id", "rework_order_id", "work_order_operation_id")]

    id = fields.IntField(pk=True, description="主键ID")
    rework_order_id = fields.IntField(description="返工单ID（关联ReworkOrder）")
    work_order_operation_id = fields.IntField(description="工单工序ID（关联WorkOrderOperation）")
    sequence = fields.IntField(default=0, description="工序顺序（用于展示排序）")
    role = fields.CharField(
        max_length=20,
        default="start",
        description="工序角色（start/planned/dynamic）",
    )
    status = fields.CharField(
        max_length=20,
        default="pending",
        description="执行状态（pending/active/completed/skipped）",
    )
    input_quantity = fields.DecimalField(
        max_digits=18, decimal_places=4, null=True, description="投入数量"
    )
    qualified_quantity = fields.DecimalField(
        max_digits=18, decimal_places=4, default=0, description="合格数量汇总"
    )
    unqualified_quantity = fields.DecimalField(
        max_digits=18, decimal_places=4, default=0, description="不合格数量汇总"
    )
    started_at = fields.DatetimeField(null=True, description="开始时间")
    completed_at = fields.DatetimeField(null=True, description="完成时间")
    decision_reason = fields.TextField(null=True, description="动态追加/决策原因")
    decided_by = fields.IntField(null=True, description="决策人 ID")
    decided_by_name = fields.CharField(max_length=100, null=True, description="决策人姓名")
    decided_at = fields.DatetimeField(null=True, description="决策时间")

    def __str__(self):
        return f"返工单#{self.rework_order_id} - 工序#{self.work_order_operation_id}"
