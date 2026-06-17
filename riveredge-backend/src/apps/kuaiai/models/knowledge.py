"""KU-AI 知识库与训练样本模型。"""

from __future__ import annotations

from tortoise import fields

from core.models.base import BaseModel


class KuaiKnowledgeDocument(BaseModel):
    """知识库文档（文本 / 文件 / FAQ）。"""

    tenant_id = fields.IntField(description="租户ID")
    title = fields.CharField(max_length=300, description="标题")
    source_type = fields.CharField(max_length=20, description="来源：text | file | faq")
    raw_content = fields.TextField(null=True, description="原始文本（text/faq）")
    file_uuid = fields.CharField(max_length=36, null=True, description="上传文件 UUID")
    faq_question = fields.TextField(null=True, description="FAQ 问题")
    faq_answer = fields.TextField(null=True, description="FAQ 答案")
    status = fields.CharField(max_length=20, default="pending", description="pending | indexed | failed")
    chunk_count = fields.IntField(default=0, description="分块数量")
    error_message = fields.TextField(null=True, description="索引失败原因")
    is_active = fields.BooleanField(default=True, description="是否启用")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiai_knowledge_documents"
        table_description = "KU-AI 知识库文档"
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "source_type"),
            ("created_at",),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaiKnowledgeChunk(BaseModel):
    """知识库分块（检索单元）。"""

    tenant_id = fields.IntField(description="租户ID")
    document_id = fields.IntField(description="文档ID")
    chunk_index = fields.IntField(description="块序号")
    content = fields.TextField(description="块正文")
    char_count = fields.IntField(default=0, description="字符数")
    embedding = fields.JSONField(null=True, description="向量（可选）")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiai_knowledge_chunks"
        table_description = "KU-AI 知识库分块"
        indexes = [
            ("tenant_id", "document_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class KuaiTrainingSample(BaseModel):
    """微调训练样本（问答对）。"""

    tenant_id = fields.IntField(description="租户ID")
    question = fields.TextField(description="问题")
    answer = fields.TextField(description="答案")
    source = fields.CharField(max_length=30, default="manual", description="manual | faq | chat")
    is_active = fields.BooleanField(default=True, description="是否纳入导出")
    created_by = fields.IntField(null=True)
    updated_by = fields.IntField(null=True)
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaiai_training_samples"
        table_description = "KU-AI 训练样本"
        indexes = [
            ("tenant_id", "is_active"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]
