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
        table = "seed_kuaicert_certification_requirements"
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
        table = "seed_kuaicert_current_assessments"
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
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    assessment_date = fields.DatetimeField(description="评估日期")
    
    # 评估结果
    current_level = fields.CharField(max_length=50, null=True, description="当前水平（一级、二级、三级、四级、五级）")
    gap_analysis = fields.TextField(null=True, description="差距分析")
    compliance_status = fields.CharField(max_length=50, null=True, description="合规状态（完全合规、部分合规、不合规）")
    
    # 评估人信息
    assessor_id = fields.IntField(description="评估人ID（关联master-data）")
    assessor_name = fields.CharField(max_length=100, description="评估人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="已评估", description="状态（已评估、待确认、已确认）")
    
    def __str__(self):
        return f"{self.assessment_no} - {self.current_level}"


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
        table = "seed_kuaicert_self_assessments"
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
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    assessment_date = fields.DatetimeField(description="自评日期")
    
    # 评分结果
    total_score = fields.DecimalField(max_digits=10, decimal_places=2, null=True, description="总分")
    score_by_category = fields.JSONField(null=True, description="分类得分（JSON格式）")
    level_result = fields.CharField(max_length=50, null=True, description="等级判定结果")
    
    # 自评人信息
    assessor_id = fields.IntField(description="自评人ID（关联master-data）")
    assessor_name = fields.CharField(max_length=100, description="自评人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待评分", description="状态（待评分、已评分、已确认）")
    
    def __str__(self):
        return f"{self.assessment_no} - {self.total_score}"


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
        table = "seed_kuaicert_assessment_reports"
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
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    assessment_id = fields.IntField(null=True, description="评估ID（关联CurrentAssessment或SelfAssessment）")
    report_date = fields.DatetimeField(description="报告日期")
    report_title = fields.CharField(max_length=200, description="报告标题")
    report_content = fields.TextField(null=True, description="报告内容")
    
    # 评估结果
    assessment_result = fields.TextField(null=True, description="评估结果")
    improvement_suggestions = fields.TextField(null=True, description="改进建议")
    
    # 编制人信息
    author_id = fields.IntField(description="编制人ID（关联master-data）")
    author_name = fields.CharField(max_length=100, description="编制人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已生成、已发布）")
    
    def __str__(self):
        return f"{self.report_no} - {self.report_title}"

