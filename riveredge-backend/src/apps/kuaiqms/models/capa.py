"""
CAPA（纠正预防措施）模型模块

定义CAPA数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class CAPA(BaseModel):
    """
    CAPA（纠正预防措施）模型
    
    用于管理CAPA，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        capa_no: CAPA编号（组织内唯一）
        capa_type: CAPA类型（纠正措施、预防措施）
        source_type: 来源类型（审核发现、不合格品、客户投诉等）
        source_id: 来源ID
        source_no: 来源编号
        problem_description: 问题描述
        root_cause: 根本原因
        corrective_action: 纠正措施
        preventive_action: 预防措施
        responsible_person_id: 负责人ID（用户ID）
        responsible_person_name: 负责人姓名
        planned_completion_date: 计划完成日期
        actual_completion_date: 实际完成日期
        effectiveness_evaluation: 有效性评估
        status: CAPA状态（待执行、执行中、已完成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiqms_capas"
        indexes = [
            ("tenant_id",),
            ("capa_no",),
            ("uuid",),
            ("capa_type",),
            ("source_type",),
            ("source_id",),
            ("source_no",),
            ("responsible_person_id",),
            ("status",),
            ("planned_completion_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "capa_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    capa_no = fields.CharField(max_length=50, description="CAPA编号（组织内唯一）")
    capa_type = fields.CharField(max_length=50, description="CAPA类型（纠正措施、预防措施）")
    
    # 来源信息
    source_type = fields.CharField(max_length=50, null=True, description="来源类型（审核发现、不合格品、客户投诉等）")
    source_id = fields.IntField(null=True, description="来源ID")
    source_no = fields.CharField(max_length=50, null=True, description="来源编号")
    
    # 问题描述
    problem_description = fields.TextField(description="问题描述")
    root_cause = fields.TextField(null=True, description="根本原因")
    
    # 措施
    corrective_action = fields.TextField(null=True, description="纠正措施")
    preventive_action = fields.TextField(null=True, description="预防措施")
    
    # 负责人信息
    responsible_person_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    responsible_person_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 完成日期
    planned_completion_date = fields.DatetimeField(null=True, description="计划完成日期")
    actual_completion_date = fields.DatetimeField(null=True, description="实际完成日期")
    
    # 有效性评估
    effectiveness_evaluation = fields.TextField(null=True, description="有效性评估")
    
    # CAPA状态
    status = fields.CharField(max_length=50, default="待执行", description="CAPA状态（待执行、执行中、已完成、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.capa_no} - {self.capa_type}"
