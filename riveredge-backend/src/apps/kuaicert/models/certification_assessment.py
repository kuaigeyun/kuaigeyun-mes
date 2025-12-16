"""
认证评估模型模块

定义认证评估数据模型，支持多组织隔离。
"""

from tortoise import fields
from decimal import Decimal
from core.models.base import BaseModel


class CertificationRequirement(BaseModel):
    """
    认证要求模型
    
    用于管理认证要求，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        requirement_no: 要求编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        requirement_name: 要求名称
        requirement_category: 要求分类
        requirement_content: 要求内容
        requirement_level: 要求级别（必须、推荐、可选）
        status: 状态（有效、已失效）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_certification_requirements"
        indexes = [
            ("tenant_id",),
            ("requirement_no",),
            ("uuid",),
            ("certification_type_id",),
            ("requirement_category",),
            ("requirement_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "requirement_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    requirement_no = fields.CharField(max_length=50, description="要求编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    requirement_name = fields.CharField(max_length=200, description="要求名称")
    requirement_category = fields.CharField(max_length=50, null=True, description="要求分类")
    requirement_content = fields.TextField(description="要求内容")
    requirement_level = fields.CharField(max_length=50, null=True, description="要求级别（必须、推荐、可选）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已失效）")
    
    def __str__(self):
        return f"{self.requirement_no} - {self.requirement_name}"

# SelfAssessment 和 AssessmentReport 已移至独立文件

