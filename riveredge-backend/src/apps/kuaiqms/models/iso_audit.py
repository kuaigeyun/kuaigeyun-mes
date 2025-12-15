"""
ISO质量审核模型模块

定义ISO质量审核数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class ISOAudit(BaseModel):
    """
    ISO质量审核模型
    
    用于管理ISO质量审核，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        audit_no: 审核编号（组织内唯一）
        audit_type: 审核类型（内审、外审）
        iso_standard: ISO标准（ISO 9001、ISO 14001、ISO 45001、IATF 16949等）
        audit_scope: 审核范围
        audit_date: 审核日期
        auditor_id: 审核员ID（用户ID）
        auditor_name: 审核员姓名
        audit_result: 审核结果（通过、不通过、待整改）
        findings: 审核发现（JSON格式，存储审核问题和整改项）
        status: 审核状态（计划中、执行中、已完成、已关闭）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiqms_iso_audits"
        indexes = [
            ("tenant_id",),
            ("audit_no",),
            ("uuid",),
            ("audit_type",),
            ("iso_standard",),
            ("auditor_id",),
            ("audit_result",),
            ("status",),
            ("audit_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "audit_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    audit_no = fields.CharField(max_length=50, description="审核编号（组织内唯一）")
    audit_type = fields.CharField(max_length=50, description="审核类型（内审、外审）")
    iso_standard = fields.CharField(max_length=100, null=True, description="ISO标准（ISO 9001、ISO 14001、ISO 45001、IATF 16949等）")
    
    # 审核范围
    audit_scope = fields.TextField(null=True, description="审核范围")
    
    # 审核日期
    audit_date = fields.DatetimeField(null=True, description="审核日期")
    
    # 审核员信息
    auditor_id = fields.IntField(null=True, description="审核员ID（用户ID）")
    auditor_name = fields.CharField(max_length=100, null=True, description="审核员姓名")
    
    # 审核结果
    audit_result = fields.CharField(max_length=50, null=True, description="审核结果（通过、不通过、待整改）")
    
    # 审核发现（JSON格式）
    findings = fields.JSONField(null=True, description="审核发现（JSON格式，存储审核问题和整改项）")
    
    # 审核状态
    status = fields.CharField(max_length=50, default="计划中", description="审核状态（计划中、执行中、已完成、已关闭）")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.audit_no} - {self.audit_type}"
