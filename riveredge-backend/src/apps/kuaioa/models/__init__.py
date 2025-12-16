"""
OA模块模型

导出所有协同办公相关的模型。
"""

from apps.kuaioa.models.approval import (
    ApprovalProcess,
    ApprovalInstance,
    ApprovalNode,
)
from apps.kuaioa.models.document import (
    Document,
    DocumentVersion,
)
from apps.kuaioa.models.meeting import (
    Meeting,
    MeetingMinutes,
    MeetingResource,
)
from apps.kuaioa.models.notice import (
    Notice,
    Notification,
)

__all__ = [
    "ApprovalProcess",
    "ApprovalInstance",
    "ApprovalNode",
    "Document",
    "DocumentVersion",
    "Meeting",
    "MeetingMinutes",
    "MeetingResource",
    "Notice",
    "Notification",
]

