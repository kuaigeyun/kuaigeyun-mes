"""
工单工序数据模型模块

定义工单工序数据模型，用于管理工单的工序信息。

Author: Luigi Lu
Date: 2026-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class WorkOrderOperation(BaseModel):
    """
    工单工序模型

    用于管理工单的工序信息，支持工序顺序、计划时间等。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        work_order_id: 工单ID（关联WorkOrder）
        work_order_code: 工单编码
        operation_id: 工序ID（关联master-data的Operation）
        operation_code: 工序编码
        operation_name: 工序名称
        sequence: 工序顺序（从1开始）
        workshop_id: 车间ID
        workshop_name: 车间名称
        work_center_id: 工作中心ID
        work_center_name: 工作中心名称
        planned_start_date: 计划开始时间
        planned_end_date: 计划结束时间
        actual_start_date: 实际开始时间
        actual_end_date: 实际结束时间
        standard_time: 标准工时（小时/件）
        setup_time: 准备时间（小时）
        completed_quantity: 已完成数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
        status: 工序状态（pending/in_progress/completed/cancelled）
        assigned_worker_id: 分配的员工ID
        assigned_worker_name: 分配的员工姓名
        assigned_equipment_id: 分配的设备ID
        assigned_equipment_name: 分配的设备姓名
        assigned_at: 分配时间
        assigned_by: 分配人ID
        assigned_by_name: 分配人姓名
        remarks: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_work_order_operations"
        table_description = "快格轻制造 - 工单工序"
        app = "models"  # 指定 Tortoise ORM app 名称
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("operation_id",),
            ("sequence",),
            ("status",),
            ("planned_start_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "work_order_id", "sequence")]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 工单关联
    work_order_id = fields.IntField(description="工单ID（关联WorkOrder）")
    work_order_code = fields.CharField(max_length=50, description="工单编码")

    # 工序信息
    operation_id = fields.IntField(description="工序ID（关联master-data的Operation）")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")
    sequence = fields.IntField(description="工序顺序（从1开始）")

    # 车间工作中心信息
    workshop_id = fields.IntField(null=True, description="车间ID")
    workshop_name = fields.CharField(max_length=200, null=True, description="车间名称")
    work_center_id = fields.IntField(null=True, description="工作中心ID")
    work_center_name = fields.CharField(max_length=200, null=True, description="工作中心名称")

    # 时间信息
    planned_start_date = fields.DatetimeField(null=True, description="计划开始时间")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束时间")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始时间")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束时间")

    # 工时信息
    standard_time = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="标准工时（小时/件）")
    setup_time = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="准备时间（小时）")

    # 完成信息
    completed_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="已完成数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, default=0, description="不合格数量")

    # 状态信息
    status = fields.CharField(max_length=20, default="pending", description="工序状态（pending/in_progress/completed/cancelled）")
    
    # 派工信息
    assigned_worker_id = fields.IntField(null=True, description="分配的员工ID")
    assigned_worker_name = fields.CharField(max_length=100, null=True, description="分配的员工姓名")
    assigned_equipment_id = fields.IntField(null=True, description="分配的设备ID")
    assigned_equipment_name = fields.CharField(max_length=100, null=True, description="分配的设备姓名")
    assigned_mold_id = fields.IntField(null=True, description="分配的模具ID")
    assigned_mold_name = fields.CharField(max_length=200, null=True, description="分配的模具名称")
    assigned_tool_id = fields.IntField(null=True, description="分配的工装ID")
    assigned_tool_name = fields.CharField(max_length=200, null=True, description="分配的工装名称")
    assigned_at = fields.DatetimeField(null=True, description="分配时间")
    assigned_by = fields.IntField(null=True, description="分配人ID")
    assigned_by_name = fields.CharField(max_length=100, null=True, description="分配人姓名")

    # 报工类型和跳转规则（从工艺路线中继承）
    reporting_type = fields.CharField(
        max_length=20,
        default="quantity",
        description="报工类型（quantity:按数量报工, status:按状态报工）"
    )
    allow_jump = fields.BooleanField(
        default=False,
        description="是否允许跳转（true:允许跳转，不依赖上道工序完成, false:不允许跳转，必须完成上道工序）"
    )

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.work_order_code}-OP{self.sequence:02d} - {self.operation_name}"

