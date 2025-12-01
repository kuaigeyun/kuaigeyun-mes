"""
平台级配置管理模块

提供平台级配置的单独管理，独立于系统级配置
"""

from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PlatformSettings(BaseSettings):
    """
    平台级配置类
    
    使用 Pydantic Settings 自动从环境变量加载配置
    平台级配置单独管理，不与系统级配置混合
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 应用配置
    APP_NAME: str = Field(default="RiverEdge SaaS Framework", description="应用名称")
    APP_VERSION: str = Field(default="1.0.0", description="应用版本")
    DEBUG: bool = Field(default=False, description="调试模式")
    ENVIRONMENT: str = Field(default="development", description="运行环境")

    # 服务器配置
    HOST: str = Field(default="0.0.0.0", description="服务器地址")
    PORT: int = Field(default=8000, description="服务器端口")

    # 数据库配置 (PostgreSQL)
    DB_HOST: str = Field(default="localhost", description="数据库主机")
    DB_PORT: int = Field(default=5432, description="数据库端口")
    DB_USER: str = Field(default="postgres", description="数据库用户")
    DB_PASSWORD: str = Field(default="postgres", description="数据库密码")
    DB_NAME: str = Field(default="riveredge", description="数据库名称")

    @property
    def DB_URL(self) -> str:
        """
        构建数据库连接字符串

        Returns:
            str: 数据库连接字符串
        """
        return f"postgres://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # Redis 配置
    REDIS_HOST: str = Field(default="localhost", description="Redis 主机")
    REDIS_PORT: int = Field(default=6379, description="Redis 端口")
    REDIS_PASSWORD: str = Field(default="", description="Redis 密码")
    REDIS_DB: int = Field(default=0, description="Redis 数据库编号")

    @property
    def REDIS_URL(self) -> str:
        """
        构建 Redis 连接字符串

        Returns:
            str: Redis 连接字符串
        """
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # JWT 配置
    JWT_SECRET_KEY: str = Field(default="your-secret-key-here-change-in-production", description="JWT 密钥")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT 算法")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="访问令牌过期时间（分钟）")
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="刷新令牌过期时间（天）")

    # CORS 配置
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8000", "http://localhost:8002"],
        description="CORS 允许的来源"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="CORS 允许凭证")
    CORS_ALLOW_METHODS: List[str] = Field(default=["*"], description="CORS 允许的方法")
    CORS_ALLOW_HEADERS: List[str] = Field(default=["*"], description="CORS 允许的请求头")

    # 日志配置
    LOG_LEVEL: str = Field(default="INFO", description="日志级别")
    LOG_FILE: str = Field(default="logs/riveredge.log", description="日志文件路径（相对于项目根目录）")
    
    # 时区配置 - 最终解决方案：禁用Tortoise ORM时区支持，使用原生datetime
    USE_TZ: bool = Field(default=False, description="是否启用时区支持（Tortoise ORM）")
    TIMEZONE: str = Field(default="UTC", description="默认时区（Tortoise ORM）")
    
    # 平台超级管理员配置
    PLATFORM_SUPERADMIN_USERNAME: str = Field(
        default="platform_admin",
        description="平台超级管理员用户名"
    )
    PLATFORM_SUPERADMIN_PASSWORD: str = Field(
        default="",
        description="平台超级管理员密码（必须设置，建议使用强密码）"
    )
    PLATFORM_SUPERADMIN_EMAIL: str = Field(
        default="platform_admin@riveredge.cn",
        description="平台超级管理员邮箱"
    )
    PLATFORM_SUPERADMIN_FULL_NAME: str = Field(
        default="平台超级管理员",
        description="平台超级管理员全名"
    )


# 创建全局配置实例
platform_settings = PlatformSettings()


def setup_tortoise_timezone_env():
    """
    设置 Tortoise ORM 时区环境变量
    
    统一管理 Tortoise ORM 的时区配置，确保环境变量格式一致。
    Tortoise ORM 的 get_timezone() 和 get_use_tz() 从环境变量读取。
    """
    import os
    os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
    os.environ["TIMEZONE"] = platform_settings.TIMEZONE

