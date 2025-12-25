"""
自评打分模型模块

定义自评打分数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class SelfAssessment(BaseModel):
    """
    自评打分模型
    
    用于管理自评打分，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        assessment_no: 自评编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        assessment_date: 自评日期
        total_score: 总分
        score_by_category: 分类得分（JSON格式）
        level_result: 等级判定结果
        assessor_id: 自评人ID（关联master-data）
        assessor_name: 自评人姓名
        status: 状态（待评分、已评分、已确认）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_self_assessments"
        indexes = [
            ("tenant_id",),
            ("assessment_no",),
            ("uuid",),
            ("certification_type_id",),
            ("assessment_date",),
            ("level_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "assessment_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    assessment_no = fields.CharField(max_length=50, description="自评编号（组织内唯一）")
    certification_type_id = fields.IntField(null=True, description="认证类型ID（关联CertificationType）")
    assessment_date = fields.DatetimeField(null=True, description="自评日期")
    
    # 评分结果
    total_score = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="总分")
    score_by_category = fields.JSONField(null=True, description="分类得分（JSON格式）")
    level_result = fields.CharField(max_length=50, null=True, description="等级判定结果")
    
    # 自评人信息
    assessor_id = fields.IntField(null=True, description="自评人ID（关联master-data）")
    assessor_name = fields.CharField(max_length=100, null=True, description="自评人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待评分", description="状态（待评分、已评分、已确认）")
    
    def __str__(self):
        return f"{self.assessment_no} - {self.total_score or '未评分'}"

