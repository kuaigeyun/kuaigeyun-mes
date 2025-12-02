"""
编码序号模型模块

定义编码序号数据模型，用于存储每个编码规则的当前序号。
"""

from tortoise import fields
from .base import BaseModel


class CodeSequence(BaseModel):
    """
    编码序号模型
    
    用于存储每个编码规则的当前序号和重置信息。
    支持多组织隔离，每个组织有独立的序号序列。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    但这里使用 code_rule_id（内部ID）关联，不使用 uuid。
    
    Attributes:
        id: 序号ID（主键，自增ID，内部使用）
        code_rule_id: 关联编码规则ID（内部使用自增ID）
        tenant_id: 组织ID（用于多组织数据隔离）
        current_seq: 当前序号
        reset_date: 重置日期（用于按日/月/年重置）
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="序号ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，但这里主要使用 code_rule_id
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    code_rule_id = fields.IntField(description="关联编码规则ID（内部使用自增ID）")
    current_seq = fields.IntField(default=0, description="当前序号")
    reset_date = fields.DateField(null=True, description="重置日期（用于按日/月/年重置）")

    # 软删除字段（虽然序号表通常不删除，但保持一致性）
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_code_sequences"
        unique_together = [("code_rule_id", "tenant_id")]
        indexes = [
            ("code_rule_id",),
            ("tenant_id",),
        ]
    
    def __str__(self):
        """字符串表示"""
        return f"CodeSequence(rule_id={self.code_rule_id}, seq={self.current_seq})"

