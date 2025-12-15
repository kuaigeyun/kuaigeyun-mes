"""
知识管理模型模块

定义知识管理数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Knowledge(BaseModel):
    """
    知识管理模型
    
    用于管理技术知识、设计经验、最佳实践、专利等，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        knowledge_no: 知识编号（组织内唯一）
        knowledge_type: 知识类型（技术知识、设计经验、最佳实践、专利等）
        title: 知识标题
        content: 知识内容
        category: 知识分类
        tags: 知识标签（JSON格式）
        author_id: 作者ID（用户ID）
        view_count: 查看次数
        like_count: 点赞次数
        rating: 评分
        is_public: 是否公开
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaipdm_knowledges"
        indexes = [
            ("tenant_id",),
            ("knowledge_no",),
            ("uuid",),
            ("knowledge_type",),
            ("category",),
            ("author_id",),
            ("is_public",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "knowledge_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    knowledge_no = fields.CharField(max_length=50, description="知识编号（组织内唯一）")
    knowledge_type = fields.CharField(max_length=50, description="知识类型（技术知识、设计经验、最佳实践、专利等）")
    title = fields.CharField(max_length=200, description="知识标题")
    content = fields.TextField(description="知识内容")
    category = fields.CharField(max_length=100, null=True, description="知识分类")
    tags = fields.JSONField(null=True, description="知识标签（JSON格式）")
    
    # 作者和统计
    author_id = fields.IntField(description="作者ID（用户ID）")
    view_count = fields.IntField(default=0, description="查看次数")
    like_count = fields.IntField(default=0, description="点赞次数")
    rating = fields.DecimalField(max_digits=3, decimal_places=2, null=True, description="评分（0-5分）")
    
    # 公开性
    is_public = fields.BooleanField(default=False, description="是否公开")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.knowledge_no} - {self.title}"
