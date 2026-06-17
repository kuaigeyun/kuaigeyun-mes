"""
Taskiq 事件客户端。

保留与历史接口一致的 ``create_function`` / ``send`` 能力，
底层由 ``core.tasks.event_compat`` 和 dispatcher 执行。
"""

import os

from core.tasks.event_compat import Inngest
from infra.config.infra_config import infra_settings

EVENT_API_URL = os.getenv("TASKIQ_EVENT_API_URL") or os.getenv("INNGEST_EVENT_API_URL")
if not EVENT_API_URL:
    host = os.getenv("TASKIQ_EVENT_HOST") or os.getenv("INNGEST_HOST", infra_settings.INNGEST_HOST)
    port = int(os.getenv("TASKIQ_EVENT_PORT") or os.getenv("INNGEST_PORT", str(infra_settings.INNGEST_PORT)))
    EVENT_API_URL = f"http://{host}:{port}"

APP_ID = os.getenv("TASKIQ_APP_ID") or os.getenv("INNGEST_APP_ID", "riveredge")
IS_PRODUCTION = os.getenv("TASKIQ_IS_PRODUCTION", os.getenv("INNGEST_IS_PRODUCTION", "false")).lower() == "true"

workflow_client = Inngest(
    app_id=APP_ID,
    event_api_base_url=EVENT_API_URL,
    is_production=IS_PRODUCTION,
)

# 兼容历史命名
inngest_client = workflow_client

