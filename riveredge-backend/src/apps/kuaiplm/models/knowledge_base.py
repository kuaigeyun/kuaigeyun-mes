"""
知识库模型

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import fields

from core.models.base import BaseModel


class KbSpace(BaseModel):
    """知识库空间"""

    tenant_id = fields.IntField(description="租户ID")
    space_code = fields.CharField(max_length=50, description="空间编码")
    space_name = fields.CharField(max_length=200, description="空间名称")
    description = fields.TextField(null=True, description="描述")
    parent_space_id = fields.IntField(null=True, description="父空间ID")
    sort_order = fields.IntField(default=0, description="排序")
    is_active = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_kb_spaces"
        table_description = "快研发 - 知识库空间"
        indexes = [("tenant_id",)]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KbArticle(BaseModel):
    """知识库文章"""

    tenant_id = fields.IntField(description="租户ID")
    space_id = fields.IntField(description="空间ID")
    article_code = fields.CharField(max_length=50, null=True, description="文章编码")
    title = fields.CharField(max_length=300, description="标题")
    content = fields.TextField(null=True, description="正文")
    status = fields.CharField(max_length=30, default="DRAFT", description="状态")
    tags = fields.JSONField(null=True, description="标签")
    author_id = fields.IntField(null=True, description="作者ID")
    author_name = fields.CharField(max_length=100, null=True, description="作者姓名")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiplm_kb_articles"
        table_description = "快研发 - 知识库文章"
        indexes = [("tenant_id", "space_id")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KbArticleLink(BaseModel):
    """知识库文章关联"""

    tenant_id = fields.IntField(description="租户ID")
    article_id = fields.IntField(description="文章ID")
    link_type = fields.CharField(max_length=50, description="关联类型")
    target_type = fields.CharField(max_length=50, description="目标类型")
    target_id = fields.IntField(null=True, description="目标ID")
    target_uuid = fields.CharField(max_length=36, null=True, description="目标UUID")
    target_code = fields.CharField(max_length=100, null=True, description="目标编码")
    target_name = fields.CharField(max_length=200, null=True, description="目标名称")

    class Meta:
        table = "apps_kuaiplm_kb_article_links"
        table_description = "快研发 - 知识库文章关联"
        indexes = [("tenant_id", "article_id")]
