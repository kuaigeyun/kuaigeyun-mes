"""好力 GO — 协作单据通知 context 构建。"""

from __future__ import annotations

from typing import Any

from apps.haoligo.services.notification_context import with_form_notify_user_ids


def maintenance_sheet_submitted_context(row: Any) -> dict:
    ctx: dict = {"service_type": (getattr(row, "service_type", None) or "").strip()}
    uid = getattr(row, "applicant_user_id", None)
    if uid and int(uid) > 0:
        ctx["creator_user_id"] = int(uid)
    return with_form_notify_user_ids(ctx, getattr(row, "submitted_notify_user_ids", None))


def maintenance_sheet_approved_context(row: Any) -> dict:
    ctx: dict = {"service_type": (getattr(row, "service_type", None) or "").strip()}
    uid = getattr(row, "applicant_user_id", None)
    if uid and int(uid) > 0:
        ctx["creator_user_id"] = int(uid)
    return ctx


def maintenance_sheet_revoked_context(row: Any) -> dict:
    ctx = maintenance_sheet_submitted_context(row)
    auditor = getattr(row, "audited_by_user_id", None)
    if auditor and int(auditor) > 0:
        ctx["source_auditor_user_id"] = int(auditor)
    return ctx


def _with_outsource_partner_codes(ctx: dict, row: Any) -> dict:
    code = (getattr(row, "outsourced_unit_code", None) or "").strip()
    if code:
        ctx["outsourced_unit_code"] = code
        ctx["supplier_code"] = code
    return ctx


def outsource_sheet_submitted_context(row: Any) -> dict:
    ctx: dict = {
        "outsourced_unit_name": (getattr(row, "outsourced_unit_name", None) or "").strip(),
        "supplier_name": (getattr(row, "outsourced_unit_name", None) or "").strip(),
    }
    _with_outsource_partner_codes(ctx, row)
    uid = getattr(row, "applicant_user_id", None)
    if uid and int(uid) > 0:
        ctx["creator_user_id"] = int(uid)
    return with_form_notify_user_ids(ctx, getattr(row, "submitted_notify_user_ids", None))


def outsource_sheet_approved_context(row: Any) -> dict:
    ctx = outsource_sheet_submitted_context(row)
    return ctx


def outsource_sheet_revoked_context(row: Any) -> dict:
    ctx = outsource_sheet_submitted_context(row)
    auditor = getattr(row, "audited_by_user_id", None)
    if auditor and int(auditor) > 0:
        ctx["source_auditor_user_id"] = int(auditor)
    return ctx
