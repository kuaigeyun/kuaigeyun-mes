"""
质量目标模型模块

定义质量目标数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class QualityObjective(BaseModel):
    """
    质量目标模型
    
    用于管理质量目标，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        objective_no: 目标编号（组织内唯一）
        objective_name: 目标名称
        objective_description: 目标描述
        target_value: 目标值
        current_value: 当前值
        unit: 单位
        period: 周期（年度、季度、月度）
        period_start_date: 周期开始日期
        period_end_date: 周期结束日期
        responsible_person_id: 负责人ID（用户ID）
        responsible_person_name: 负责人姓名
        achievement_rate: 达成率（百分比）
        status: 目标状态（进行中、已完成、未达成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiqms_quality_objectives"
        indexes = [
            ("tenant_id",),
            ("objective_no",),
            ("uuid",),
            ("period",),
            ("responsible_person_id",),
            ("status",),
            ("period_start_date",),
            ("period_end_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "objective_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    objective_no = fields.CharField(max_length=50, description="目标编号（组织内唯一）")
    objective_name = fields.CharField(max_length=200, description="目标名称")
    objective_description = fields.TextField(null=True, description="目标描述")
    
    # 目标值
    target_value = fields.DecimalField(max_digits=18, decimal_places=4, description="目标值")
    current_value = fields.DecimalField(max_digits=18, decimal_places=4, default=0, description="当前值")
    unit = fields.CharField(max_length=50, null=True, description="单位")
    
    # 周期
    period = fields.CharField(max_length=50, description="周期（年度、季度、月度）")
    period_start_date = fields.DatetimeField(null=True, description="周期开始日期")
    period_end_date = fields.DatetimeField(null=True, description="周期结束日期")
    
    # 负责人信息
    responsible_person_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 达成率
    achievement_rate = fields.DecimalField(max_digits=5, decimal_places=2, default=0, description="达成率（百分比）")
    
    # 目标状态
    status = fields.CharField(max_length=50, default="进行中", description="目标状态（进行中、已完成、未达成、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.objective_no} - {self.objective_name}"
