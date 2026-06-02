"""
事件驱动工作流处理器（Taskiq 事件装饰器）。

由 ``register_event_handler`` 注册，经 Taskiq ``run_event_pipeline`` 在 worker 中触发；
涵盖定时任务、消息发送、审批与异常流程等。
"""

message_sender_function = None
scheduled_task_executor_function = None
scheduled_task_scheduler_function = None
approval_workflow_function = None
approval_action_workflow_function = None

try:
    from core.workflows.functions.message_sender import message_sender_function
except ImportError:
    message_sender_function = None

try:
    from core.workflows.functions.scheduled_task_executor import scheduled_task_executor_function
except ImportError:
    scheduled_task_executor_function = None

try:
    from core.workflows.functions.scheduled_task_scheduler import run_scheduled_task_scheduler_tick

    scheduled_task_scheduler_function = run_scheduled_task_scheduler_tick
except ImportError:
    scheduled_task_scheduler_function = None

try:
    from core.workflows.functions.approval_workflow import (
        approval_workflow_function,
        approval_action_workflow_function,
    )
except ImportError:
    approval_workflow_function = None
    approval_action_workflow_function = None

# 应用级 workflow 由 core.tasks.workflow_bootstrap 在 Worker 中按已安装应用懒加载；
# 勿在此包内 import apps.*，否则 API 进程会连带加载大型应用模块。

__all__ = [
    "message_sender_function",
    "scheduled_task_executor_function",
    "scheduled_task_scheduler_function",
    "approval_workflow_function",
    "approval_action_workflow_function",
]

