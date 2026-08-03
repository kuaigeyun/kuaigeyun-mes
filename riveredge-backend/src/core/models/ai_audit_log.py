"""AI 请求审计日志模型。"""

from tortoise import fields

from core.models.base import LogBaseModel


class AiAuditLog(LogBaseModel):
    """core_ai_audit_logs：租户级 AI 调用审计。"""

    user_id = fields.IntField(null=True, db_index=True, description="用户 ID")
    route = fields.CharField(max_length=256, description="API 路径")
    capability = fields.CharField(max_length=64, null=True, description="AI 能力标识")
    model = fields.CharField(max_length=128, null=True, description="模型名")
    latency_ms = fields.IntField(null=True, description="耗时毫秒")
    prompt_tokens = fields.IntField(null=True, description="prompt tokens")
    completion_tokens = fields.IntField(null=True, description="completion tokens")
    status_code = fields.IntField(null=True, description="HTTP 状态码")
    error_message = fields.TextField(null=True, description="错误信息")

    class Meta:
        table = "core_ai_audit_logs"
