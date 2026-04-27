"""
事件客户端兼容层

保留 ``Inngest`` 命名与 ``create_function`` 装饰器形态；实际投递由
``core.tasks.dispatcher.dispatch_event`` 入队 Taskiq（PostgreSQL broker，见
``core.tasks.taskiq_app``），由独立 worker 消费。
"""

import os
from inngest import Inngest

# 以下为兼容用配置（本地 ``inngest`` 包不向外发起 HTTP）；环境变量名未改以免破坏既有部署。
from infra.config.infra_config import infra_settings

INNGEST_EVENT_API_URL = os.getenv("INNGEST_EVENT_API_URL", None)

if not INNGEST_EVENT_API_URL:
    INNGEST_HOST = os.getenv("INNGEST_HOST", infra_settings.INNGEST_HOST)
    INNGEST_PORT = int(os.getenv("INNGEST_PORT", str(infra_settings.INNGEST_PORT)))
    INNGEST_EVENT_API_URL = f"http://{INNGEST_HOST}:{INNGEST_PORT}"
INNGEST_APP_ID = os.getenv(
    "INNGEST_APP_ID",
    "riveredge"
)
INNGEST_IS_PRODUCTION = os.getenv(
    "INNGEST_IS_PRODUCTION",
    "false"
).lower() == "true"

inngest_client = Inngest(
    app_id=INNGEST_APP_ID,
    event_api_base_url=INNGEST_EVENT_API_URL,
    is_production=INNGEST_IS_PRODUCTION,
)

