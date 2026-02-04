"""
工序委外数据模型模块

定义工序委外数据模型，用于管理工序委外业务，支持多组织隔离。

Author: Luigi Lu
Date: 2025-01-04
Updated: 2026-01-20（重命名为工序委外）
"""

from tortoise import fields
from core.models.base import BaseModel


class OutsourceOrder(BaseModel):
    """
    工序委外模型

    用于管理工序委外业务，关联工单和工序，支持委外入库关联。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工序委外单编码（组织内唯一）
        work_order_id: 工单ID（关联WorkOrder）
        work_order_code: 工单编码
        work_order_operation_id: 工单工序ID（关联WorkOrderOperation）
        operation_id: 工序ID（关联master-data的Operation）
        operation_code: 工序编码
        operation_name: 工序名称
        supplier_id: 供应商ID（关联master-data的Supplier）
        supplier_code: 供应商编码
        supplier_name: 供应商名称
        outsource_quantity: 委外数量
        received_quantity: 已接收数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
        unit_price: 单价
        total_amount: 总金额
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        status: 委外单状态（draft/released/in_progress/completed/cancelled）
        purchase_receipt_id: 采购入库单ID（关联PurchaseReceipt，用于委外入库）
        purchase_receipt_code: 采购入库单编码
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        updated_by: 更新人ID
        updated_by_name: 更新人姓名
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_outsource_orders"
        table_description = "快格轻制造 - 委外单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("work_order_id",),
            ("work_order_operation_id",),
            ("operation_id",),
            ("supplier_id",),
            ("status",),
            ("planned_start_date",),
            ("purchase_receipt_id",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="委外单编码（组织内唯一）")

    # 工单和工序关联
    work_order_id = fields.IntField(description="工单ID（关联WorkOrder）")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    work_order_operation_id = fields.IntField(description="工单工序ID（关联WorkOrderOperation）")
    operation_id = fields.IntField(description="工序ID（关联master-data的Operation）")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")

    # 供应商信息
    supplier_id = fields.IntField(description="供应商ID（关联master-data的Supplier）")
    supplier_code = fields.CharField(max_length=50, description="供应商编码")
    supplier_name = fields.CharField(max_length=200, description="供应商名称")

    # 委外数量和金额
    outsource_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="委外数量")
    received_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已接收数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格数量")
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="总金额")

    # 时间信息
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")

    # 状态信息
    status = fields.CharField(max_length=20, default="draft", description="委外单状态（draft/released/in_progress/completed/cancelled）")

    # 采购入库关联（用于委外入库）
    purchase_receipt_id = fields.IntField(null=True, description="采购入库单ID（关联PurchaseReceipt）")
    purchase_receipt_code = fields.CharField(max_length=50, null=True, description="采购入库单编码")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 创建人和更新人信息（BaseModel不包含，需要自己定义）
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.operation_name} ({self.supplier_name})"

