"""
文档管理模型模块

定义文档管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Document(BaseModel):
    """
    文档模型
    
    用于管理文档，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        document_no: 文档编号（组织内唯一）
        document_name: 文档名称
        document_type: 文档类型（合同、报告、制度、通知等）
        document_category: 文档分类
        file_path: 文件路径
        file_size: 文件大小（字节）
        file_type: 文件类型（pdf、doc、xls等）
        tags: 标签（JSON格式）
        description: 描述
        author_id: 作者ID（关联master-data）
        author_name: 作者姓名
        current_version: 当前版本号
        status: 状态（草稿、已发布、已归档、已删除）
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_documents"
        indexes = [
            ("tenant_id",),
            ("document_no",),
            ("uuid",),
            ("document_name",),
            ("document_type",),
            ("document_category",),
            ("author_id",),
            ("status",),
        ]
        unique_together = [("tenant_id", "document_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    document_no = fields.CharField(max_length=50, description="文档编号（组织内唯一）")
    document_name = fields.CharField(max_length=200, description="文档名称")
    document_type = fields.CharField(max_length=50, description="文档类型（合同、报告、制度、通知等）")
    document_category = fields.CharField(max_length=50, null=True, description="文档分类")
    
    # 文件信息
    file_path = fields.CharField(max_length=500, null=True, description="文件路径")
    file_size = fields.BigIntField(null=True, description="文件大小（字节）")
    file_type = fields.CharField(max_length=50, null=True, description="文件类型（pdf、doc、xls等）")
    tags = fields.JSONField(null=True, description="标签（JSON格式）")
    description = fields.TextField(null=True, description="描述")
    
    # 作者信息
    author_id = fields.IntField(description="作者ID（关联master-data）")
    author_name = fields.CharField(max_length=100, description="作者姓名")
    
    # 版本信息
    current_version = fields.IntField(default=1, description="当前版本号")
    
    # 状态信息
    status = fields.CharField(max_length=50, default="草稿", description="状态（草稿、已发布、已归档、已删除）")
    
    def __str__(self):
        return f"{self.document_no} - {self.document_name}"


class DocumentVersion(BaseModel):
    """
    文档版本模型
    
    用于管理文档版本，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        version_no: 版本编号（组织内唯一）
        document_id: 文档ID（关联Document）
        version_number: 版本号
        file_path: 文件路径
        file_size: 文件大小（字节）
        version_description: 版本描述
        creator_id: 创建人ID（关联master-data）
        creator_name: 创建人姓名
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaioa_document_versions"
        indexes = [
            ("tenant_id",),
            ("version_no",),
            ("uuid",),
            ("document_id",),
            ("version_number",),
        ]
        unique_together = [("tenant_id", "version_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    version_no = fields.CharField(max_length=50, description="版本编号（组织内唯一）")
    document_id = fields.IntField(description="文档ID（关联Document）")
    version_number = fields.IntField(description="版本号")
    
    # 文件信息
    file_path = fields.CharField(max_length=500, null=True, description="文件路径")
    file_size = fields.BigIntField(null=True, description="文件大小（字节）")
    version_description = fields.TextField(null=True, description="版本描述")
    
    # 创建人信息
    creator_id = fields.IntField(description="创建人ID（关联master-data）")
    creator_name = fields.CharField(max_length=100, description="创建人姓名")
    
    def __str__(self):
        return f"{self.version_no} - v{self.version_number}"

