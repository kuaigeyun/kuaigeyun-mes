"""
持续改进模型模块

定义持续改进数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ContinuousImprovement(BaseModel):
    """
    持续改进模型
    
    用于管理持续改进，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        improvement_no: 改进编号（组织内唯一）
        improvement_type: 改进类型（流程改进、质量改进、效率改进等）
        improvement_title: 改进标题
        improvement_description: 改进描述
        improvement_plan: 改进计划
        responsible_person_id: 负责人ID（用户ID）
        responsible_person_name: 负责人姓名
        planned_start_date: 计划开始日期
        planned_end_date: 计划结束日期
        actual_start_date: 实际开始日期
        actual_end_date: 实际结束日期
        improvement_result: 改进结果
        effectiveness_evaluation: 有效性评估
        status: 改进状态（计划中、执行中、已完成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiqms_continuous_improvements"
        indexes = [
            ("tenant_id",),
            ("improvement_no",),
            ("uuid",),
            ("improvement_type",),
            ("responsible_person_id",),
            ("status",),
            ("planned_start_date",),
            ("planned_end_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "improvement_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    improvement_no = fields.CharField(max_length=50, description="改进编号（组织内唯一）")
    improvement_type = fields.CharField(max_length=50, description="改进类型（流程改进、质量改进、效率改进等）")
    improvement_title = fields.CharField(max_length=200, description="改进标题")
    improvement_description = fields.TextField(description="改进描述")
    improvement_plan = fields.TextField(null=True, description="改进计划")
    
    # 负责人信息
    responsible_person_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 计划时间
    planned_start_date = fields.DatetimeField(null=True, description="计划开始日期")
    planned_end_date = fields.DatetimeField(null=True, description="计划结束日期")
    
    # 实际时间
    actual_start_date = fields.DatetimeField(null=True, description="实际开始日期")
    actual_end_date = fields.DatetimeField(null=True, description="实际结束日期")
    
    # 改进结果
    improvement_result = fields.TextField(null=True, description="改进结果")
    effectiveness_evaluation = fields.TextField(null=True, description="有效性评估")
    
    # 改进状态
    status = fields.CharField(max_length=50, default="计划中", description="改进状态（计划中、执行中、已完成、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.improvement_no} - {self.improvement_title}"
