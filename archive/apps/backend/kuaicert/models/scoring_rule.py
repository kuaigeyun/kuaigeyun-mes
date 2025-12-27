"""
评分规则模型模块

定义评分规则数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ScoringRule(BaseModel):
    """
    评分规则模型
    
    用于管理评分规则，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        rule_no: 规则编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        rule_name: 规则名称
        rule_category: 规则分类（基础条件、创新能力、管理水平等）
        max_score: 最高分
        min_score: 最低分
        scoring_criteria: 评分标准
        weight: 权重（百分比，0-100）
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_scoring_rules"
        indexes = [
            ("tenant_id",),
            ("rule_no",),
            ("uuid",),
            ("certification_type_id",),
            ("rule_category",),
            ("status",),
        ]
        unique_together = [("tenant_id", "rule_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    rule_no = fields.CharField(max_length=50, description="规则编号（组织内唯一）")
    certification_type_id = fields.IntField(null=True, description="认证类型ID（关联CertificationType）")
    rule_name = fields.CharField(max_length=200, null=True, description="规则名称")
    rule_category = fields.CharField(max_length=50, null=True, description="规则分类（基础条件、创新能力、管理水平等）")
    
    # 评分信息
    max_score = fields.IntField(null=True, description="最高分")
    min_score = fields.IntField(null=True, description="最低分")
    scoring_criteria = fields.TextField(null=True, description="评分标准")
    weight = fields.IntField(null=True, description="权重（百分比，0-100）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待处理", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.rule_no} - {self.rule_name or '未命名'}"

