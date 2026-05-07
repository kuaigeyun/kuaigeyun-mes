"""
Taskiq 事件客户端。

保留与历史接口一致的 ``create_function`` / ``send`` 能力，
底层由 ``core.tasks.event_compat`` 和 dispatcher 执行。
"""

import os

from core.tasks.event_compat import Inngest
from infra.config.infra_config import infra_settings

INNGEST_EVENT_API_URL = os.getenv("INNGEST_EVENT_API_URL", None)

if not INNGEST_EVENT_API_URL:
    INNGEST_HOST = os.getenv("INNGEST_HOST", infra_settings.INNGEST_HOST)
    INNGEST_PORT = int(os.getenv("INNGEST_PORT", str(infra_settings.INNGEST_PORT)))
    INNGEST_EVENT_API_URL = f"http://{INNGEST_HOST}:{INNGEST_PORT}"
INNGEST_APP_ID = os.getenv("INNGEST_APP_ID", "riveredge")
INNGEST_IS_PRODUCTION = os.getenv("INNGEST_IS_PRODUCTION", "false").lower() == "true"

workflow_client = Inngest(
    app_id=INNGEST_APP_ID,
    event_api_base_url=INNGEST_EVENT_API_URL,
    is_production=INNGEST_IS_PRODUCTION,
)

# 兼容历史命名，避免遗漏引用导致运行时报错。
inngest_client = workflow_client

