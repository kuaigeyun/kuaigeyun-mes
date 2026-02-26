"""
批号规则序号模型模块

定义批号规则序号数据模型，用于存储每个批号规则的当前序号。
"""

from tortoise import fields
from .base import BaseModel


class BatchRuleSequence(BaseModel):
    """
    批号规则序号模型

    用于存储每个批号规则的当前序号和重置信息。
    支持多组织隔离，每个组织有独立的序号序列。
    """

    id = fields.IntField(pk=True, description="序号ID（主键，自增ID，内部使用）")

    batch_rule_id = fields.IntField(description="关联批号规则ID（内部使用自增ID）")
    current_seq = fields.IntField(default=0, description="当前序号")
    reset_date = fields.DateField(null=True, description="重置日期（用于按日/月/年重置）")
    scope_key = fields.CharField(max_length=200, default="", description="作用域Key（如物料ID，用于按物料隔离计数）")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_batch_rule_sequences"
        unique_together = [("batch_rule_id", "tenant_id", "scope_key")]
        indexes = [
            ("batch_rule_id",),
            ("tenant_id",),
        ]

    def __str__(self):
        return f"BatchRuleSequence(rule_id={self.batch_rule_id}, seq={self.current_seq})"
