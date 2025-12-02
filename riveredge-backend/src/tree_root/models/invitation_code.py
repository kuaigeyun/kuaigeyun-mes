"""
邀请码模型模块

定义邀请码数据模型，用于邀请注册管理。
"""

from datetime import datetime
from tortoise import fields
from .base import BaseModel


class InvitationCode(BaseModel):
    """
    邀请码模型
    
    用于生成和管理邀请注册码，支持使用次数限制和过期时间。
    支持多组织隔离，每个组织可以生成自己的邀请码。
    
    注意：继承自 BaseModel，自动包含 uuid、tenant_id、created_at、updated_at 字段。
    
    Attributes:
        id: 邀请码ID（主键，自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一）
        tenant_id: 组织ID（用于多组织数据隔离）
        code: 邀请码（唯一，全局唯一）
        email: 邀请邮箱（可选）
        role_id: 默认角色ID（内部使用自增ID，可选）
        max_uses: 最大使用次数
        used_count: 已使用次数
        expires_at: 过期时间（可选）
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id = fields.IntField(pk=True, description="邀请码ID（主键，自增ID，内部使用）")
    # uuid 字段由 BaseModel 提供，无需重复定义
    # tenant_id 字段由 BaseModel 提供，无需重复定义
    
    code = fields.CharField(max_length=50, unique=True, description="邀请码（唯一，全局唯一）")
    email = fields.CharField(max_length=100, null=True, description="邀请邮箱（可选）")
    role_id = fields.IntField(null=True, description="默认角色ID（内部使用自增ID，可选）")
    
    max_uses = fields.IntField(default=1, description="最大使用次数")
    used_count = fields.IntField(default=0, description="已使用次数")
    expires_at = fields.DatetimeField(null=True, description="过期时间（可选）")
    
    is_active = fields.BooleanField(default=True, description="是否启用")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    class Meta:
        """
        模型元数据
        """
        table = "sys_invitation_codes"
        indexes = [
            ("tenant_id",),
            ("code",),
            ("created_at",),
        ]
    
    def is_valid(self) -> bool:
        """
        检查邀请码是否有效
        
        Returns:
            bool: 邀请码是否有效
        """
        if not self.is_active:
            return False
        if self.used_count >= self.max_uses:
            return False
        if self.expires_at and self.expires_at < datetime.now():
            return False
        return True
    
    def use(self) -> None:
        """
        使用邀请码（增加使用次数）
        
        Raises:
            ValueError: 当邀请码无效或已过期时抛出
        """
        if not self.is_valid():
            raise ValueError("邀请码无效或已过期")
        self.used_count += 1
    
    def __str__(self):
        """字符串表示"""
        return f"InvitationCode(code={self.code}, used={self.used_count}/{self.max_uses})"

