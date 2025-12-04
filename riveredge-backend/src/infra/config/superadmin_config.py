"""
超级管理员密码配置模块

超级管理员密码单独设置，不与其他配置混合
"""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class SuperAdminSettings(BaseSettings):
    """
    超级管理员配置类
    
    超级管理员密码单独配置，不与其他配置混合
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 超级管理员密码配置（单独设置）
    SUPERADMIN_PASSWORD: str = Field(
        default="",
        description="超级管理员密码（必须设置，建议使用强密码）"
    )
    
    # 超级管理员用户名（可选，默认 superadmin）
    SUPERADMIN_USERNAME: str = Field(
        default="superadmin",
        description="超级管理员用户名（默认 superadmin）"
    )
    
    # 是否自动创建超级管理员账户（首次启动时）
    AUTO_CREATE_SUPERADMIN: bool = Field(
        default=True,
        description="是否自动创建超级管理员账户（首次启动时）"
    )


# 创建全局配置实例
superadmin_settings = SuperAdminSettings()

