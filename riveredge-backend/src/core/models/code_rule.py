"""
编码规则模型模块

定义编码规则数据模型，用于编码规则管理。
"""

import re
from tortoise import fields
from .base import BaseModel


class CodeRule(BaseModel):
    """
    编码规则模型
    
    用于定义自动编码生成规则，支持变量、日期、序号等。
    支持多组织隔离，每个组织可以定义自己的编码规则。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 规则ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 规则名称
        code: 规则代码（唯一，用于程序识别）
        expression: 规则表达式
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
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="规则名称")
    code = fields.CharField(max_length=50, description="规则代码（唯一，用于程序识别）")
    expression = fields.CharField(max_length=200, description="规则表达式")
    description = fields.TextField(null=True, description="规则描述")
    
    seq_start = fields.IntField(default=1, description="序号起始值")
    seq_step = fields.IntField(default=1, description="序号步长")
    seq_reset_rule = fields.CharField(
        max_length=20,
        null=True,
        description="序号重置规则：never、daily、monthly、yearly"
    )
    
    is_system = fields.BooleanField(default=False, description="是否系统规则（系统规则不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "core_code_rules"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
        ]
    
    def validate_expression(self) -> bool:
        """
        验证表达式是否有效
        
        Returns:
            bool: 表达式是否有效
        """
        # 检查表达式格式
        pattern = r'\{[A-Z0-9_:]+\}'
        matches = re.findall(pattern, self.expression)
        # 验证变量是否支持
        supported_vars = ['YYYY', 'YY', 'MM', 'DD', 'SEQ', 'DICT']
        for match in matches:
            var = match.strip('{}').split(':')[0]
            if var not in supported_vars:
                return False
        return True
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code})"

