"""
平台级配置管理模块

提供平台级配置的单独管理，独立于系统级配置
"""

from typing import List, Union
from pydantic import Field, AliasChoices, field_validator
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
    GIT_SHA: str = Field(
        default="",
        validation_alias=AliasChoices("GIT_SHA", "PLATFORM_GIT_SHA"),
        description="当前部署代码 Git 短 commit（fast-deploy 写入 .env）",
    )
    PLATFORM_BUILD_TIME: str = Field(
        default="",
        description="当前部署构建/更新时间 ISO 8601 UTC（fast-deploy 写入 .env）",
    )
    INSTALL_INSTANCE_ID: str = Field(
        default="",
        description="部署实例 UUID（fast-deploy 首次写入，用于可选登记引用）",
    )
    BUILD_GIT_REMOTE: str = Field(
        default="",
        description="部署时 git remote get-url origin（fast-deploy 写入 .env）",
    )
    BUILD_GIT_BRANCH: str = Field(
        default="",
        description="部署时 git 分支名（fast-deploy 写入 .env）",
    )
    INSTALL_TELEMETRY_ENABLED: bool = Field(
        default=True,
        description="是否允许可选实例登记（false 关闭，见 docs/telemetry-disclosure.md）",
    )
    OFFICIAL_PROVENANCE_ENABLED: bool = Field(
        default=True,
        description="是否启用 Gitee commit 外网校验（false 跳过外网校验）",
    )
    INSTALL_REPO_SUMMARY_ADMIN_ENABLED: bool = Field(
        default=False,
        description="是否启用构建来源汇总管理（仅 kuaigeyun.com 官方 SaaS 设为 true）",
    )

    # 服务器配置
    # 开发默认 0.0.0.0：Windows/Linux 上 localhost、127.0.0.1、局域网 IP 均可连入。
    # 生产（fast-deploy）会覆盖为 127.0.0.1，仅由本机 Caddy 反代，不对外直暴 API。
    HOST: str = Field(default="0.0.0.0", description="监听地址：开发 0.0.0.0；生产建议 127.0.0.1（经反向代理）")
    PORT: int = Field(default=8200, description="后端服务端口")

    # API 文档（/redoc、/openapi.json、可选 /docs）HTTP Basic；二者均非空时才启用，留空则文档仍可匿名访问
    DOCS_BASIC_AUTH_USER: str = Field(default="", description="ReDoc/OpenAPI 文档 Basic 用户名")
    DOCS_BASIC_AUTH_PASSWORD: str = Field(default="", description="ReDoc/OpenAPI 文档 Basic 密码")

    # ReDoc 性能：默认不拉 Google Fonts（国内常见阻塞）；JS 可改为内网/static 自托管以进一步加速
    REDOC_USE_GOOGLE_FONTS: bool = Field(default=False, description="ReDoc 是否加载 Google Fonts")
    REDOC_JS_URL: str = Field(
        default="/static/redoc/redoc.standalone.js",
        description="ReDoc standalone.js（同源路径默认 /static/redoc/...，文件位于 server/doc_assets/redoc；可改为 CDN URL）",
    )

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

    # JWT 配置
    JWT_SECRET_KEY: str = Field(default="your-secret-key-here-change-in-production", description="JWT 密钥")
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT 算法")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30, description="访问令牌过期时间（分钟）")
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7, description="刷新令牌过期时间（天）")

    # 前端服务配置
    FRONTEND_HOST: str = Field(default="127.0.0.1", description="前端服务主机地址")
    FRONTEND_PORT: int = Field(default=8100, description="前端服务端口")
    
    # 历史字段名保留：兼容层 ``core.workflows.client`` 仍读取；实际异步任务由 Taskiq + PostgreSQL 处理。
    INNGEST_HOST: str = Field(default="127.0.0.1", description="兼容配置：原 Inngest Dev 主机（可忽略；异步任务由 Taskiq 承担）")
    INNGEST_PORT: int = Field(default=8288, description="兼容配置：原 Inngest Dev 端口（可忽略）")

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

        - 已显式配置 CORS_ORIGINS（生产/部署向导写入）：原样使用
        - 仍为默认 loopback 列表时：自动补齐 localhost / 127.0.0.1 / FRONTEND_HOST /
          本机局域网 IP，以及 PC 前端、Expo Web、工位端常用端口
        """
        default_origins = ["http://127.0.0.1:8100", "http://localhost:8100"]
        if self.CORS_ORIGINS != default_origins:
            return self.CORS_ORIGINS

        from infra.utils.network import detect_lan_ipv4

        ports = sorted(
            {
                int(self.FRONTEND_PORT),
                8098,  # Expo Web（launch.dev.sh 默认；8081 在部分 Windows Hyper-V 保留段内不可 bind）
                8081,  # Expo Web 旧默认
                8101,  # 前端备用端口
                8300,  # riveredge-app/station Vite
            }
        )
        hosts: List[str] = ["127.0.0.1", "localhost"]
        fh = (self.FRONTEND_HOST or "").strip()
        if fh and fh not in ("0.0.0.0", "::", *hosts):
            hosts.append(fh)
        lan = detect_lan_ipv4()
        if lan and lan not in hosts:
            hosts.append(lan)

        origins: List[str] = []
        seen: set[str] = set()
        for host in hosts:
            for port in ports:
                origin = f"http://{host}:{port}"
                if origin not in seen:
                    seen.add(origin)
                    origins.append(origin)
        return origins

    # 日志配置
    LOG_LEVEL: str = Field(default="INFO", description="日志级别")
    LOG_FILE: str = Field(default="logs/riveredge.log", description="日志文件路径（相对于项目根目录）")
    
    # 时区配置（全局统一）
    # USE_TZ=True：Tortoise 使用 aware datetime
    # TIMEZONE：业务展示和数据库默认时区
    USE_TZ: bool = Field(default=True, description="是否启用时区支持（Tortoise ORM）")
    TIMEZONE: str = Field(default="Asia/Shanghai", description="默认时区（Tortoise ORM / 数据库连接）")
    
    # 平台超级管理员配置（兼容 PLATFORM_SUPERADMIN_* 与 INFRA_SUPERADMIN_*）
    infra_superadmin_USERNAME: str = Field(
        default="infra_admin",
        description="平台超级管理员用户名",
        validation_alias=AliasChoices("PLATFORM_SUPERADMIN_USERNAME", "INFRA_SUPERADMIN_USERNAME"),
    )
    infra_superadmin_PASSWORD: str = Field(
        default="",
        description="平台超级管理员密码（必须设置，建议使用强密码）",
        validation_alias=AliasChoices("PLATFORM_SUPERADMIN_PASSWORD", "INFRA_SUPERADMIN_PASSWORD"),
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
    HAOLIGO_MOBILE_RELEASE_DIR: str = Field(
        default="",
        description="已废弃，请使用 CLIENT_RELEASE_DIR",
    )
    CLIENT_RELEASE_DIR: str = Field(
        default="",
        description="客户端安装包/OTA 存储根目录；空则使用 FILE_UPLOAD_DIR",
    )
    DATA_BACKUP_DIR: str = Field(
        default="",
        description="数据备份 zip 目录；留空则使用 {WORKDIR 或后端根目录}/backups",
    )
    MAX_FILE_SIZE: int = Field(default=100 * 1024 * 1024, description="最大文件大小（字节）")
    
    # 安全增强配置
    SECURITY_STRICT_MODE: bool = Field(default=True, description="是否启用严格安全模式")
    ENABLE_SCRIPT_EXECUTION: bool = Field(default=False, description="是否允许执行自定义脚本（Python/Shell），建议在生产环境禁用")
    # 基础URL配置：显式设置 BASE_URL 时使用该值；不设置则使用相对路径，便于局域网/反向代理部署
    base_url_override: str = Field(default="", alias="BASE_URL", description="文件/图片链接基础URL，不设置则使用相对路径")

    # 极光推送（好力 GO 等移动端锁屏通知；PUSH_PROVIDER=jpush 时使用）
    JPUSH_APP_KEY: str = Field(default="", description="极光 AppKey（客户端）")
    JPUSH_MASTER_SECRET: str = Field(default="", description="极光 Master Secret（仅服务端）")
    PUSH_ENABLED: bool = Field(default=True, description="是否启用移动端推送")
    PUSH_PROVIDER: str = Field(
        default="fcm",
        description="推送通道：fcm（默认）| jpush",
    )
    FCM_PROJECT_ID: str = Field(
        default="",
        description="Firebase 项目 ID；留空则从 FCM_SERVICE_ACCOUNT_JSON 读取",
    )
    FCM_SERVICE_ACCOUNT_JSON: str = Field(
        default="",
        description="FCM 服务账号 JSON 文件路径或内联 JSON 字符串",
    )

    @property
    def BASE_URL(self) -> str:
        """
        获取基础URL（用于生成文件下载/预览链接）
        若设置了 BASE_URL 环境变量则使用该值；否则返回空字符串（使用相对路径）。
        相对路径便于局域网访问：浏览器以当前页面的 origin 加载，无需硬编码 127.0.0.1。
        """
        if self.base_url_override and self.base_url_override.strip():
            return self.base_url_override.strip().rstrip("/")
        return ""
    
    @property
    def SECRET_KEY(self) -> str:
        """
        获取密钥（兼容性属性，返回 JWT_SECRET_KEY）
        
        Returns:
            str: JWT 密钥
        """
        return self.JWT_SECRET_KEY

    @property
    def docs_basic_auth_enabled(self) -> bool:
        """是否对 /redoc、/openapi.json 等启用 Basic 认证。"""
        u = (self.DOCS_BASIC_AUTH_USER or "").strip()
        p = (self.DOCS_BASIC_AUTH_PASSWORD or "")
        return bool(u and p)


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

