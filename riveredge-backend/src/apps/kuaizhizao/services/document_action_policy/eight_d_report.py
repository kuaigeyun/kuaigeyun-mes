"""8D 报告业务态 capabilities（与 Quality8DService 门禁一致）。"""

from __future__ import annotations

from typing import Any, Optional

from infra.exceptions.exceptions import BusinessLogicError

from apps.kuaizhizao.services.document_action_policy.types import (
    ActionCapability,
    CAPABILITY_REASON_MESSAGES,
    EightDReportCapabilities,
)

_VALID_8D_STATUS_FLOW = [
    "d1_team",
    "d2_problem",
    "d3_containment",
    "d4_root_cause",
    "d5_corrective_action",
    "d6_implement_result",
    "d7_prevent_recurrence",
    "d8_team_congratulation",
    "closed",
]
_STAGE_REQUIRED_FIELD = {
    "d1_team": "d1_team",
    "d2_problem": "d2_problem",
    "d3_containment": "d3_containment",
    "d4_root_cause": "d4_root_cause",
    "d5_corrective_action": "d5_corrective_action",
    "d6_implement_result": "d6_implement_result",
    "d7_prevent_recurrence": "d7_prevent_recurrence",
    "d8_team_congratulation": "d8_team_congratulation",
}


def _cap(allowed: bool, reason: Optional[str] = None) -> ActionCapability:
    return ActionCapability(allowed=allowed, reason=reason if not allowed else None)


def _norm(value: Any) -> str:
    return str(value or "").strip()


def _next_status(status: str) -> Optional[str]:
    try:
        idx = _VALID_8D_STATUS_FLOW.index(status)
    except ValueError:
        return None
    if idx >= len(_VALID_8D_STATUS_FLOW) - 1:
        return None
    return _VALID_8D_STATUS_FLOW[idx + 1]


def _stage_content_ready(report: Any, stage: str) -> bool:
    field = _STAGE_REQUIRED_FIELD.get(stage)
    if not field:
        return True
    return bool(_norm(getattr(report, field, None)))


def derive_eight_d_report_capabilities(report: Any) -> EightDReportCapabilities:
    status = _norm(getattr(report, "status", None))
    is_closed = status == "closed"
    next_status = _next_status(status) if status else None

    update_cap = _cap(
        not is_closed,
        "eight_d_report.update.closed" if is_closed else None,
    )

    delete_cap = _cap(
        not is_closed,
        "eight_d_report.delete.closed" if is_closed else None,
    )

    transition_allowed = False
    transition_reason = "eight_d_report.transition.closed"
    if is_closed:
        pass
    elif not next_status or next_status == "closed":
        transition_reason = "eight_d_report.transition.no_next"
    elif not _stage_content_ready(report, status):
        transition_reason = "eight_d_report.transition.stage_incomplete"
    else:
        transition_allowed = True
        transition_reason = None
    transition_cap = _cap(transition_allowed, transition_reason)

    close_allowed = False
    close_reason = "eight_d_report.close.not_allowed"
    if is_closed:
        close_reason = "eight_d_report.close.already_closed"
    elif next_status != "closed":
        close_reason = "eight_d_report.close.not_at_final_stage"
    elif not _stage_content_ready(report, status):
        close_reason = "eight_d_report.close.stage_incomplete"
    else:
        close_allowed = True
        close_reason = None
    close_cap = _cap(close_allowed, close_reason)

    print_cap = _cap(True)

    return EightDReportCapabilities(
        update=update_cap,
        delete=delete_cap,
        transition=transition_cap,
        close=close_cap,
        print=print_cap,
    )


def assert_eight_d_report_capability(report: Any, action: str) -> None:
    caps = derive_eight_d_report_capabilities(report)
    cap_map = {
        "update": caps.update,
        "delete": caps.delete,
        "transition": caps.transition,
        "close": caps.close,
        "print": caps.print,
    }
    cap = cap_map.get(action)
    if cap is None:
        raise ValueError(f"Unknown 8D report capability action: {action}")
    if not cap.allowed:
        msg = CAPABILITY_REASON_MESSAGES.get(cap.reason or "", cap.reason or "操作不允许")
        raise BusinessLogicError(msg)
