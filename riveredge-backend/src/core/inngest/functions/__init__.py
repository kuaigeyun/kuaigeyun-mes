"""
Inngest 工作流函数

定义所有 Inngest 工作流函数，包括定时任务、消息发送等。
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
    material_change_notification_workflow = None
    data_backup_workflow = None
    data_restore_workflow = None

# 只有在inngest可用时才导入函数
if INNGEST_AVAILABLE:
    # 导入所有 Inngest 函数，确保它们被注册
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
        from core.inngest.functions.scheduled_task_scheduler import scheduled_task_scheduler_function
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
        from apps.master_data.inngest.functions.material_ai_suggestion_workflow import (
            material_ai_suggestion_workflow
        )
    except ImportError:
        material_ai_suggestion_workflow = None

    try:
        from apps.master_data.inngest.functions.material_change_notification_workflow import (
            material_change_notification_workflow
        )
    except ImportError:
        material_change_notification_workflow = None
    
    try:
        from apps.kuaizhizao.inngest.functions.exception_detection_workflow import (
            exception_detection_scheduler_function,
            exception_detection_worker_function,
            exception_detection_by_tenant_function
        )
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
            maintenance_reminder_scheduler_function,
            maintenance_reminder_checker_function
        )
    except ImportError:
        maintenance_reminder_scheduler_function = None
        maintenance_reminder_checker_function = None
    
    try:
        from core.inngest.functions.backup_functions import (
            data_backup_workflow,
            data_restore_workflow
        )
    except ImportError:
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
    "material_ai_suggestion_workflow",
    "material_change_notification_workflow",
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

