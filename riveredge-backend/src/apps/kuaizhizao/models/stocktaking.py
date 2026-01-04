"""
库存盘点单数据模型模块

定义库存盘点单数据模型，支持库存盘点流程管理。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class Stocktaking(BaseModel):
    """
    库存盘点单模型

    用于管理库存盘点流程，包括盘点单创建、执行、差异处理等。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 盘点单号
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        stocktaking_date: 盘点日期
        status: 状态（draft/in_progress/completed/cancelled）
        stocktaking_type: 盘点类型（full/partial/cycle）
        total_items: 盘点物料总数
        counted_items: 已盘点物料数
        total_differences: 差异总数
        total_difference_amount: 差异总金额
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        approved_by: 审核人ID
        approved_by_name: 审核人姓名
        approved_at: 审核时间
        completed_by: 完成人ID
        completed_by_name: 完成人姓名
        completed_at: 完成时间
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_stocktakings"
        indexes = [
            ("tenant_id",),
            ("warehouse_id",),
            ("stocktaking_date",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 业务编码
    code = fields.CharField(max_length=50, unique=True, description="盘点单号")

    # 仓库信息
    warehouse_id = fields.IntField(description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, description="仓库名称")

    # 盘点信息
    stocktaking_date = fields.DatetimeField(description="盘点日期")
    status = fields.CharField(max_length=20, default="draft", description="状态（draft/in_progress/completed/cancelled）")
    stocktaking_type = fields.CharField(max_length=20, default="full", description="盘点类型（full/partial/cycle）")

    # 统计信息
    total_items = fields.IntField(default=0, description="盘点物料总数")
    counted_items = fields.IntField(default=0, description="已盘点物料数")
    total_differences = fields.IntField(default=0, description="差异总数")
    total_difference_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="差异总金额")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 审核信息
    approved_by = fields.IntField(null=True, description="审核人ID")
    approved_by_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    approved_at = fields.DatetimeField(null=True, description="审核时间")

    # 完成信息
    completed_by = fields.IntField(null=True, description="完成人ID")
    completed_by_name = fields.CharField(max_length=100, null=True, description="完成人姓名")
    completed_at = fields.DatetimeField(null=True, description="完成时间")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.warehouse_name}"


class StocktakingItem(BaseModel):
    """
    库存盘点明细模型

    用于记录盘点单中的每个物料的盘点明细信息。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        stocktaking_id: 盘点单ID（关联Stocktaking）
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        warehouse_id: 仓库ID
        location_id: 库位ID（可选）
        location_code: 库位编码（可选）
        batch_no: 批次号（可选）
        book_quantity: 账面数量
        actual_quantity: 实际数量
        difference_quantity: 差异数量（实际数量 - 账面数量）
        unit_price: 单价
        difference_amount: 差异金额
        counted_by: 盘点人ID
        counted_by_name: 盘点人姓名
        counted_at: 盘点时间
        status: 状态（pending/counted/adjusted）
        remarks: 备注
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_stocktaking_items"
        indexes = [
            ("tenant_id",),
            ("stocktaking_id",),
            ("material_id",),
            ("warehouse_id",),
            ("status",),
            ("counted_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联信息
    stocktaking_id = fields.IntField(description="盘点单ID（关联Stocktaking）")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 仓库和库位信息
    warehouse_id = fields.IntField(description="仓库ID")
    location_id = fields.IntField(null=True, description="库位ID（可选）")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码（可选）")
    batch_no = fields.CharField(max_length=100, null=True, description="批次号（可选）")

    # 数量信息
    book_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="账面数量")
    actual_quantity = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="实际数量")
    difference_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="差异数量")

    # 金额信息
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="单价")
    difference_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="差异金额")

    # 盘点信息
    counted_by = fields.IntField(null=True, description="盘点人ID")
    counted_by_name = fields.CharField(max_length=100, null=True, description="盘点人姓名")
    counted_at = fields.DatetimeField(null=True, description="盘点时间")

    # 状态
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/counted/adjusted）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.material_code} - {self.material_name}"

