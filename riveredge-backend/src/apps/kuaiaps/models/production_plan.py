"""
生产计划模型模块

定义生产计划数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from datetime import datetime
from decimal import Decimal


class ProductionPlan(BaseModel):
    """
    生产计划模型
    
    用于管理生产计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 计划编号（组织内唯一）
        plan_name: 计划名称
        plan_type: 计划类型（主生产计划、详细排产）
        source_type: 来源类型（销售订单、预测等）
        source_id: 来源ID
        source_no: 来源编号
        product_id: 产品ID（关联master-data）
        product_name: 产品名称
        product_code: 产品编码
        planned_quantity: 计划数量
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        priority: 优先级（高、中、低）
        optimization_target: 优化目标（交期、成本、效率）
        status: 状态（草稿、已确认、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiaps_production_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("plan_type",),
            ("source_type",),
            ("source_id",),
            ("product_id",),
            ("priority",),
            ("status",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    plan_no = fields.CharField(max_length=100, description="计划编号")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    plan_type = fields.CharField(max_length=50, description="计划类型")
    source_type = fields.CharField(max_length=50, null=True, description="来源类型")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=100, null=True, description="来源编号")
    product_id = fields.IntField(null=True, description="产品ID")
    product_name = fields.CharField(max_length=200, null=True, description="产品名称")
    product_code = fields.CharField(max_length=100, null=True, description="产品编码")
    planned_quantity = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="计划数量")
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    priority = fields.CharField(max_length=20, default="中", description="优先级")
    optimization_target = fields.CharField(max_length=50, null=True, description="优化目标")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

