"""
Inngest 客户端配置

提供全局 Inngest 客户端实例，用于发送事件和注册工作流函数。
"""

import os
from inngest import Inngest

# 从环境变量获取 Inngest 配置
# 优先使用 INNGEST_EVENT_API_URL，否则从 infra_settings 读取
from infra.config.infra_config import infra_settings

INNGEST_HOST = os.getenv("INNGEST_HOST", infra_settings.INNGEST_HOST)
INNGEST_PORT = int(os.getenv("INNGEST_PORT", str(infra_settings.INNGEST_PORT)))
INNGEST_EVENT_API_URL = os.getenv(
    "INNGEST_EVENT_API_URL",
    f"http://{INNGEST_HOST}:{INNGEST_PORT}"
)
INNGEST_APP_ID = os.getenv(
    "INNGEST_APP_ID",
    "riveredge"
)
INNGEST_IS_PRODUCTION = os.getenv(
    "INNGEST_IS_PRODUCTION",
    "false"
).lower() == "true"

# 创建全局 Inngest 客户端
inngest_client = Inngest(
    app_id=INNGEST_APP_ID,
    event_api_base_url=INNGEST_EVENT_API_URL,
    is_production=INNGEST_IS_PRODUCTION,
)

