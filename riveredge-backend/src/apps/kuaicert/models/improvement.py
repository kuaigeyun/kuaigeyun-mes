"""
提升建议模型模块

定义提升建议数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ImprovementSuggestion(BaseModel):
    """
    改进建议模型
    
    用于管理改进建议，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        suggestion_no: 建议编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        assessment_id: 评估ID（关联CurrentAssessment或SelfAssessment）
        suggestion_category: 建议分类（基础条件、创新能力、管理水平等）
        suggestion_content: 建议内容
        priority: 优先级（低、中、高、紧急）
        estimated_effort: 预计工作量（天）
        status: 状态（待处理、处理中、已完成、已关闭）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_improvement_suggestions"
        indexes = [
            ("tenant_id",),
            ("suggestion_no",),
            ("uuid",),
            ("certification_type_id",),
            ("assessment_id",),
            ("suggestion_category",),
            ("priority",),
            ("status",),
        ]
        unique_together = [("tenant_id", "suggestion_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    suggestion_no = fields.CharField(max_length=50, description="建议编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    assessment_id = fields.IntField(null=True, description="评估ID（关联CurrentAssessment或SelfAssessment）")
    suggestion_category = fields.CharField(max_length=50, null=True, description="建议分类（基础条件、创新能力、管理水平等）")
    suggestion_content = fields.TextField(description="建议内容")
    priority = fields.CharField(max_length=50, default="中", description="优先级（低、中、高、紧急）")
    estimated_effort = fields.IntField(null=True, description="预计工作量（天）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待处理", description="状态（待处理、处理中、已完成、已关闭）")
    
    def __str__(self):
        return f"{self.suggestion_no} - {self.suggestion_category}"


class ImprovementPlan(BaseModel):
    """
    改进计划模型
    
    用于管理改进计划，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        plan_no: 计划编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        plan_name: 计划名称
        start_date: 开始日期
        end_date: 结束日期
        plan_content: 计划内容
        task_count: 任务数量
        completed_count: 已完成任务数量
        owner_id: 负责人ID（关联master-data）
        owner_name: 负责人姓名
        progress: 进度（百分比，0-100）
        status: 状态（计划中、执行中、已完成、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_improvement_plans"
        indexes = [
            ("tenant_id",),
            ("plan_no",),
            ("uuid",),
            ("certification_type_id",),
            ("start_date",),
            ("end_date",),
            ("owner_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "plan_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    plan_no = fields.CharField(max_length=50, description="计划编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    plan_name = fields.CharField(max_length=200, description="计划名称")
    start_date = fields.DatetimeField(null=True, description="开始日期")
    end_date = fields.DatetimeField(null=True, description="结束日期")
    plan_content = fields.TextField(null=True, description="计划内容")
    
    # 任务统计
    task_count = fields.IntField(default=0, description="任务数量")
    completed_count = fields.IntField(default=0, description="已完成任务数量")
    
    # 负责人信息
    owner_id = fields.IntField(null=True, description="负责人ID（关联master-data）")
    owner_name = fields.CharField(max_length=100, null=True, description="负责人姓名")
    
    # 进度信息
    progress = fields.IntField(default=0, description="进度（百分比，0-100）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="计划中", description="状态（计划中、执行中、已完成、已取消）")
    
    def __str__(self):
        return f"{self.plan_no} - {self.plan_name}"


class BestPractice(BaseModel):
    """
    最佳实践模型
    
    用于管理最佳实践，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        practice_no: 实践编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        practice_type: 实践类型（行业标杆、成功案例、经验分享）
        practice_title: 实践标题
        practice_content: 实践内容
        industry: 行业
        company_name: 企业名称
        author_id: 作者ID（关联master-data）
        author_name: 作者姓名
        view_count: 查看次数
        like_count: 点赞次数
        status: 状态（草稿、已发布、已下架）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_best_practices"
        indexes = [
            ("tenant_id",),
            ("practice_no",),
            ("uuid",),
            ("certification_type_id",),
            ("practice_type",),
            ("industry",),
            ("status",),
        ]
        unique_together = [("tenant_id", "practice_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    practice_no = fields.CharField(max_length=50, description="实践编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    practice_type = fields.CharField(max_length=50, description="实践类型（行业标杆、成功案例、经验分享）")
    practice_title = fields.CharField(max_length=200, description="实践标题")
    practice_content = fields.TextField(null=True, description="实践内容")
    
    # 企业信息
    industry = fields.CharField(max_length=100, null=True, description="行业")
    company_name = fields.CharField(max_length=200, null=True, description="企业名称")
    
    # 作者信息
    author_id = fields.IntField(null=True, description="作者ID（关联master-data）")
    author_name = fields.CharField(max_length=100, null=True, description="作者姓名")
    
    # 统计信息
    view_count = fields.IntField(default=0, description="查看次数")
    like_count = fields.IntField(default=0, description="点赞次数")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已发布、已下架）")
    
    def __str__(self):
        return f"{self.practice_no} - {self.practice_title}"

