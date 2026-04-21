"""
任务处理器注册入口。
"""

# 导入即注册
from core.inngest.functions import *  # noqa: F401,F403
from apps.master_data.inngest.functions import *  # noqa: F401,F403
from apps.kuaizhizao.inngest.functions import *  # noqa: F401,F403


def bootstrap() -> None:
    return None
