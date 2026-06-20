"""装箱绑定业务态 capabilities（唯一真源，与 packing_binding_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    PackingBindingCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def derive_packing_binding_capabilities(binding: Any) -> PackingBindingCapabilities:
    is_deleted = getattr(binding, "deleted_at", None) is not None
    deny = _cap(False, "packing_binding.deleted")

    update_cap = deny if is_deleted else _cap(True)
    delete_cap = deny if is_deleted else _cap(True)
    print_cap = deny if is_deleted else _cap(True)

    return PackingBindingCapabilities(
        update=update_cap,
        delete=delete_cap,
        print=print_cap,
    )


def assert_packing_binding_capability(binding: Any, action: str) -> None:
    caps = derive_packing_binding_capabilities(binding)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown packing binding capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
