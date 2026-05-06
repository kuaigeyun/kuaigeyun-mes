"""
事件驱动工作流处理器（兼容 Inngest 风格装饰器）

由 ``register_event_handler`` 注册，经 Taskiq ``run_event_pipeline`` 在 worker 中触发；
涵盖定时任务、消息发送、审批与异常流程等。
"""

# 检查inngest模块是否可用
try:
    import inngest
    INNGEST_AVAILABLE = True
except ImportError:
    INNGEST_AVAILABLE = False
    # 测试环境可能没有inngest，创建占位符
    test_integration_function = None
    message_sender_function = None
    scheduled_task_executor_function = None
    scheduled_task_scheduler_function = None
    approval_workflow_function = None
    approval_action_workflow_function = None
    sop_execution_workflow_function = None
    sop_node_complete_workflow_function = None
    data_backup_workflow = None
    data_restore_workflow = None


# 只有在inngest可用时才导入函数
if INNGEST_AVAILABLE:
    # 导入所有工作流模块，确保处理器注册到 dispatcher
    try:
        from core.inngest.functions.test_function import test_integration_function
    except ImportError:
        test_integration_function = None
    
    try:
        from core.inngest.functions.message_sender import message_sender_function
    except ImportError:
        message_sender_function = None
    
    try:
        from core.inngest.functions.scheduled_task_executor import scheduled_task_executor_function
    except ImportError:
        scheduled_task_executor_function = None
    
    try:
        from core.inngest.functions.scheduled_task_scheduler import run_scheduled_task_scheduler_tick

        scheduled_task_scheduler_function = run_scheduled_task_scheduler_tick
    except ImportError:
        scheduled_task_scheduler_function = None
    
    try:
        from core.inngest.functions.approval_workflow import (
            approval_workflow_function,
            approval_action_workflow_function
        )
    except ImportError:
        approval_workflow_function = None
        approval_action_workflow_function = None
    
    try:
        from apps.master_data.inngest.functions.sop_execution_workflow import (
            sop_execution_workflow_function,
            sop_node_complete_workflow_function
        )
    except ImportError:
        sop_execution_workflow_function = None
        sop_node_complete_workflow_function = None
    
    try:
        from apps.kuaizhizao.inngest.functions.exception_detection_workflow import (
            run_exception_detection_scheduler,
            exception_detection_worker_function,
            exception_detection_by_tenant_function,
        )

        exception_detection_scheduler_function = run_exception_detection_scheduler
    except ImportError:
        exception_detection_scheduler_function = None
        exception_detection_worker_function = None
        exception_detection_by_tenant_function = None
    
    try:
        from apps.kuaizhizao.inngest.functions.exception_process_workflow import (
            exception_process_workflow_function,
            exception_process_step_transition_workflow_function
        )
    except ImportError:
        exception_process_workflow_function = None
        exception_process_step_transition_workflow_function = None
    
    try:
        from apps.kuaizhizao.inngest.functions.maintenance_reminder_workflow import (
            run_maintenance_reminder_scheduler,
            maintenance_reminder_checker_function,
        )

        maintenance_reminder_scheduler_function = run_maintenance_reminder_scheduler
    except ImportError:
        maintenance_reminder_scheduler_function = None
        maintenance_reminder_checker_function = None
    
    # 数据备份/恢复见 core.tasks.data_backup_handlers（Taskiq 事件链）
    data_backup_workflow = None
    data_restore_workflow = None

__all__ = [
    "test_integration_function",
    "message_sender_function",
    "scheduled_task_executor_function",
    "scheduled_task_scheduler_function",
    "approval_workflow_function",
    "approval_action_workflow_function",
    "sop_execution_workflow_function",
    "sop_node_complete_workflow_function",
    "exception_detection_scheduler_function",
    "exception_detection_worker_function",
    "exception_detection_by_tenant_function",
    "exception_process_workflow_function",
    "exception_process_step_transition_workflow_function",
    "maintenance_reminder_scheduler_function",
    "maintenance_reminder_checker_function",
    "data_backup_workflow",
    "data_restore_workflow",
]

