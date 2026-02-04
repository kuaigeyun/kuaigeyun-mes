"""
报工记录数据模型模块

定义报工记录数据模型，支持工序级报工。
"""

from tortoise import fields
from core.models.base import BaseModel


class ReportingRecord(BaseModel):
    """
    报工记录模型

    记录工人对工单工序的报工信息。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        work_order_id: 工单ID
        work_order_code: 工单编码
        work_order_name: 工单名称
        operation_id: 工序ID
        operation_code: 工序编码
        operation_name: 工序名称
        worker_id: 操作工ID
        worker_name: 操作工姓名
        reported_quantity: 报工数量
        qualified_quantity: 合格数量
        unqualified_quantity: 不合格数量
        work_hours: 工时（小时）
        status: 审核状态（pending/approved/rejected）
        reported_at: 报工时间
        approved_at: 审核时间
        approved_by: 审核人ID
        approved_by_name: 审核人姓名
        rejection_reason: 驳回原因
        remarks: 备注
        device_info: 设备信息（JSON格式）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_reporting_records"
        table_description = "快格轻制造 - 报工记录"
        indexes = [
            ("tenant_id",),
            ("work_order_id",),
            ("operation_id",),
            ("worker_id",),
            ("status",),
            ("reported_at",),
            ("approved_at",),
            ("created_at",),
        ]

    # 主键（BaseModel 不包含 id 字段，需要自己定义）
    id = fields.IntField(pk=True, description="主键ID")

    # 工单信息
    work_order_id = fields.IntField(description="工单ID")
    work_order_code = fields.CharField(max_length=50, description="工单编码")
    work_order_name = fields.CharField(max_length=200, description="工单名称")

    # 工序信息
    operation_id = fields.IntField(description="工序ID")
    operation_code = fields.CharField(max_length=50, description="工序编码")
    operation_name = fields.CharField(max_length=200, description="工序名称")

    # 操作工信息
    worker_id = fields.IntField(description="操作工ID")
    worker_name = fields.CharField(max_length=100, description="操作工姓名")

    # 报工数据
    reported_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="报工数量")
    qualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="合格数量")
    unqualified_quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="不合格数量")
    work_hours = fields.DecimalField(max_digits=6, decimal_places=2, description="工时（小时）")

    # 审核状态
    status = fields.CharField(max_length=20, description="审核状态", default="pending")
    reported_at = fields.DatetimeField(description="报工时间")
    approved_at = fields.DatetimeField(null=True, description="审核时间")
    approved_by = fields.IntField(null=True, description="审核人ID")
    approved_by_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    rejection_reason = fields.TextField(null=True, description="驳回原因")

    # 备注和设备信息
    remarks = fields.TextField(null=True, description="备注")
    device_info = fields.JSONField(null=True, description="设备信息（JSON格式）")
    
    # SOP参数数据（核心功能，新增）
    sop_parameters = fields.JSONField(null=True, description="SOP参数数据（JSON格式，存储报工时收集的SOP参数）")