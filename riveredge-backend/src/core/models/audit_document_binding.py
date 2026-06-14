"""
审核单据绑定模型

租户级配置：可审核单据 ↔ 开关 ↔ 审批流程，与 manifest.audit 声明的 node_key 对应。
"""

from tortoise import fields

from .base import BaseModel


class AuditDocumentBinding(BaseModel):
    """
    审核单据绑定

    node_key 来自 manifest.audit，与业务 Service 调用 check_audit_required(node_key) 一致。
    is_enabled 控制该单据是否走人工审核；process 指向具体 ApprovalProcess 定义。
    """

    id = fields.IntField(pk=True, description="绑定ID")
    node_key = fields.CharField(max_length=50, description="单据节点键（= manifest.audit.node_key）")
    is_enabled = fields.BooleanField(default=False, description="是否启用人工审核")
    process = fields.ForeignKeyField(
        "models.ApprovalProcess",
        related_name="audit_bindings",
        null=True,
        on_delete=fields.SET_NULL,
        description="绑定的审批流程",
    )
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_audit_document_bindings"
        indexes = [
            ("tenant_id", "node_key"),
            ("uuid",),
            ("is_enabled",),
        ]
        unique_together = [("tenant_id", "node_key")]

    def __str__(self) -> str:
        return f"AuditBinding({self.node_key}, enabled={self.is_enabled})"
