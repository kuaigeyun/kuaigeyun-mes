"""
序列号规则模型模块

定义序列号规则数据模型，用于配置序列号生成规则。
支持物料编码、日期、序号等变量，与编码规则体系类似。

Author: RiverEdge Team
Date: 2026-02-26
"""

import json
from typing import Optional, List, Dict, Any
from tortoise import fields
from .base import BaseModel


class SerialRule(BaseModel):
    """
    序列号规则模型

    用于定义序列号生成规则，支持固定文本、日期、物料编码、序号等组件。
    支持多组织隔离，每个组织可以定义自己的序列号规则。

    Attributes:
        id: 规则ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 规则名称
        code: 规则代码（唯一，用于程序识别）
        rule_components: 规则组件列表（JSON格式）
        description: 规则描述
        seq_start: 序号起始值
        seq_step: 序号步长
        seq_reset_rule: 序号重置规则：never、daily、monthly、yearly
        is_system: 是否系统规则（系统规则不可删除）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(pk=True, description="规则ID（主键，自增ID，内部使用）")

    name = fields.CharField(max_length=100, description="规则名称")
    code = fields.CharField(max_length=50, description="规则代码（唯一，用于程序识别）")
    rule_components = fields.JSONField(null=True, description="规则组件列表（JSON格式）")
    description = fields.TextField(null=True, description="规则描述")

    seq_start = fields.IntField(default=1, description="序号起始值")
    seq_step = fields.IntField(default=1, description="序号步长")
    seq_reset_rule = fields.CharField(
        max_length=20,
        null=True,
        description="序号重置规则：never、daily、monthly、yearly（向后兼容）",
    )

    is_system = fields.BooleanField(default=False, description="是否系统规则（系统规则不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_serial_rules"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
        ]

    def get_rule_components(self) -> Optional[List[Dict[str, Any]]]:
        """获取规则组件列表"""
        if self.rule_components:
            if isinstance(self.rule_components, str):
                return json.loads(self.rule_components)
            return self.rule_components
        return None

    def __str__(self):
        return f"{self.name} ({self.code})"
