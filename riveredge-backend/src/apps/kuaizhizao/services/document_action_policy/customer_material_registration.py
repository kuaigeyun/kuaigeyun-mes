"""代工来料登记业务态 capabilities（与 customer_material_registration_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    CustomerMaterialRegistrationCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def derive_customer_material_registration_capabilities(
    registration: Any,
) -> CustomerMaterialRegistrationCapabilities:
    status = _norm(getattr(registration, "status", None))

    confirm_cap = _cap(
        status == "pending",
        "customer_material.confirm.not_pending" if status != "pending" else None,
    )
    withdraw_cap = _cap(
        status == "processed",
        "customer_material.withdraw.not_processed" if status != "processed" else None,
    )
    cancel_cap = _cap(
        status == "pending",
        "customer_material.cancel.not_pending" if status != "pending" else None,
    )
    delete_cap = _cap(
        status == "pending",
        "customer_material.delete.not_pending" if status != "pending" else None,
    )
    print_cap = _cap(True)

    return CustomerMaterialRegistrationCapabilities(
        confirm=confirm_cap,
        withdraw=withdraw_cap,
        cancel=cancel_cap,
        delete=delete_cap,
        print=print_cap,
    )


def assert_customer_material_registration_capability(registration: Any, action: str) -> None:
    caps = derive_customer_material_registration_capabilities(registration)
    cap_map = {
        "confirm": caps.confirm,
        "withdraw": caps.withdraw,
        "cancel": caps.cancel,
        "delete": caps.delete,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown customer material registration capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
