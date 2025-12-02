"""
系统参数模型模块

定义系统参数数据模型，用于系统参数管理。
"""

import json
from tortoise import fields
from .base import BaseModel


class SystemParameter(BaseModel):
    """
    系统参数模型
    
    用于存储系统配置参数，支持多种数据类型（string、number、boolean、json）。
    支持多组织隔离，每个组织可以定义自己的参数。
    支持 Redis 缓存，提升读取性能。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 参数ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        key: 参数键（唯一，用于程序识别）
        value: 参数值（JSON 字符串）
        type: 参数类型：string、number、boolean、json
        description: 参数描述
        is_system: 是否系统参数（系统参数不可删除）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="参数ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    key = fields.CharField(max_length=100, description="参数键（唯一，用于程序识别）")
    value = fields.TextField(description="参数值（JSON 字符串）")
    type = fields.CharField(max_length=20, description="参数类型：string、number、boolean、json")
    description = fields.TextField(null=True, description="参数描述")
    is_system = fields.BooleanField(default=False, description="是否系统参数（系统参数不可删除）")
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_system_parameters"
        unique_together = [("tenant_id", "key")]
        indexes = [
            ("tenant_id",),
            ("key",),
            ("created_at",),
        ]
    
    def get_value(self):
        """
        获取解析后的参数值
        
        Returns:
            解析后的参数值（根据类型自动转换）
        """
        if self.type == "json":
            return json.loads(self.value)
        elif self.type == "number":
            return float(self.value) if "." in self.value else int(self.value)
        elif self.type == "boolean":
            return self.value.lower() in ("true", "1", "yes")
        else:
            return self.value
    
    def set_value(self, value):
        """
        设置参数值（自动序列化）
        
        Args:
            value: 参数值（可以是任意类型）
        """
        if self.type == "json":
            self.value = json.dumps(value, ensure_ascii=False)
        else:
            self.value = str(value)
    
    def __str__(self):
        """字符串表示"""
        return f"{self.key} ({self.type})"

