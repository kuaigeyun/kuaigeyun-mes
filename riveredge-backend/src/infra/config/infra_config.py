"""
平台级配置管理模块

提供平台级配置的单独管理，独立于系统级配置
"""

from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class InfraSettings(BaseSettings):
    """
    平台级配置类（对应 infra/ 文件夹）
    
    使用 Pydantic Settings 自动从环境变量加载配置
    平台级配置单独管理，不与系统级配置混合
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # 禁用自动 JSON 解析，使用自定义 validator 处理
        json_schema_extra={
            "json_encoders": {},
        },
    )

    # 应用配置
    APP_NAME: str = Field(default="RiverEdge SaaS Framework", description="应用名称")
    APP_VERSION: str = Field(default="1.0.0", description="应用版本")
    DEBUG: bool = Field(default=False, description="调试模式")
    ENVIRONMENT: str = Field(default="development", description="运行环境")

    # 服务器配置
    HOST: str = Field(default="127.0.0.1", description="服务器地址（Windows 使用 127.0.0.1，Linux/Mac 使用 0.0.0.0）")
    PORT: int = Field(default=8200, description="后端服务端口")

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

    # 前端服务配置
    FRONTEND_HOST: str = Field(default="127.0.0.1", description="前端服务主机地址")
    FRONTEND_PORT: int = Field(default=8100, description="前端服务端口")
    
    # Inngest 服务配置
    INNGEST_HOST: str = Field(default="127.0.0.1", description="Inngest 服务主机地址")
    INNGEST_PORT: int = Field(default=8300, description="Inngest 服务端口")
    
    # CORS 配置
    # 注意：定义为 str 类型，避免 Pydantic Settings 自动尝试 JSON 解析
    # 通过 @property 提供 List[str] 访问
    # 使用 alias 映射环境变量名（CORS_ORIGINS -> CORS_ORIGINS_STR）
    CORS_ORIGINS_STR: str = Field(
        default="http://127.0.0.1:8100,http://localhost:8100",
        alias="CORS_ORIGINS",
        description="CORS 允许的来源（多个值用逗号分隔）"
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True, description="CORS 允许凭证")
    CORS_ALLOW_METHODS_STR: str = Field(
        default="*",
        alias="CORS_ALLOW_METHODS",
        description="CORS 允许的方法（多个值用逗号分隔）"
    )
    CORS_ALLOW_HEADERS_STR: str = Field(
        default="*",
        alias="CORS_ALLOW_HEADERS",
        description="CORS 允许的请求头（多个值用逗号分隔）"
    )
    
    @field_validator("CORS_ORIGINS_STR", "CORS_ALLOW_METHODS_STR", "CORS_ALLOW_HEADERS_STR", mode="before")
    @classmethod
    def parse_comma_separated_str(cls, v: Union[str, List[str]]) -> str:
        """
        解析逗号分隔的字符串配置
        
        支持格式：
        - 逗号分隔的字符串：http://127.0.0.1:8100,http://localhost:8100
        - 单个值：*
        - JSON 数组（自动转换）：["*"] 或 ["GET", "POST"]
        """
        if isinstance(v, list):
            # 如果是列表，转换为逗号分隔的字符串
            return ",".join(str(item) for item in v)
        if isinstance(v, str):
            # 尝试解析 JSON（如果格式正确）
            import json
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    # 如果是 JSON 数组，转换回逗号分隔的字符串
                    return ",".join(str(item) for item in parsed)
            except (json.JSONDecodeError, ValueError):
                pass
            # 返回原始字符串（逗号分隔格式）
            return v
        return str(v) if v is not None else ""
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """
        获取 CORS 允许的来源列表
        
        Returns:
            List[str]: CORS 允许的来源列表
        """
        if not self.CORS_ORIGINS_STR:
            return ["http://127.0.0.1:8100", "http://localhost:8100"]
        return [item.strip() for item in self.CORS_ORIGINS_STR.split(",") if item.strip()]
    
    @property
    def CORS_ALLOW_METHODS(self) -> List[str]:
        """
        获取 CORS 允许的方法列表
        
        Returns:
            List[str]: CORS 允许的方法列表
        """
        if not self.CORS_ALLOW_METHODS_STR:
            return ["*"]
        return [item.strip() for item in self.CORS_ALLOW_METHODS_STR.split(",") if item.strip()]
    
    @property
    def CORS_ALLOW_HEADERS(self) -> List[str]:
        """
        获取 CORS 允许的请求头列表
        
        Returns:
            List[str]: CORS 允许的请求头列表
        """
        if not self.CORS_ALLOW_HEADERS_STR:
            return ["*"]
        return [item.strip() for item in self.CORS_ALLOW_HEADERS_STR.split(",") if item.strip()]
    
    def get_cors_origins(self) -> List[str]:
        """
        获取 CORS 允许的来源列表
        
        如果 CORS_ORIGINS 为空或使用默认值，则自动从前端配置生成
        
        Returns:
            List[str]: CORS 允许的来源列表
        """
        # 如果 CORS_ORIGINS 是默认值，则从前端配置生成
        default_origins = ["http://127.0.0.1:8100", "http://localhost:8100"]
        if self.CORS_ORIGINS == default_origins:
            return [
                f"http://{self.FRONTEND_HOST}:{self.FRONTEND_PORT}",
                f"http://localhost:{self.FRONTEND_PORT}",
            ]
        return self.CORS_ORIGINS

    # 日志配置
    LOG_LEVEL: str = Field(default="INFO", description="日志级别")
    LOG_FILE: str = Field(default="logs/riveredge.log", description="日志文件路径（相对于项目根目录）")
    
    # 时区配置 - 最终解决方案：禁用Tortoise ORM时区支持，使用原生datetime
    USE_TZ: bool = Field(default=False, description="是否启用时区支持（Tortoise ORM）")
    TIMEZONE: str = Field(default="UTC", description="默认时区（Tortoise ORM）")
    
    # 平台超级管理员配置
    infra_superadmin_USERNAME: str = Field(
        default="infra_admin",
        description="平台超级管理员用户名"
    )
    infra_superadmin_PASSWORD: str = Field(
        default="",
        description="平台超级管理员密码（必须设置，建议使用强密码）"
    )
    infra_superadmin_EMAIL: str = Field(
        default="infra_admin@riveredge.cn",
        description="平台超级管理员邮箱"
    )
    infra_superadmin_FULL_NAME: str = Field(
        default="平台超级管理员",
        description="平台超级管理员姓名"
    )

    # 邮件配置 (SMTP)
    SMTP_HOST: str = Field(default="smtp.qq.com", description="SMTP服务器地址")
    SMTP_PORT: int = Field(default=587, description="SMTP服务器端口")
    SMTP_USER: str = Field(default="", description="SMTP用户名")
    SMTP_PASSWORD: str = Field(default="", description="SMTP密码")
    SMTP_TLS: bool = Field(default=True, description="是否启用TLS")
    SMTP_SSL: bool = Field(default=False, description="是否启用SSL")
    EMAIL_FROM: str = Field(default="noreply@riveredge.cn", description="发件人邮箱")
    EMAIL_FROM_NAME: str = Field(default="RiverEdge", description="发件人姓名")

    # 验证码配置
    VERIFICATION_CODE_EXPIRE_MINUTES: int = Field(default=10, description="验证码过期时间（分钟）")
    VERIFICATION_CODE_LENGTH: int = Field(default=6, description="验证码长度")

    # 短信配置 (阿里云短信服务)
    SMS_ACCESS_KEY_ID: str = Field(default="", description="阿里云AccessKey ID")
    SMS_ACCESS_KEY_SECRET: str = Field(default="", description="阿里云AccessKey Secret")
    SMS_SIGN_NAME: str = Field(default="RiverEdge", description="短信签名")
    SMS_TEMPLATE_CODE: str = Field(default="SMS_123456789", description="短信模板CODE")
    
    # 文件管理配置（第三阶段）
    FILE_UPLOAD_DIR: str = Field(default="./uploads", description="文件上传目录")
    MAX_FILE_SIZE: int = Field(default=100 * 1024 * 1024, description="最大文件大小（字节）")
    # 基础URL配置（自动从服务器配置生成）
    @property
    def BASE_URL(self) -> str:
        """
        获取基础URL（用于生成文件下载链接）
        
        自动从服务器配置生成
        """
        return f"http://{self.HOST}:{self.PORT}"
    KKFILEVIEW_URL: str = Field(default="http://localhost:8400", description="kkFileView 服务地址")
    
    @property
    def SECRET_KEY(self) -> str:
        """
        获取密钥（兼容性属性，返回 JWT_SECRET_KEY）
        
        Returns:
            str: JWT 密钥
        """
        return self.JWT_SECRET_KEY


# 创建全局配置实例
infra_settings = InfraSettings()


def setup_tortoise_timezone_env():
    """
    设置 Tortoise ORM 时区环境变量
    
    统一管理 Tortoise ORM 的时区配置，确保环境变量格式一致。
    Tortoise ORM 的 get_timezone() 和 get_use_tz() 从环境变量读取。
    """
    import os
    os.environ["USE_TZ"] = str(infra_settings.USE_TZ)
    os.environ["TIMEZONE"] = infra_settings.TIMEZONE

