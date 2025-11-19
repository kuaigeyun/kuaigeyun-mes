"""
用户模型模块

定义用户数据模型，用于用户认证和授权系统
"""

from typing import Optional

from tortoise import fields
from passlib.context import CryptContext

from models.base import BaseModel


# 密码加密上下文（使用 bcrypt）
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(BaseModel):
    """
    用户模型
    
    用于管理 SaaS 多租户系统中的用户信息。
    普通用户必须属于某个租户（tenant_id），实现多租户数据隔离。
    系统级超级管理员（is_superuser=True 且 tenant_id=None）可以跨租户访问和管理数据。
    同一租户内用户名必须唯一，系统级超级管理员用户名全局唯一。
    
    Attributes:
        id: 用户 ID（主键）
        tenant_id: 租户 ID（外键，关联到 core_tenants 表，可为空用于系统级超级管理员）
        username: 用户名（租户内唯一，系统级超级管理员全局唯一）
        email: 用户邮箱（可选，符合中国用户使用习惯）
        password_hash: 密码哈希值（使用 bcrypt 加密）
        full_name: 用户全名（可选）
        is_active: 是否激活
        is_superuser: 是否为超级用户（租户内超级用户或系统级超级管理员）
        is_tenant_admin: 是否为租户管理员
        last_login: 最后登录时间（可选）
        created_at: 创建时间
        updated_at: 更新时间
    """

    id = fields.IntField(primary_key=True, description="用户 ID（主键）")
    tenant_id = fields.IntField(null=True, description="租户 ID（外键，关联到 core_tenants 表，可为空用于系统级超级管理员）")
    username = fields.CharField(max_length=50, description="用户名（租户内唯一，系统级超级管理员全局唯一）")
    email = fields.CharField(max_length=255, null=True, description="用户邮箱（可选，符合中国用户使用习惯）")
    password_hash = fields.CharField(max_length=255, description="密码哈希值（使用 bcrypt 加密）")
    full_name = fields.CharField(max_length=100, null=True, description="用户全名（可选）")
    is_active = fields.BooleanField(default=True, description="是否激活")
    is_superuser = fields.BooleanField(default=False, description="是否为超级用户（租户内）")
    is_tenant_admin = fields.BooleanField(default=False, description="是否为租户管理员")
    last_login = fields.DatetimeField(null=True, description="最后登录时间（可选）")
    
    # 多对多关系：用户-角色
    roles = fields.ManyToManyField(
        "models.Role",
        related_name="users",
        description="用户角色（多对多关系）"
    )
    
    class Meta:
        """
        模型元数据
        """
        table = "core_users"  # 表名必须包含模块前缀（core_）
        indexes = [
            ("tenant_id",),           # 租户 ID 索引
            ("username",),            # 用户名索引
            ("tenant_id", "username"),  # 租户 ID + 用户名联合索引（租户内用户名唯一）
            ("is_superuser",),       # 超级用户索引
        ]
        # 注意：系统级超级管理员（tenant_id=None）用户名全局唯一，由应用层保证
        # 租户内用户名唯一，由 unique_together 保证
        unique_together = [("tenant_id", "username")]  # 同一租户下用户名唯一
    
    def __str__(self) -> str:
        """
        返回用户的字符串表示
        
        Returns:
            str: 用户字符串表示
        """
        return f"<User(id={self.id}, username={self.username}, tenant_id={self.tenant_id})>"
    
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
            >>> hashed = User.hash_password("mypassword")
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
            >>> user = User(...)
            >>> user.password_hash = User.hash_password("mypassword")
            >>> user.verify_password("mypassword")
            True
            >>> user.verify_password("wrongpassword")
            False
        """
        return pwd_context.verify(password, self.password_hash)

