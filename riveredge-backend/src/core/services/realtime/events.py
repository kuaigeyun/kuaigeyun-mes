"""实时事件类型（业务层统一命名，与传输层解耦）。"""

from __future__ import annotations

MESSAGE_INTERNAL = "message.internal"
APPROVAL_PENDING = "approval.pending"
APPROVAL_REJECTED = "approval.rejected"
APPROVAL_TRANSFER = "approval.transfer"
APPROVAL_CC = "approval.cc"
APPROVAL_URGE = "approval.urge"
AI_STREAM_START = "ai.stream.start"
AI_STREAM_DELTA = "ai.stream.delta"
AI_STREAM_DONE = "ai.stream.done"
IM_MESSAGE = "im.message"
ANDON_CREATED = "andon.created"
ANDON_UPDATED = "andon.updated"
ANDON_RESOLVED = "andon.resolved"
KUAIIOT_DEVICE_UPDATED = "kuaiiot.device.updated"


def resolve_message_event(variables: dict | None) -> str:
    if not isinstance(variables, dict):
        return MESSAGE_INTERNAL
    if variables.get("message_category") != "approval":
        return MESSAGE_INTERNAL
    action = str(variables.get("trigger_action") or "").strip().lower()
    mapping = {
        "pending": APPROVAL_PENDING,
        "reject": APPROVAL_REJECTED,
        "rejected": APPROVAL_REJECTED,
        "transfer": APPROVAL_TRANSFER,
        "cc": APPROVAL_CC,
        "urge": APPROVAL_URGE,
    }
    return mapping.get(action, MESSAGE_INTERNAL)
