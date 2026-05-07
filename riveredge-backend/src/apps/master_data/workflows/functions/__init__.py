"""
master_data 工作流函数入口。
"""

from apps.master_data.workflows.functions.sop_execution_workflow import (
    sop_execution_workflow_function,
    sop_node_complete_workflow_function,
)

__all__ = [
    "sop_execution_workflow_function",
    "sop_node_complete_workflow_function",
]

