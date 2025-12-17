"""
平台超级管理员模型模块

定义平台超级管理员数据模型，用于平台级超级管理员认证和授权系统。
平台超级管理员是平台唯一的，独立于租户系统。
"""

from typing import Optional
from datetime import datetime, timezone

from tortoise import fields
from passlib.context import CryptContext

from infra.models.base import BaseModel


# 密码加密上下文（使用 pbkdf2_sha256，与 security.py 保持一致）
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto",
    pbkdf2_sha256__default_rounds=30000
)


class InfraSuperAdmin(BaseModel):
    """
    平台超级管理员模型
    
    平台超级管理员是平台唯一的超级管理员，独立于租户系统。
    用于管理整个平台（所有租户、用户、配置等）。
    
    特点：
    - 平台唯一：整个系统只能有一个平台超级管理员
    - 独立认证：使用独立的认证系统，不依赖租户
    - 全权限：拥有平台所有权限，可以管理所有租户和数据
    
    Attributes:
        id: 平台超级管理员 ID（主键）
        username: 用户名（全局唯一，平台唯一）
        email: 用户邮箱（可选）
        password_hash: 密码哈希值（使用 bcrypt 加密）
        full_name: 用户全名（可选）
        is_active: 是否激活
        last_login: 最后登录时间（可选）
        avatar: 头像文件UUID（可选）
        bio: 个人简介（可选）
        contact_info: 联系方式（JSON格式，可选）
        gender: 性别（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(pk=True, description="平台超级管理员 ID（主键）")
    username = fields.CharField(
        max_length=50,
        unique=True,
        description="用户名（全局唯一，平台唯一）"
    )
    email = fields.CharField(
        max_length=255,
        null=True,
        description="用户邮箱（可选）"
    )
    password_hash = fields.CharField(
        max_length=255,
        description="密码哈希值（使用 bcrypt 加密）"
    )
    full_name = fields.CharField(
        max_length=100,
        null=True,
        description="用户全名（可选）"
    )
    phone = fields.CharField(
        max_length=20,
        null=True,
        description="手机号（可选）"
    )
    is_active = fields.BooleanField(
        default=True,
        description="是否激活"
    )
    last_login = fields.DatetimeField(
        null=True,
        description="最后登录时间（可选）"
    )
    
    # 个人资料字段（个人中心模块）
    avatar = fields.CharField(
        max_length=36,
        null=True,
        description="头像文件UUID（关联文件管理，可选）"
    )
    bio = fields.TextField(
        null=True,
        description="个人简介（可选）"
    )
    contact_info = fields.JSONField(
        null=True,
        description="联系方式（JSON格式，可选）"
    )
    gender = fields.CharField(
        max_length=10,
        null=True,
        description="性别（可选，如：male, female, other）"
    )
    
    class Meta:
        """
        模型元数据
        """
        table = "infra_superadmin"  # 表名必须包含模块前缀（infra_ - 平台级后端）
        indexes = [
            ("username",),  # 用户名索引（已通过 unique=True 保证唯一性）
        ]
        # 注意：平台超级管理员是平台唯一的，由应用层和数据库唯一约束保证
    
    def __str__(self) -> str:
        """
        返回平台超级管理员的字符串表示
        
        Returns:
            str: 平台超级管理员字符串表示
        """
        return f"<InfraSuperAdmin(id={self.id}, username={self.username})>"
    
    @staticmethod
    def hash_password(password: str) -> str:
        """
        加密密码
        
        使用 bcrypt 算法加密密码。
        
        Args:
            password: 明文密码
            
        Returns:
            str: 加密后的密码哈希值
            
        Example:
            >>> hashed = InfraSuperAdmin.hash_password("mypassword")
            >>> len(hashed) > 0
            True
        """
        return pwd_context.hash(password)
    
    def verify_password(self, password: str) -> bool:
        """
        验证密码
        
        验证提供的明文密码是否与存储的密码哈希值匹配。
        
        Args:
            password: 明文密码
            
        Returns:
            bool: 密码匹配返回 True，否则返回 False
            
        Example:
            >>> admin = InfraSuperAdmin(...)
            >>> admin.password_hash = InfraSuperAdmin.hash_password("mypassword")
            >>> admin.verify_password("mypassword")
            True
            >>> admin.verify_password("wrongpassword")
            False
        """
        return pwd_context.verify(password, self.password_hash)
    
    def update_last_login(self) -> None:
        """
        更新最后登录时间
        
        将最后登录时间更新为当前时间（带时区）。
        注意：此方法只更新字段值，需要调用 save() 保存到数据库。
        """
        self.last_login = datetime.now(timezone.utc)

