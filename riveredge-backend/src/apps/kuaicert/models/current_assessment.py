"""
现状评估模型模块

定义现状评估数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class CurrentAssessment(BaseModel):
    """
    现状评估模型
    
    用于管理现状评估，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        assessment_no: 评估编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        assessment_date: 评估日期
        current_level: 当前水平（一级、二级、三级、四级、五级）
        gap_analysis: 差距分析
        compliance_status: 合规状态（完全合规、部分合规、不合规）
        assessor_id: 评估人ID（关联master-data）
        assessor_name: 评估人姓名
        status: 状态（已评估、待确认、已确认）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_current_assessments"
        indexes = [
            ("tenant_id",),
            ("assessment_no",),
            ("uuid",),
            ("certification_type_id",),
            ("assessment_date",),
            ("current_level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "assessment_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    assessment_no = fields.CharField(max_length=50, description="评估编号（组织内唯一）")
    certification_type_id = fields.IntField(null=True, description="认证类型ID（关联CertificationType）")
    assessment_date = fields.DatetimeField(null=True, description="评估日期")
    
    # 评估结果
    current_level = fields.CharField(max_length=50, null=True, description="当前水平（一级、二级、三级、四级、五级）")
    gap_analysis = fields.TextField(null=True, description="差距分析")
    compliance_status = fields.CharField(max_length=50, null=True, description="合规状态（完全合规、部分合规、不合规）")
    
    # 评估人信息
    assessor_id = fields.IntField(null=True, description="评估人ID（关联master-data）")
    assessor_name = fields.CharField(max_length=100, null=True, description="评估人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已评估", description="状态（已评估、待确认、已确认）")
    
    def __str__(self):
        return f"{self.assessment_no} - {self.current_level or '未评估'}"

