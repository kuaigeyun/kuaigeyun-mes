"""
返工单数据模型模块

定义返工单数据模型，支持多组织隔离。

Author: Luigi Lu
Date: 2026-01-05
"""

from tortoise import fields
from core.models.base import BaseModel


class ReworkOrder(BaseModel):
    """
    返工单模型

    用于管理返工单，支持多组织隔离。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 返工单编码（组织内唯一）
        original_work_order_id: 原工单ID（关联WorkOrder）
        original_work_order_uuid: 原工单UUID
        product_id: 产品ID（关联物料）
        product_code: 产品编码
        product_name: 产品名称
        quantity: 返工数量
        rework_reason: 返工原因
        rework_type: 返工类型（返工、返修、报废）
        route_id: 返工工艺路线ID（关联物料）
        route_name: 返工工艺路线名称
        status: 返工状态（draft/released/in_progress/completed/cancelled）
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        work_center_id: 工作中心ID（关联物料）
        work_center_name: 工作中心名称
        operator_id: 操作员ID（用户ID）
        operator_name: 操作员姓名
        cost: 返工成本
        remarks: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_rework_orders"
        table_description = "快格轻制造 - 返工工单"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("original_work_order_id",),
            ("original_work_order_uuid",),
            ("status",),
            ("product_id",),
            ("work_center_id",),
            ("planned_start_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "code")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 基本信息
    code = fields.CharField(max_length=50, description="返工单编码（组织内唯一）")
    original_work_order_id = fields.IntField(null=True, description="原工单ID（关联WorkOrder）")
    original_work_order_uuid = fields.CharField(max_length=36, null=True, description="原工单UUID")

    # 产品信息
    product_id = fields.IntField(description="产品ID（关联物料）")
    product_code = fields.CharField(max_length=50, description="产品编码")
    product_name = fields.CharField(max_length=200, description="产品名称")

    # 返工数量
    quantity = fields.DecimalField(max_digits=18, decimal_places=4, description="返工数量")

    # 返工原因和类型
    rework_reason = fields.TextField(description="返工原因")
    rework_type = fields.CharField(max_length=50, description="返工类型（返工、返修、报废）")

    # 返工工艺
    route_id = fields.IntField(null=True, description="返工工艺路线ID（关联物料）")
    route_name = fields.CharField(max_length=200, null=True, description="返工工艺路线名称")

    # 返工状态
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="返工状态（draft/released/in_progress/completed/cancelled）",
    )

    # 计划时间
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")

    # 实际时间
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")

    # 工作中心
    work_center_id = fields.IntField(null=True, description="工作中心ID（关联物料）")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")

    # 操作员
    operator_id = fields.IntField(null=True, description="操作员ID（用户ID）")
    operator_name = fields.CharField(max_length=100, null=True, description="操作员姓名")

    # 返工成本
    cost = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="返工成本")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 创建人和更新人
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.code} - {self.product_name}"
