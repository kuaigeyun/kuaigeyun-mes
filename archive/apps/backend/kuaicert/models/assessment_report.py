"""
评估报告模型模块

定义评估报告数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class AssessmentReport(BaseModel):
    """
    评估报告模型
    
    用于管理评估报告，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报告编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        assessment_id: 评估ID（关联CurrentAssessment或SelfAssessment）
        report_date: 报告日期
        report_title: 报告标题
        report_content: 报告内容
        assessment_result: 评估结果
        improvement_suggestions: 改进建议
        author_id: 编制人ID（关联master-data）
        author_name: 编制人姓名
        status: 状态（草稿、已生成、已发布）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_assessment_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("uuid",),
            ("certification_type_id",),
            ("assessment_id",),
            ("report_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    report_no = fields.CharField(max_length=50, description="报告编号（组织内唯一）")
    certification_type_id = fields.IntField(null=True, description="认证类型ID（关联CertificationType）")
    assessment_id = fields.IntField(null=True, description="评估ID（关联CurrentAssessment或SelfAssessment）")
    report_date = fields.DatetimeField(null=True, description="报告日期")
    report_title = fields.CharField(max_length=200, null=True, description="报告标题")
    report_content = fields.TextField(null=True, description="报告内容")
    
    # 评估结果
    assessment_result = fields.TextField(null=True, description="评估结果")
    improvement_suggestions = fields.TextField(null=True, description="改进建议")
    
    # 编制人信息
    author_id = fields.IntField(null=True, description="编制人ID（关联master-data）")
    author_name = fields.CharField(max_length=100, null=True, description="编制人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已生成、已发布）")
    
    def __str__(self):
        return f"{self.report_no} - {self.report_title or '未命名'}"

