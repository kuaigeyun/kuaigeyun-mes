"""
任务处理器注册入口。

Taskiq broker 任务定义于 core.tasks.taskiq_app；事件处理器由下方 workflow 模块注册到 dispatcher。
"""

import core.tasks.taskiq_app  # noqa: F401

# 导入即注册（register_event_handler）
from core.workflows.functions import *  # noqa: F401,F403
from apps.master_data.workflows.functions import *  # noqa: F401,F403
from apps.kuaizhizao.workflows.functions import *  # noqa: F401,F403


def bootstrap() -> None:
    return None
