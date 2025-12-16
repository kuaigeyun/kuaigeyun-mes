"""
认证管理模型模块

定义认证管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class CertificationApplication(BaseModel):
    """
    认证申请模型
    
    用于管理认证申请，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        application_no: 申请编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        application_date: 申请日期
        planned_certification_date: 计划认证日期
        material_status: 材料状态（待准备、准备中、已准备、待补充）
        applicant_id: 申请人ID（关联master-data）
        applicant_name: 申请人姓名
        status: 状态（计划中、申请中、已提交、已撤回）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_certification_applications"
        indexes = [
            ("tenant_id",),
            ("application_no",),
            ("uuid",),
            ("certification_type_id",),
            ("application_date",),
            ("material_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "application_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    application_no = fields.CharField(max_length=50, description="申请编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    application_date = fields.DatetimeField(description="申请日期")
    planned_certification_date = fields.DatetimeField(null=True, description="计划认证日期")
    material_status = fields.CharField(max_length=50, default="待准备", description="材料状态（待准备、准备中、已准备、待补充）")
    
    # 申请人信息
    applicant_id = fields.IntField(description="申请人ID（关联master-data）")
    applicant_name = fields.CharField(max_length=100, description="申请人姓名")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="计划中", description="状态（计划中、申请中、已提交、已撤回）")
    
    def __str__(self):
        return f"{self.application_no} - {self.certification_type_id}"


class CertificationProgress(BaseModel):
    """
    认证进度模型
    
    用于管理认证进度，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        progress_no: 进度编号（组织内唯一）
        application_id: 申请ID（关联CertificationApplication）
        progress_stage: 进度阶段（申请提交、材料审核、现场评审、结果公示、证书颁发）
        progress_date: 进度日期
        progress_description: 进度描述
        next_stage: 下一阶段
        estimated_completion_date: 预计完成日期
        status: 状态（进行中、已完成、已暂停、已取消）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_certification_progresses"
        indexes = [
            ("tenant_id",),
            ("progress_no",),
            ("uuid",),
            ("application_id",),
            ("progress_stage",),
            ("progress_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "progress_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    progress_no = fields.CharField(max_length=50, description="进度编号（组织内唯一）")
    application_id = fields.IntField(description="申请ID（关联CertificationApplication）")
    progress_stage = fields.CharField(max_length=50, description="进度阶段（申请提交、材料审核、现场评审、结果公示、证书颁发）")
    progress_date = fields.DatetimeField(description="进度日期")
    progress_description = fields.TextField(null=True, description="进度描述")
    next_stage = fields.CharField(max_length=50, null=True, description="下一阶段")
    estimated_completion_date = fields.DatetimeField(null=True, description="预计完成日期")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="进行中", description="状态（进行中、已完成、已暂停、已取消）")
    
    def __str__(self):
        return f"{self.progress_no} - {self.progress_stage}"


class CertificationCertificate(BaseModel):
    """
    认证证书模型
    
    用于管理认证证书，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        certificate_no: 证书编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        application_id: 申请ID（关联CertificationApplication）
        certificate_name: 证书名称
        certificate_number: 证书号码（官方证书编号）
        issue_date: 颁发日期
        effective_date: 生效日期
        expiry_date: 到期日期
        issuing_authority: 颁发机构
        certificate_level: 证书等级
        renewal_reminder_date: 续证提醒日期
        renewal_status: 续证状态（未到期、即将到期、已到期、已续证）
        status: 状态（有效、已过期、已撤销、已续证）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaicert_certification_certificates"
        indexes = [
            ("tenant_id",),
            ("certificate_no",),
            ("uuid",),
            ("certification_type_id",),
            ("application_id",),
            ("certificate_number",),
            ("issue_date",),
            ("expiry_date",),
            ("renewal_status",),
            ("status",),
        ]
        unique_together = [("tenant_id", "certificate_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    certificate_no = fields.CharField(max_length=50, description="证书编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    application_id = fields.IntField(null=True, description="申请ID（关联CertificationApplication）")
    certificate_name = fields.CharField(max_length=200, description="证书名称")
    certificate_number = fields.CharField(max_length=100, null=True, description="证书号码（官方证书编号）")
    
    # 日期信息
    issue_date = fields.DatetimeField(null=True, description="颁发日期")
    effective_date = fields.DatetimeField(null=True, description="生效日期")
    expiry_date = fields.DatetimeField(null=True, description="到期日期")
    renewal_reminder_date = fields.DatetimeField(null=True, description="续证提醒日期")
    
    # 颁发信息
    issuing_authority = fields.CharField(max_length=200, null=True, description="颁发机构")
    certificate_level = fields.CharField(max_length=50, null=True, description="证书等级")
    
    # 续证信息
    renewal_status = fields.CharField(max_length=50, null=True, description="续证状态（未到期、即将到期、已到期、已续证）")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已过期、已撤销、已续证）")
    
    def __str__(self):
        return f"{self.certificate_no} - {self.certificate_name}"

