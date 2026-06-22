"""站内信推送 payload 公共字段（FCM / 极光共用）。"""

from __future__ import annotations

import re
from typing import Any

_TAG_RE = re.compile(r"<[^>]+>")

_PUSH_EXTRA_KEYS = (
    "trigger_document",
    "trigger_action",
    "detail_path",
    "sheet_no",
    "trial_sheet_id",
    "mold_maintenance_sheet_id",
    "mold_maintenance_complete_sheet_id",
    "outsource_maintenance_sheet_id",
    "outsource_complete_sheet_id",
    "equipment_upkeep_sheet_id",
    "equipment_upkeep_complete_sheet_id",
    "spot_check_id",
    "route_patrol_id",
    "hazard_id",
    "service_type",
)


def plain_text(raw: str, *, limit: int = 120) -> str:
    text = _TAG_RE.sub("", raw or "").replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1]}…"


def resolve_route_kind(*, subject: str, variables: dict[str, Any] | None) -> str:
    action = str((variables or {}).get("trigger_action") or "").strip().lower()
    if action in {"submitted"}:
        return "approval"
    subj = (subject or "").strip()
    if "待审" in subj or "待审核" in subj:
        return "approval"
    return "message"


def build_push_extras(
    *,
    tenant_id: int,
    message_log_uuid: str,
    subject: str,
    variables: dict[str, Any] | None,
) -> dict[str, str]:
    extras: dict[str, str] = {
        "message_uuid": message_log_uuid,
        "tenant_id": str(tenant_id),
        "route_kind": resolve_route_kind(subject=subject, variables=variables),
    }
    for key, value in (variables or {}).items():
        if value is None:
            continue
        text = str(value).strip()
        if not text:
            continue
        if key in _PUSH_EXTRA_KEYS or key.endswith("_id"):
            extras[key] = text
    return extras
