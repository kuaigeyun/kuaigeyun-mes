"""
任务处理器注册入口（兼容 fs-discover / 显式模块列表）。

实际注册在 ``taskiq_app._on_worker_startup`` → ``workflow_bootstrap.bootstrap_worker_event_handlers``。
"""

import core.tasks.taskiq_app  # noqa: F401
