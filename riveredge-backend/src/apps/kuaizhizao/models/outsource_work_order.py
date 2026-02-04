"""
工单委外数据模型模块

定义工单委外数据模型，用于管理工单委外业务，支持多组织隔离。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
Updated: 2026-01-20（重命名为工单委外）
"""

from tortoise import fields
from core.models.base import BaseModel


class OutsourceWorkOrder(BaseModel):
    """
    工单委外模型

    用于管理工单委外业务，基于物料来源类型为"委外件"的物料创建。
    支持委外发料、委外收货、委外费用管理。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工单委外编码（组织内唯一）
        name: 委外工单名称
        product_id: 产品ID（关联物料，物料来源类型必须为Outsource）
        product_code: 产品编码
        product_name: 产品名称
        quantity: 计划委外数量
        supplier_id: 委外供应商ID（关联master-data的Supplier）
        supplier_code: 委外供应商编码
        supplier_name: 委外供应商名称
        outsource_operation: 委外工序（从物料的source_config中获取）
        unit_price: 委外单价（从物料的source_config中获取或手动填写）
        total_amount: 委外总金额（quantity × unit_price）
        status: 委外工单状态（draft/released/in_progress/completed/cancelled）
        priority: 优先级（low/normal/high/urgent）
        planned_start_date: 计划开始时间
        planned_end_date: 计划结束时间
        actual_start_date: 实际开始时间
        actual_end_date: 实际结束时间
        received_quantity: 已收货数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
        issued_quantity: 已发料数量（原材料）
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
        table = "apps_kuaizhizao_outsource_work_orders"
        table_description = "快格轻制造 - 委外工单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("product_id",),
            ("supplier_id",),
            ("status",),
            ("planned_start_date",),
            ("planned_end_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="委外工单编码（组织内唯一）")
    name = fields.CharField(max_length=200, null=True, description="委外工单名称（可选）")

    # 产品信息
    product_id = fields.IntField(description="产品ID（关联物料，物料来源类型必须为Outsource）")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")

    # 委外信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="计划委外数量")
    
    # 委外供应商信息
    supplier_id = fields.IntField(description="委外供应商ID（关联master-data的Supplier）")
    supplier_code = fields.CharField(max_length=50, description="委外供应商编码")
    supplier_name = fields.CharField(max_length=200, description="委外供应商名称")
    
    # 委外工序（从物料的source_config中获取）
    outsource_operation = fields.CharField(max_length=200, null=True, description="委外工序")
    
    # 委外价格
    unit_price = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="委外单价")
    total_amount = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="委外总金额（quantity × unit_price）")

    # 状态和优先级
    status = fields.CharField(max_length=20, description="委外工单状态", default="draft")
    priority = fields.CharField(max_length=10, description="优先级", default="normal")
    
    # 冻结信息
    is_frozen = fields.BooleanField(default=False, description="是否冻结")
    freeze_reason = fields.TextField(null=True, description="冻结原因")
    frozen_at = fields.DatetimeField(null=True, description="冻结时间")
    frozen_by = fields.IntField(null=True, description="冻结人ID")
    frozen_by_name = fields.CharField(max_length=100, null=True, description="冻结人姓名")

    # 时间信息
    planned_start_date = fields.DatetimeField(null=True, description="计划开始时间")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束时间")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始时间")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束时间")

    # 完成信息
    received_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已收货数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格数量")
    
    # 发料信息
    issued_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已发料数量（原材料）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 创建更新信息
    created_by = fields.IntField(description="创建人ID")
    created_by_name = fields.CharField(max_length=100, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.product_name} ({self.supplier_name})"


class OutsourceMaterialIssue(BaseModel):
    """
    委外发料模型

    用于管理提供给委外供应商的原材料。

    Attributes:
        id: 主键ID
        uuid: 业务ID（UUID）
        tenant_id: 组织ID
        code: 委外发料单编码（组织内唯一）
        outsource_work_order_id: 委外工单ID
        outsource_work_order_code: 委外工单编码
        material_id: 物料ID（原材料）
        material_code: 物料编码
        material_name: 物料名称
        quantity: 发料数量
        unit: 单位
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        location_id: 库位ID（可选）
        location_name: 库位名称（可选）
        batch_number: 批次号（可选）
        status: 状态（draft/completed/cancelled）
        issued_at: 发料时间
        issued_by: 发料人ID
        issued_by_name: 发料人姓名
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        created_at: 创建时间
        updated_at: 更新时间
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_outsource_material_issues"
        table_description = "快格轻制造 - 委外发料单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("outsource_work_order_id",),
            ("material_id",),
            ("warehouse_id",),
            ("status",),
            ("issued_at",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="委外发料单编码（组织内唯一）")

    # 委外工单关联
    outsource_work_order_id = fields.IntField(description="委外工单ID")
    outsource_work_order_code = fields.CharField(max_length=50, description="委外工单编码")

    # 物料信息
    material_id = fields.IntField(description="物料ID（原材料）")
    material_code = fields.CharField(max_length=50, description="物料编码")
    material_name = fields.CharField(max_length=200, description="物料名称")

    # 发料信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="发料数量")
    unit = fields.CharField(max_length=20, description="单位")

    # 仓库信息
    warehouse_id = fields.IntField(null=True, description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID（可选）")
    location_name = fields.CharField(max_length=200, null=True, description="库位名称（可选）")
    batch_number = fields.CharField(max_length=100, null=True, description="批次号（可选）")

    # 状态信息
    status = fields.CharField(max_length=20, description="状态", default="draft")

    # 发料信息
    issued_at = fields.DatetimeField(null=True, description="发料时间")
    issued_by = fields.IntField(null=True, description="发料人ID")
    issued_by_name = fields.CharField(max_length=100, null=True, description="发料人姓名")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 创建更新信息
    created_by = fields.IntField(description="创建人ID")
    created_by_name = fields.CharField(max_length=100, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.material_name} ({self.quantity} {self.unit})"


class OutsourceMaterialReceipt(BaseModel):
    """
    委外收货模型

    用于管理委外加工完成后的成品收货。

    Attributes:
        id: 主键ID
        uuid: 业务ID（UUID）
        tenant_id: 组织ID
        code: 委外收货单编码（组织内唯一）
        outsource_work_order_id: 委外工单ID
        outsource_work_order_code: 委外工单编码
        quantity: 收货数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
        unit: 单位
        warehouse_id: 仓库ID
        warehouse_name: 仓库名称
        location_id: 库位ID（可选）
        location_name: 库位名称（可选）
        batch_number: 批次号（可选）
        status: 状态（draft/completed/cancelled）
        received_at: 收货时间
        received_by: 收货人ID
        received_by_name: 收货人姓名
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        created_at: 创建时间
        updated_at: 更新时间
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_outsource_material_receipts"
        table_description = "快格轻制造 - 委外收料单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("outsource_work_order_id",),
            ("warehouse_id",),
            ("status",),
            ("received_at",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="委外收货单编码（组织内唯一）")

    # 委外工单关联
    outsource_work_order_id = fields.IntField(description="委外工单ID")
    outsource_work_order_code = fields.CharField(max_length=50, description="委外工单编码")

    # 收货信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="收货数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格数量")
    unit = fields.CharField(max_length=20, description="单位")

    # 仓库信息
    warehouse_id = fields.IntField(null=True, description="仓库ID")
    warehouse_name = fields.CharField(max_length=200, null=True, description="仓库名称")
    location_id = fields.IntField(null=True, description="库位ID（可选）")
    location_name = fields.CharField(max_length=200, null=True, description="库位名称（可选）")
    batch_number = fields.CharField(max_length=100, null=True, description="批次号（可选）")

    # 状态信息
    status = fields.CharField(max_length=20, description="状态", default="draft")

    # 收货信息
    received_at = fields.DatetimeField(null=True, description="收货时间")
    received_by = fields.IntField(null=True, description="收货人ID")
    received_by_name = fields.CharField(max_length=100, null=True, description="收货人姓名")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 创建更新信息
    created_by = fields.IntField(description="创建人ID")
    created_by_name = fields.CharField(max_length=100, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.quantity} {self.unit}"
