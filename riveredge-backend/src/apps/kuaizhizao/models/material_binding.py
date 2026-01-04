"""
物料绑定记录数据模型模块

定义物料绑定记录数据模型，支持报工记录的上料和下料物料绑定。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class MaterialBinding(BaseModel):
    """
    物料绑定记录模型

    用于记录报工记录中的上料和下料物料绑定信息，支持扫码绑定和手动选择。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        reporting_record_id: 报工记录ID（关联ReportingRecord）
        work_order_id: 工单ID
        work_order_code: 工单编码
        operation_id: 工序ID
        operation_code: 工序编码
        operation_name: 工序名称
        binding_type: 绑定类型（feeding/discharging）
        material_id: 物料ID
        material_code: 物料编码
        material_name: 物料名称
        quantity: 绑定数量
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        location_id: 库位ID（可选）
        location_code: 库位编码（可选）
        batch_no: 批次号（可选）
        barcode: 条码（可选，用于扫码绑定）
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
        table = "apps_kuaizhizao_material_bindings"
        indexes = [
            ("tenant_id",),
            ("reporting_record_id",),
            ("work_order_id",),
            ("operation_id",),
            ("material_id",),
            ("binding_type",),
            ("bound_at",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 关联信息
    reporting_record_id = fields.IntField(description="报工记录ID（关联ReportingRecord）")
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    operation_id = fields.IntField(description="工序ID")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")

    # 绑定信息
    binding_type = fields.CharField(max_length=20, description="绑定类型（feeding/discharging）")
    material_id = fields.IntField(description="物料ID")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="绑定数量")

    # 仓库和库位信息
    warehouse_id = fields.IntField(null=True, description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID（可选）")
    location_code = fields.CharField(max_length=50, null=True, description="库位编码（可选）")
    batch_no = fields.CharField(max_length=100, null=True, description="批次号（可选）")

    # 条码信息
    barcode = fields.CharField(max_length=200, null=True, description="条码（可选，用于扫码绑定）")
    binding_method = fields.CharField(max_length=20, default="manual", description="绑定方式（scan/manual）")

    # 绑定人信息
    bound_by = fields.IntField(description="绑定人ID")
    bound_by_name = fields.CharField(max_length=100, description="绑定人姓名")
    bound_at = fields.DatetimeField(description="绑定时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.binding_type} - {self.material_name} ({self.quantity})"

