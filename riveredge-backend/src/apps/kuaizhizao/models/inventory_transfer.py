"""
库存调拨单数据模型模块

定义库存调拨单数据模型，支持库存调拨流程管理。

Author: Luigi Lu
Date: 2026-01-15
"""

from tortoise import fields
from core.models.base import BaseModel


class InventoryTransfer(BaseModel):
    """
    库存调拨单模型

    用于管理库存调拨流程，包括调拨单创建、执行、库存更新等。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 调拨单号
        from_warehouse_id: 调出仓库ID
        from_warehouse_name: 调出仓库名称
        to_warehouse_id: 调入仓库ID
        to_warehouse_name: 调入仓库名称
        transfer_date: 调拨日期
        status: 状态（draft/in_progress/completed/cancelled）
        total_items: 调拨物料总数
        total_quantity: 调拨总数量
        total_amount: 调拨总金额
        transfer_reason: 调拨原因
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        executed_by: 执行人ID
        executed_by_name: 执行人姓名
        executed_at: 执行时间
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_inventory_transfers"
        app = "models"  # 指定 Tortoise ORM app 名称
        indexes = [
            ("tenant_id",),
            ("from_warehouse_id",),
            ("to_warehouse_id",),
            ("transfer_date",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 业务编码
    code = fields.CharField(max_length=50, unique=True, description="调拨单号")

    # 调出仓库信息
    from_warehouse_id = fields.IntField(description="调出仓库ID")
    from_warehouse_name = fields.CharField(max_length=200, description="调出仓库名称")

    # 调入仓库信息
    to_warehouse_id = fields.IntField(description="调入仓库ID")
    to_warehouse_name = fields.CharField(max_length=200, description="调入仓库名称")

    # 调拨信息
    transfer_date = fields.DatetimeField(description="调拨日期")
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/in_progress/completed/cancelled）")

    # 统计信息
    total_items = fields.IntField(default=0, description="调拨物料总数")
    total_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="调拨总数量")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="调拨总金额")

    # 调拨原因和备注
    transfer_reason = fields.TextField(null=True, description="调拨原因")
    remarks = fields.TextField(null=True, description="备注")

    # 执行信息
    executed_by = fields.IntField(null=True, description="执行人ID")
    executed_by_name = fields.CharField(max_length=100, null=True, description="执行人姓名")
    executed_at = fields.DatetimeField(null=True, description="执行时间")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.from_warehouse_name} → {self.to_warehouse_name}"


class InventoryTransferItem(BaseModel):
    """
    库存调拨明细模型

    用于记录调拨单中的每个物料的调拨明细信息。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        transfer_id: 调拨单ID（关联InventoryTransfer）
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        from_warehouse_id: 调出仓库ID
        from_location_id: 调出库位ID（可选）
        from_location_code: 调出库位编码（可选）
        to_warehouse_id: 调入仓库ID
        to_location_id: 调入库位ID（可选）
        to_location_code: 调入库位编码（可选）
        batch_no: 批次号（可选）
        quantity: 调拨数量
        unit_price: 单价
        amount: 金额
        status: 状态（pending/transferred）
        remarks: 备注
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_inventory_transfer_items"
        app = "models"  # 指定 Tortoise ORM app 名称
        indexes = [
            ("tenant_id",),
            ("transfer_id",),
            ("material_id",),
            ("from_warehouse_id",),
            ("to_warehouse_id",),
            ("status",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联信息
    transfer_id = fields.IntField(description="调拨单ID（关联InventoryTransfer）")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 调出仓库和库位信息
    from_warehouse_id = fields.IntField(description="调出仓库ID")
    from_location_id = fields.IntField(null=True, description="调出库位ID（可选）")
    from_location_code = fields.CharField(max_length=50, null=True, description="调出库位编码（可选）")

    # 调入仓库和库位信息
    to_warehouse_id = fields.IntField(description="调入仓库ID")
    to_location_id = fields.IntField(null=True, description="调入库位ID（可选）")
    to_location_code = fields.CharField(max_length=50, null=True, description="调入库位编码（可选）")

    # 批次信息
    batch_no = fields.CharField(max_length=100, null=True, description="批次号（可选）")

    # 数量信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="调拨数量")

    # 金额信息
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="单价")
    amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="金额")

    # 状态
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/transferred）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.material_code} - {self.material_name} ({self.quantity})"
