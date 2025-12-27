"""
Inngest 工作流函数

定义所有 Inngest 工作流函数，包括定时任务、消息发送等。
"""

# 导入所有 Inngest 函数，确保它们被注册
from core.inngest.functions.test_function import test_integration_function
from core.inngest.functions.message_sender import message_sender_function
from core.inngest.functions.scheduled_task_executor import scheduled_task_executor_function
from core.inngest.functions.scheduled_task_scheduler import scheduled_task_scheduler_function
from core.inngest.functions.approval_workflow import (
    approval_workflow_function,
    approval_action_workflow_function
)
from apps.master_data.inngest.functions.sop_execution_workflow import (
    sop_execution_workflow_function,
    sop_node_complete_workflow_function
)

__all__ = [
    "test_integration_function",
    "message_sender_function",
    "scheduled_task_executor_function",
    "scheduled_task_scheduler_function",
    "approval_workflow_function",
    "approval_action_workflow_function",
    "sop_execution_workflow_function",
    "sop_node_complete_workflow_function",
]

