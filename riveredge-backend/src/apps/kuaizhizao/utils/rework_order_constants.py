"""返工单路线模式与状态常量（唯一真源）。"""

from __future__ import annotations

ROUTING_MODE_DYNAMIC = "DYNAMIC"
ROUTING_MODE_PREDEFINED = "PREDEFINED"

REWORK_ORDER_STATUSES = frozenset({
    "draft",
    "released",
    "in_progress",
    "pending_verification",
    "quality_released",
    "closed",
    "cancelled",
    "on_hold",
})

TERMINAL_REWORK_ORDER_STATUSES = frozenset({"closed", "cancelled"})

ACTIVE_REWORK_ORDER_STATUSES = frozenset({"released", "in_progress", "pending_verification", "quality_released"})

OPERATION_ROLE_START = "start"
OPERATION_ROLE_PLANNED = "planned"
OPERATION_ROLE_DYNAMIC = "dynamic"

OPERATION_STATUS_PENDING = "pending"
OPERATION_STATUS_ACTIVE = "active"
OPERATION_STATUS_COMPLETED = "completed"
OPERATION_STATUS_SKIPPED = "skipped"
