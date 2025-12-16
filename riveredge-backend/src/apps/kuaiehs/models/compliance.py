"""
合规管理模型模块

定义合规管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Regulation(BaseModel):
    """
    法规模型
    
    用于管理法规，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        regulation_no: 法规编号（组织内唯一）
        regulation_name: 法规名称
        regulation_type: 法规类型（国家法律、行政法规、部门规章、地方性法规等）
        issue_authority: 发布机关
        issue_date: 发布日期
        effective_date: 生效日期
        expiry_date: 失效日期
        regulation_content: 法规内容
        applicable_scope: 适用范围
        status: 状态（有效、已失效、待更新）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_regulations"
        indexes = [
            ("tenant_id",),
            ("regulation_no",),
            ("uuid",),
            ("regulation_name",),
            ("regulation_type",),
            ("effective_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "regulation_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    regulation_no = fields.CharField(max_length=50, description="法规编号（组织内唯一）")
    regulation_name = fields.CharField(max_length=200, description="法规名称")
    regulation_type = fields.CharField(max_length=50, description="法规类型（国家法律、行政法规、部门规章、地方性法规等）")
    issue_authority = fields.CharField(max_length=200, null=True, description="发布机关")
    issue_date = fields.DatetimeField(null=True, description="发布日期")
    effective_date = fields.DatetimeField(null=True, description="生效日期")
    expiry_date = fields.DatetimeField(null=True, description="失效日期")
    
    # 法规内容
    regulation_content = fields.TextField(null=True, description="法规内容")
    applicable_scope = fields.TextField(null=True, description="适用范围")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已失效、待更新）")
    
    def __str__(self):
        return f"{self.regulation_no} - {self.regulation_name}"


class ComplianceCheck(BaseModel):
    """
    合规检查模型
    
    用于管理合规检查，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        check_no: 检查编号（组织内唯一）
        check_plan_id: 检查计划ID（关联检查计划）
        regulation_id: 法规ID（关联Regulation）
        check_type: 检查类型（环境合规、安全合规、健康合规等）
        check_date: 检查日期
        check_content: 检查内容
        check_result: 检查结果（合格、不合格、待整改）
        issue_description: 问题描述
        inspector_id: 检查人ID（关联master-data）
        inspector_name: 检查人姓名
        handler_id: 处理人ID（关联master-data）
        handler_name: 处理人姓名
        handling_measure: 处理措施
        status: 状态（待检查、检查中、已通过、待整改、已整改）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_compliance_checks"
        indexes = [
            ("tenant_id",),
            ("check_no",),
            ("uuid",),
            ("check_plan_id",),
            ("regulation_id",),
            ("check_type",),
            ("check_date",),
            ("check_result",),
            ("status",),
        ]
        unique_together = [("tenant_id", "check_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    check_no = fields.CharField(max_length=50, description="检查编号（组织内唯一）")
    check_plan_id = fields.IntField(null=True, description="检查计划ID（关联检查计划）")
    regulation_id = fields.IntField(null=True, description="法规ID（关联Regulation）")
    check_type = fields.CharField(max_length=50, description="检查类型（环境合规、安全合规、健康合规等）")
    check_date = fields.DatetimeField(description="检查日期")
    
    # 检查内容
    check_content = fields.TextField(null=True, description="检查内容")
    check_result = fields.CharField(max_length=50, null=True, description="检查结果（合格、不合格、待整改）")
    issue_description = fields.TextField(null=True, description="问题描述")
    
    # 检查人信息
    inspector_id = fields.IntField(description="检查人ID（关联master-data）")
    inspector_name = fields.CharField(max_length=100, description="检查人姓名")
    
    # 处理人信息
    handler_id = fields.IntField(null=True, description="处理人ID（关联master-data）")
    handler_name = fields.CharField(max_length=100, null=True, description="处理人姓名")
    handling_measure = fields.TextField(null=True, description="处理措施")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="待检查", description="状态（待检查、检查中、已通过、待整改、已整改）")
    
    def __str__(self):
        return f"{self.check_no} - {self.check_type}"


class ComplianceReport(BaseModel):
    """
    合规报告模型
    
    用于管理合规报告，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        report_no: 报告编号（组织内唯一）
        report_type: 报告类型（环境合规报告、安全合规报告、健康合规报告等）
        report_period: 报告期间（格式：2024-01）
        report_date: 报告日期
        report_title: 报告标题
        report_content: 报告内容
        compliance_rate: 合规率（百分比，0-100）
        issue_count: 问题数量
        resolved_count: 已解决问题数量
        author_id: 编制人ID（关联master-data）
        author_name: 编制人姓名
        reviewer_id: 审核人ID（关联master-data）
        reviewer_name: 审核人姓名
        approval_status: 审批状态（待审核、已通过、已拒绝）
        publish_date: 发布日期
        status: 状态（草稿、待审核、已发布、已归档）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiehs_compliance_reports"
        indexes = [
            ("tenant_id",),
            ("report_no",),
            ("uuid",),
            ("report_type",),
            ("report_period",),
            ("report_date",),
            ("approval_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "report_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    report_no = fields.CharField(max_length=50, description="报告编号（组织内唯一）")
    report_type = fields.CharField(max_length=50, description="报告类型（环境合规报告、安全合规报告、健康合规报告等）")
    report_period = fields.CharField(max_length=20, null=True, description="报告期间（格式：2024-01）")
    report_date = fields.DatetimeField(description="报告日期")
    report_title = fields.CharField(max_length=200, description="报告标题")
    report_content = fields.TextField(null=True, description="报告内容")
    
    # 统计信息
    compliance_rate = fields.IntField(null=True, description="合规率（百分比，0-100）")
    issue_count = fields.IntField(default=0, description="问题数量")
    resolved_count = fields.IntField(default=0, description="已解决问题数量")
    
    # 编制人信息
    author_id = fields.IntField(description="编制人ID（关联master-data）")
    author_name = fields.CharField(max_length=100, description="编制人姓名")
    
    # 审核人信息
    reviewer_id = fields.IntField(null=True, description="审核人ID（关联master-data）")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    approval_status = fields.CharField(max_length=50, null=True, description="审批状态（待审核、已通过、已拒绝）")
    
    # 发布信息
    publish_date = fields.DatetimeField(null=True, description="发布日期")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、待审核、已发布、已归档）")
    
    def __str__(self):
        return f"{self.report_no} - {self.report_title}"

