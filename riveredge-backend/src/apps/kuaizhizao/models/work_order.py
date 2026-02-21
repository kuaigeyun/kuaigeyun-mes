"""
工单数据模型模块

定义工单数据模型，支持MTS/MTO两种生产模式。
"""

from tortoise import fields
from core.models.base import BaseModel


class WorkOrder(BaseModel):
    """
    工单模型

    支持MTS（按库存生产）和MTO（按订单生产）两种模式。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 工单编码（组织内唯一）
        name: 工单名称
        product_id: 产品ID（关联物料）
        product_code: 产品编码
        product_name: 产品名称
        quantity: 计划生产数量
        production_mode: 生产模式（MTS/MTO）
        sales_order_id: 销售订单ID（MTO模式时关联）
        sales_order_code: 销售订单编码
        sales_order_name: 销售订单名称
        workshop_id: 车间ID
        workshop_name: 车间名称
        work_center_id: 工作中心ID
        work_center_name: 工作中心名称
        status: 工单状态（draft/released/in_progress/completed/cancelled）
        priority: 优先级（low/normal/high/urgent）
        planned_start_date: 计划开始时间
        planned_end_date: 计划结束时间
        actual_start_date: 实际开始时间
        actual_end_date: 实际结束时间
        completed_quantity: 已完成数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
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
        table = "apps_kuaizhizao_work_orders"
        table_description = "快格轻制造 - 工单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("product_id",),
            ("workshop_id",),
            ("work_center_id",),
            ("status",),
            ("production_mode",),
            ("sales_order_id",),
            ("planned_start_date",),
            ("planned_end_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="工单编码（组织内唯一）")
    name = fields.CharField(max_length=200, null=True, description="工单名称（可选）")

    # 产品信息
    product_id = fields.IntField(description="产品ID（关联物料）")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")

    # 生产信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="计划生产数量")
    production_mode = fields.CharField(max_length=10, description="生产模式（MTS/MTO）", default="MTS")

    # 销售订单关联（MTO模式）
    sales_order_id = fields.IntField(null=True, description="销售订单ID（MTO模式时关联）")
    sales_order_code = fields.CharField(max_length=50, null=True, description="销售订单编码")
    sales_order_name = fields.CharField(max_length=200, null=True, description="销售订单名称")

    # 车间工作中心信息
    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=200, null=True, description="车间名称")
    work_center_id = fields.IntField(null=True, description="工作中心ID")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")

    # 状态和优先级
    status = fields.CharField(max_length=20, description="工单状态", default="draft")
    priority = fields.CharField(max_length=10, description="优先级", default="normal")
    
    # 指定结束标记
    manually_completed = fields.BooleanField(default=False, description="是否指定结束（true:手动指定结束, false:正常完成）")
    
    # 工序跳转控制
    allow_operation_jump = fields.BooleanField(default=False, description="是否允许跳转工序（true:允许自由报工, false:下一道工序报工数量不可超过上一道工序）")
    
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
    completed_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已完成数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格数量")

    # 备注和附件
    remarks = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件列表")

    # 创建更新信息
    created_by = fields.IntField(description="创建人ID")
    created_by_name = fields.CharField(max_length=100, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
