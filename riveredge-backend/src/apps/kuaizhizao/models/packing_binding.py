"""
装箱打包绑定记录数据模型模块

定义装箱打包绑定记录数据模型，支持成品入库单的装箱绑定、产品序列号绑定、包装物料绑定等。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class PackingBinding(BaseModel):
    """
    装箱打包绑定记录模型

    用于记录成品入库单中的装箱绑定信息，支持产品序列号绑定、包装物料绑定等。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        finished_goods_receipt_id: 成品入库单ID（关联FinishedGoodsReceipt）
        product_id: 产品ID
        product_code: 产品编码
        product_name: 产品名称
        product_serial_no: 产品序列号（可选）
        packing_material_id: 包装物料ID（可选）
        packing_material_code: 包装物料编码（可选）
        packing_material_name: 包装物料名称（可选）
        packing_quantity: 装箱数量
        box_no: 箱号（可选）
        binding_method: 绑定方式（scan/manual）
        bound_by: 绑定人ID
        bound_by_name: 绑定人姓名
        bound_at: 绑定时间
        remarks: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_packing_bindings"
        table_description = "快格轻制造 - 装箱打包绑定记录"
        indexes = [
            ("tenant_id",),
            ("finished_goods_receipt_id",),
            ("product_id",),
            ("product_serial_no",),
            ("packing_material_id",),
            ("bound_at",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联信息
    finished_goods_receipt_id = fields.IntField(description="成品入库单ID（关联FinishedGoodsReceipt）")
    product_id = fields.IntField(description="产品ID")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")
    product_serial_no = fields.CharField(max_length=200, null=True, description="产品序列号（可选）")

    # 包装信息
    packing_material_id = fields.IntField(null=True, description="包装物料ID（可选）")
    packing_material_code = fields.CharField(max_length=50, null=True, description="包装物料编码（可选）")
    packing_material_name = fields.CharField(max_length=200, null=True, description="包装物料名称（可选）")
    packing_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="装箱数量")
    box_no = fields.CharField(max_length=100, null=True, description="箱号（可选）")

    # 绑定信息
    binding_method = fields.CharField(max_length=20, default="manual", description="绑定方式（scan/manual）")
    barcode = fields.CharField(max_length=200, null=True, description="条码（可选，用于扫码绑定）")
    bound_by = fields.IntField(description="绑定人ID")
    bound_by_name = fields.CharField(max_length=100, description="绑定人姓名")
    bound_at = fields.DatetimeField(description="绑定时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.product_name} - {self.packing_quantity} ({self.box_no or '无箱号'})"

