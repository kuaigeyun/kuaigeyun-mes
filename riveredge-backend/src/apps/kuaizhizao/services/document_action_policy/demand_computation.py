"""需求计算业务态 capabilities（唯一真源，与 demand_computation_service 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    DemandComputationCapabilities,
)


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _is_executable_status(status: Any) -> bool:
    return _norm(status) in ("进行中", "失败")


def _is_recomputable_status(status: Any) -> bool:
    return _norm(status) in ("完成", "失败")


def derive_demand_computation_capabilities(computation: Any) -> DemandComputationCapabilities:
    status = getattr(computation, "computation_status", None)

    execute_cap = _cap(
        _is_executable_status(status),
        "demand_computation.execute.not_allowed"
        if not _is_executable_status(status)
        else None,
    )

    recompute_cap = _cap(
        _is_recomputable_status(status),
        "demand_computation.recompute.not_allowed"
        if not _is_recomputable_status(status)
        else None,
    )

    compare_cap = _cap(
        _norm(status) == "完成",
        "demand_computation.compare.not_completed"
        if _norm(status) != "完成"
        else None,
    )

    export_cap = _cap(True)

    return DemandComputationCapabilities(
        execute=execute_cap,
        recompute=recompute_cap,
        compare=compare_cap,
        export=export_cap,
    )


def assert_demand_computation_capability(computation: Any, action: str) -> None:
    caps = derive_demand_computation_capabilities(computation)
    cap_map = {
        "execute": caps.execute,
        "recompute": caps.recompute,
        "compare": caps.compare,
        "export": caps.export,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown demand computation capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
