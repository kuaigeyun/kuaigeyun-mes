"""
节能管理模型模块

定义节能管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel
from decimal import Decimal
from datetime import datetime


class EnergySavingManagement(BaseModel):
    """
    节能管理模型
    
    用于管理节能管理，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        management_no: 管理编号（组织内唯一）
        management_name: 管理名称
        management_type: 管理类型（节能目标、节能措施、效果评估）
        energy_type: 能源类型（电、水、气、蒸汽等）
        target_value: 目标值
        current_value: 当前值
        achievement_rate: 达成率（百分比）
        saving_amount: 节约量
        saving_rate: 节约率（百分比）
        measure_description: 措施描述
        measure_status: 措施状态（待执行、执行中、已完成）
        effect_evaluation: 效果评估（JSON格式）
        start_date: 开始日期
        end_date: 结束日期
        status: 状态（草稿、执行中、已完成、已取消）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiems_energy_saving_managements"
        indexes = [
            ("tenant_id",),
            ("management_no",),
            ("management_type",),
            ("energy_type",),
            ("measure_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "management_no")]
    
    management_no = fields.CharField(max_length=100, description="管理编号")
    management_name = fields.CharField(max_length=200, description="管理名称")
    management_type = fields.CharField(max_length=50, description="管理类型")
    energy_type = fields.CharField(max_length=50, null=True, description="能源类型")
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="目标值")
    current_value = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="当前值")
    achievement_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="达成率")
    saving_amount = fields.DecimalField(max_digits=18, decimal_places=4, null=True, description="节约量")
    saving_rate = fields.DecimalField(max_digits=5, decimal_places=2, null=True, description="节约率")
    measure_description = fields.TextField(null=True, description="措施描述")
    measure_status = fields.CharField(max_length=50, default="待执行", description="措施状态")
    effect_evaluation = fields.JSONField(null=True, description="效果评估")
    start_date = fields.DatetimeField(null=True, description="开始日期")
    end_date = fields.DatetimeField(null=True, description="结束日期")
    status = fields.CharField(max_length=50, default="草稿", description="状态")
    remark = fields.TextField(null=True, description="备注")

