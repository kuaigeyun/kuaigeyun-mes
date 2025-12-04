"""
Inngest 工作流函数

定义所有 Inngest 工作流函数，包括定时任务、消息发送等。
"""

# 导入所有 Inngest 函数，确保它们被注册
from tree_root.inngest.functions.test_function import test_integration_function
from tree_root.inngest.functions.message_sender import message_sender_function
from tree_root.inngest.functions.scheduled_task_executor import scheduled_task_executor_function
from tree_root.inngest.functions.scheduled_task_scheduler import scheduled_task_scheduler_function
from tree_root.inngest.functions.approval_workflow import (
    approval_workflow_function,
    approval_action_workflow_function
)
from tree_root.inngest.functions.data_backup_executor import (
    data_backup_executor_function,
    scheduled_backup_scheduler_function
)

__all__ = [
    "test_integration_function",
    "message_sender_function",
    "scheduled_task_executor_function",
    "scheduled_task_scheduler_function",
    "approval_workflow_function",
    "approval_action_workflow_function",
    "data_backup_executor_function",
    "scheduled_backup_scheduler_function",
]

