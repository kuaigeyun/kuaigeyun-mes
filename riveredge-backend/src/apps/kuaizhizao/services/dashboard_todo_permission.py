"""工作台待办按单据模块 :read 权限过滤（与列表页鉴权码对齐）。"""

from __future__ import annotations

from typing import TYPE_CHECKING, FrozenSet, Iterable, Optional

if TYPE_CHECKING:
    from infra.models.user import User

# todo_id 前缀 → 打开对应单据所需的 :read 权限（与列表 API / manifest 一致）
TODO_SOURCE_READ_PERMISSION: dict[str, str] = {
    "work_order_": "kuaizhizao:work-order:read",
    "exception_material_": "kuaizhizao:production-execution-material-shortage-exceptions:read",
    "exception_delay_": "kuaizhizao:production-execution-delivery-delay-exceptions:read",
    "exception_quality_": "kuaizhizao:production-execution-quality-exceptions:read",
    "inventory_alert_": "kuaizhizao:warehouse-management-inventory-alert:read",
    "purchase_receipt_": "kuaizhizao:inbound:read",
    "finished_goods_receipt_": "kuaizhizao:inbound:read",
    "production_return_": "kuaizhizao:inbound:read",
    "other_inbound_": "kuaizhizao:other-inbound:read",
    "material_borrow_": "kuaizhizao:material-borrow:read",
    "material_return_": "kuaizhizao:material-return:read",
    "material_call_": "kuaizhizao:warehouse-management-material-calls:read",
    "receipt_notice_": "kuaizhizao:receipt-notice:read",
    "production_picking_": "kuaizhizao:outbound:read",
    "sales_delivery_": "kuaizhizao:outbound:read",
    "other_outbound_": "kuaizhizao:other-outbound:read",
    "purchase_requisition_": "kuaizhizao:purchase-requisition:read",
    "purchase_return_": "kuaizhizao:purchase-return:read",
    "shipment_notice_": "kuaizhizao:shipment-notice:read",
    "sales_return_": "kuaizhizao:sales-return:read",
    "equipment_fault_": "kuaizhizao:equipment-fault:read",
    "inspection_incoming_": "kuaizhizao:quality-management-incoming-inspection:read",
    "inspection_process_": "kuaizhizao:quality-management-process-inspection:read",
    "inspection_finished_": "kuaizhizao:quality-management-finished-goods-inspection:read",
}

TODO_SOURCE_PREFIXES: FrozenSet[str] = frozenset(TODO_SOURCE_READ_PERMISSION.keys())


def _normalize(code: str) -> str:
    return (code or "").strip().lower()


def resolve_todo_prefix(todo_id: str) -> Optional[str]:
    """解析单据类待办前缀；审批任务返回 None（由指派人可见，不按单据 :read 过滤）。"""
    tid = (todo_id or "").strip()
    if not tid or tid.startswith("approval_task_"):
        return None
    for prefix in TODO_SOURCE_READ_PERMISSION:
        if tid.startswith(prefix):
            return prefix
    return None


async def resolve_allowed_todo_prefixes(user: "User", tenant_id: int) -> FrozenSet[str]:
    """当前用户可读的待办来源前缀集合。"""
    from core.services.authorization.user_permission_service import UserPermissionService

    if await UserPermissionService.is_admin_bypass(user, tenant_id):
        return TODO_SOURCE_PREFIXES

    user_perms = {
        _normalize(c)
        for c in await UserPermissionService.get_user_permissions(
            user_id=int(user.id),
            tenant_id=tenant_id,
        )
    }
    allowed = {
        prefix
        for prefix, code in TODO_SOURCE_READ_PERMISSION.items()
        if _normalize(code) in user_perms
    }
    return frozenset(allowed)


def is_todo_id_allowed(todo_id: str, allowed_prefixes: Iterable[str]) -> bool:
    """审批待办始终允许；单据待办须前缀在允许集合内。未知前缀拒绝。"""
    prefix = resolve_todo_prefix(todo_id)
    if prefix is None:
        # approval_task_ 或空 id：审批放行；空/未知非审批拒绝
        tid = (todo_id or "").strip()
        return bool(tid.startswith("approval_task_"))
    allowed = allowed_prefixes if isinstance(allowed_prefixes, (set, frozenset)) else set(allowed_prefixes)
    return prefix in allowed
