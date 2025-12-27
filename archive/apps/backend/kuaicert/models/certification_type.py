"""
认证类型管理模型模块

定义认证类型管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class CertificationType(BaseModel):
    """
    认证类型模型
    
    用于管理认证类型，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        type_code: 类型编码（组织内唯一）
        type_name: 类型名称
        type_category: 类型分类（高新技术企业、专精特新、两化融合等）
        description: 描述
        status: 状态（启用、停用）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaicert_certification_types"
        indexes = [
            ("tenant_id",),
            ("type_code",),
            ("uuid",),
            ("type_category",),
            ("status",),
        ]
        unique_together = [("tenant_id", "type_code")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    type_code = fields.CharField(max_length=50, description="类型编码（组织内唯一）")
    type_name = fields.CharField(max_length=200, description="类型名称")
    type_category = fields.CharField(max_length=50, description="类型分类（高新技术企业、专精特新、两化融合等）")
    description = fields.TextField(null=True, description="描述")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="启用", description="状态（启用、停用）")
    
    def __str__(self):
        return f"{self.type_code} - {self.type_name}"


class CertificationStandard(BaseModel):
    """
    认证标准模型
    
    用于管理认证标准，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        standard_no: 标准编号（组织内唯一）
        certification_type_id: 认证类型ID（关联CertificationType）
        standard_name: 标准名称
        standard_version: 标准版本
        issue_date: 发布日期
        effective_date: 生效日期
        standard_content: 标准内容
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
        table = "apps_kuaicert_certification_standards"
        indexes = [
            ("tenant_id",),
            ("standard_no",),
            ("uuid",),
            ("certification_type_id",),
            ("standard_name",),
            ("effective_date",),
            ("status",),
        ]
        unique_together = [("tenant_id", "standard_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    standard_no = fields.CharField(max_length=50, description="标准编号（组织内唯一）")
    certification_type_id = fields.IntField(description="认证类型ID（关联CertificationType）")
    standard_name = fields.CharField(max_length=200, description="标准名称")
    standard_version = fields.CharField(max_length=50, null=True, description="标准版本")
    issue_date = fields.DatetimeField(null=True, description="发布日期")
    effective_date = fields.DatetimeField(null=True, description="生效日期")
    
    # 标准内容
    standard_content = fields.TextField(null=True, description="标准内容")
    applicable_scope = fields.TextField(null=True, description="适用范围")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="有效", description="状态（有效、已失效、待更新）")
    
    def __str__(self):
        return f"{self.standard_no} - {self.standard_name}"


