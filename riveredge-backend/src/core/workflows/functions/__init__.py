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
sop_execution_workflow_function = None
sop_node_complete_workflow_function = None
exception_detection_scheduler_function = None
exception_detection_worker_function = None
exception_detection_by_tenant_function = None
exception_process_workflow_function = None
exception_process_step_transition_workflow_function = None
maintenance_reminder_scheduler_function = None
maintenance_reminder_checker_function = None
work_order_score_scheduler_function = None
work_order_score_recalc_worker_function = None
work_order_score_recalc_one_function = None

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

try:
    from apps.master_data.workflows.functions.sop_execution_workflow import (
        sop_execution_workflow_function,
        sop_node_complete_workflow_function,
    )
except ImportError:
    sop_execution_workflow_function = None
    sop_node_complete_workflow_function = None

try:
    from apps.kuaizhizao.workflows.functions.exception_detection_workflow import (
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
    from apps.kuaizhizao.workflows.functions.exception_process_workflow import (
        exception_process_workflow_function,
        exception_process_step_transition_workflow_function,
    )
except ImportError:
    exception_process_workflow_function = None
    exception_process_step_transition_workflow_function = None

try:
    from apps.kuaizhizao.workflows.functions.maintenance_reminder_workflow import (
        run_maintenance_reminder_scheduler,
        maintenance_reminder_checker_function,
    )

    maintenance_reminder_scheduler_function = run_maintenance_reminder_scheduler
except ImportError:
    maintenance_reminder_scheduler_function = None
    maintenance_reminder_checker_function = None

try:
    from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
        run_work_order_score_scheduler,
        work_order_score_recalc_one,
        work_order_score_recalc_worker,
    )

    work_order_score_scheduler_function = run_work_order_score_scheduler
    work_order_score_recalc_worker_function = work_order_score_recalc_worker
    work_order_score_recalc_one_function = work_order_score_recalc_one
except ImportError:
    work_order_score_scheduler_function = None
    work_order_score_recalc_worker_function = None
    work_order_score_recalc_one_function = None

__all__ = [
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
    "work_order_score_scheduler_function",
    "work_order_score_recalc_worker_function",
    "work_order_score_recalc_one_function",
]

