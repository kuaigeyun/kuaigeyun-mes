"""
配料单数据模型模块

定义配料单数据模型，支持按工单/计划从主仓/线边仓拣选物料并按 BOM 配好，供产线使用。
配料是提前准备、集中调配的仓储作业，区别于生产领料（工单直接领料）。

Author: Luigi Lu
Date: 2026-02-28
"""

from tortoise import fields
from core.models.base import BaseModel


class BatchingOrder(BaseModel):
    """
    配料单模型

    用于管理配料流程：按工单或生产计划，从主仓/线边仓拣选物料并按 BOM 配好。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        code: 配料单号
        warehouse_id: 拣选源仓库ID
        warehouse_name: 拣选源仓库名称
        work_order_id: 关联工单ID（可选）
        work_order_code: 关联工单编码（可选）
        production_plan_id: 关联生产计划ID（可选）
        batching_date: 配料日期
        status: 状态（draft/picking/completed/cancelled）
        total_items: 物料种类数
        target_warehouse_id: 目标线边仓ID（可选）
        target_warehouse_name: 目标线边仓名称（可选）
        remarks: 备注
        executed_by/executed_at: 执行信息
    """

    class Meta:
        table = "apps_kuaizhizao_batching_orders"
        table_description = "快格轻制造 - 配料单"
        indexes = [
            ("tenant_id",),
            ("warehouse_id",),
            ("work_order_id",),
            ("batching_date",),
            ("status",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    code = fields.CharField(max_length=50, unique=True, description="配料单号")

    warehouse_id = fields.IntField(description="拣选源仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="拣选源仓库名称")

    work_order_id = fields.IntField(null=True, description="关联工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="关联工单编码")
    production_plan_id = fields.IntField(null=True, description="关联生产计划ID")

    batching_date = fields.DatetimeField(description="配料日期")
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/picking/completed/cancelled）")

    total_items = fields.IntField(default=0, description="物料种类数")

    target_warehouse_id = fields.IntField(null=True, description="目标线边仓ID")
    target_warehouse_name = fields.CharField(max_length=200, null=True, description="目标线边仓名称")

    remarks = fields.TextField(null=True, description="备注")

    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")
    executed_by = fields.IntField(null=True, description="执行人ID")
    executed_by_name = fields.CharField(max_length=100, null=True, description="执行人姓名")
    executed_at = fields.DatetimeField(null=True, description="执行时间")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.code} - {self.warehouse_name}"


class BatchingOrderItem(BaseModel):
    """
    配料单明细模型

    记录配料单中每个物料的需求与已拣数量。

    Attributes:
        batching_order_id: 配料单ID
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        unit: 单位
        required_quantity: 需求数量
        picked_quantity: 已拣数量
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        location_id: 库位ID（可选）
        location_code: 库位编码（可选）
        batch_no: 批次号（可选）
        status: 状态（pending/picked）
    """

    class Meta:
        table = "apps_kuaizhizao_batching_order_items"
        table_description = "快格轻制造 - 配料单明细"
        indexes = [
            ("tenant_id",),
            ("batching_order_id",),
            ("material_id",),
            ("status",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    batching_order_id = fields.IntField(description="配料单ID")

    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    unit = fields.CharField(max_length=20, default="", description="单位")

    required_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="需求数量")
    picked_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已拣数量")

    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码")

    batch_no = fields.CharField(max_length=50, null=True, description="批次号")

    status = fields.CharField(max_length=20, default="pending", description="状态（pending/picked）")
    remarks = fields.TextField(null=True, description="备注")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"{self.material_code} - {self.material_name} ({self.required_quantity})"
