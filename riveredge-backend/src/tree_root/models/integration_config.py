"""
集成配置模型模块

定义集成配置数据模型，用于集成设置管理。
"""

from tortoise import fields
from typing import Dict, Any, Optional
from datetime import datetime
from .base import BaseModel


class IntegrationConfig(BaseModel):
    """
    集成配置模型
    
    用于管理第三方系统集成配置，支持多种集成类型（OAuth、API、Webhook、Database等）。
    支持多组织隔离，每个组织可以配置自己的集成。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 集成配置ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        name: 集成名称
        code: 集成代码（唯一，用于程序识别）
        type: 集成类型（OAuth、API、Webhook、Database等）
        description: 集成描述
        config: 配置信息（JSON）
        is_active: 是否启用
        is_connected: 是否已连接
        last_connected_at: 最后连接时间
        last_error: 最后错误信息
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="集成配置ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    name = fields.CharField(max_length=100, description="集成名称")
    code = fields.CharField(max_length=50, description="集成代码（唯一，用于程序识别）")
    type = fields.CharField(max_length=20, description="集成类型：OAuth、API、Webhook、Database等")
    description = fields.TextField(null=True, description="集成描述")
    
    config = fields.JSONField(default=dict, description="配置信息（JSON）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")
    is_connected = fields.BooleanField(default=False, description="是否已连接")
    last_connected_at = fields.DatetimeField(null=True, description="最后连接时间")
    last_error = fields.TextField(null=True, description="最后错误信息")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "root_integration_configs"
        unique_together = [("tenant_id", "code")]
        indexes = [
            ("tenant_id",),
            ("code",),
            ("uuid",),
            ("type",),
            ("created_at",),
        ]
    
    def get_config(self) -> Dict[str, Any]:
        """
        获取配置信息
        
        Returns:
            Dict[str, Any]: 配置信息字典
        """
        return self.config or {}
    
    def set_config(self, config: Dict[str, Any]) -> None:
        """
        设置配置信息
        
        Args:
            config: 配置信息字典
        """
        self.config = config
    
    def update_connection_status(self, is_connected: bool, error: Optional[str] = None) -> None:
        """
        更新连接状态
        
        Args:
            is_connected: 是否已连接
            error: 错误信息（可选）
        """
        self.is_connected = is_connected
        if is_connected:
            self.last_connected_at = datetime.now()
            self.last_error = None
        else:
            self.last_error = error
    
    def __str__(self):
        """字符串表示"""
        return f"{self.name} ({self.code}) - {self.type}"

