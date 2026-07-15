"""移动端待办角标：按「当前用户为指定相关人」聚合（角标 B）。"""

from __future__ import annotations

from typing import Any

from tortoise.expressions import Q

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED, SHEET_STATUS_PENDING
from apps.haoligo.models.equipment_upkeep import (
    HaoligoEquipmentUpkeepCompleteSheet,
    HaoligoEquipmentUpkeepSheet,
)
from apps.haoligo.models.mold_maintenance_complete_sheet import HaoligoMoldMaintenanceCompleteSheet
from apps.haoligo.models.mold_maintenance_sheet import HaoligoMoldMaintenanceSheet
from apps.haoligo.models.mold_outsource_maintenance_complete_sheet import (
    HaoligoMoldOutsourceMaintenanceCompleteSheet,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from apps.haoligo.models.patrol import HaoligoHazardReport
from apps.haoligo.models.quality import (
    HaoligoCustomerComplaint,
    HaoligoLineStopFeedback,
    HaoligoQualityIssueTracking,
)
from apps.haoligo.services.trial_sheet_side_effects import pending_trial_failure_exception_q
from core.config.permission_contract import build_permission_code
from core.services.authorization.user_permission_service import UserPermissionService
from infra.models.user import User


def _json_contains_user(field: str, user_id: int) -> Q:
    return Q(**{f"{field}__contains": [user_id]})


def _json_empty_or_null(field: str) -> Q:
    return Q(**{f"{field}": None}) | Q(**{f"{field}": []})


async def _has_perm(user: User, tenant_id: int, code: str) -> bool:
    if await UserPermissionService.is_admin_bypass(user, tenant_id):
        return True
    return await UserPermissionService.has_permission(user.id, tenant_id, code)


async def _count_pending_audit_personal(
    model: Any,
    tenant_id: int,
    user_id: int,
    *,
    notify_field: str,
    has_approve: bool,
    extra: Q | None = None,
) -> int:
    qs = tenant_alive(model, tenant_id).filter(sheet_status=SHEET_STATUS_PENDING)
    if extra is not None:
        qs = qs.filter(extra)
    personal = _json_contains_user(notify_field, user_id)
    if has_approve:
        qs = qs.filter(personal | _json_empty_or_null(notify_field))
    else:
        qs = qs.filter(personal)
    return await qs.count()


async def _count_open_for_complete_mold(
    tenant_id: int,
    user_id: int,
    *,
    service_type: str,
    has_complete: bool,
) -> int:
    linked = [
        int(x)
        for x in await tenant_alive(HaoligoMoldMaintenanceCompleteSheet, tenant_id)
        .filter(deleted_at__isnull=True, source_maintenance_sheet_id__not_isnull=True)
        .values_list("source_maintenance_sheet_id", flat=True)
        if x is not None
    ]
    qs = tenant_alive(HaoligoMoldMaintenanceSheet, tenant_id).filter(
        sheet_status=SHEET_STATUS_APPROVED,
        service_type=service_type,
    )
    if linked:
        qs = qs.filter(~Q(id__in=linked))
    personal = _json_contains_user("complete_notify_user_ids", user_id)
    if has_complete:
        qs = qs.filter(personal | _json_empty_or_null("complete_notify_user_ids"))
    else:
        qs = qs.filter(personal)
    return await qs.count()


async def _count_equip_open_for_complete(tenant_id: int, user_id: int, *, has_complete: bool) -> int:
    linked = [
        int(x)
        for x in await tenant_alive(HaoligoEquipmentUpkeepCompleteSheet, tenant_id)
        .filter(deleted_at__isnull=True, source_upkeep_sheet_id__not_isnull=True)
        .values_list("source_upkeep_sheet_id", flat=True)
        if x is not None
    ]
    qs = tenant_alive(HaoligoEquipmentUpkeepSheet, tenant_id)
    if linked:
        qs = qs.filter(~Q(id__in=linked))
    personal = _json_contains_user("complete_notify_user_ids", user_id)
    if has_complete:
        qs = qs.filter(personal | _json_empty_or_null("complete_notify_user_ids"))
    else:
        qs = qs.filter(personal)
    return await qs.count()


async def _count_quality_handle(model: Any, tenant_id: int, user_id: int) -> int:
    return (
        await tenant_alive(model, tenant_id)
        .filter(status__in=["assigned", "processing"])
        .filter(_json_contains_user("responsible_user_ids", user_id) | Q(responsible_user_id=user_id))
        .count()
    )


async def compute_mobile_todo_badges(tenant_id: int, user: User) -> dict[str, int]:
    uid = int(user.id)
    trial_approve = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-trial", "approve")
    )
    trial_read = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-trial", "read")
    )
    upkeep_approve = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-upkeep", "approve")
    )
    repair_approve = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-repair", "approve")
    )
    outsource_maint_approve = await _has_perm(
        user,
        tenant_id,
        build_permission_code("haoligo", "molds-documents-outsource-maintenance", "approve"),
    )
    outsource_complete_approve = await _has_perm(
        user,
        tenant_id,
        build_permission_code("haoligo", "molds-documents-outsource-complete", "approve"),
    )
    upkeep_complete = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-upkeep-complete", "create")
    )
    repair_complete = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "molds-documents-repair-complete", "create")
    )
    equip_complete = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "equipment-documents-upkeep-complete", "create")
    )
    hazard_read = await _has_perm(
        user, tenant_id, build_permission_code("haoligo", "patrol-hazards", "read")
    )

    # 试模待审
    trial_qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(sheet_status=SHEET_STATUS_PENDING)
    trial_personal = _json_contains_user("submitted_notify_user_ids", uid)
    if trial_approve:
        trial_count = await trial_qs.filter(
            trial_personal | _json_empty_or_null("submitted_notify_user_ids")
        ).count()
    else:
        trial_count = await trial_qs.filter(trial_personal).count()

    # 试模不合格
    fail_qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(pending_trial_failure_exception_q())
    fail_personal = (
        _json_contains_user("pending_notify_user_ids", uid)
        | Q(trial_user_id=uid)
    )
    if trial_read:
        # 计划：不合格优先指定人；无指定时仅 notify/trial_user，不回退全员读权限
        trial_failed_count = await fail_qs.filter(fail_personal).count()
    else:
        trial_failed_count = await fail_qs.filter(fail_personal).count()

    upkeep_count = await _count_pending_audit_personal(
        HaoligoMoldMaintenanceSheet,
        tenant_id,
        uid,
        notify_field="submitted_notify_user_ids",
        has_approve=upkeep_approve,
        extra=Q(service_type="保养"),
    )
    repair_count = await _count_pending_audit_personal(
        HaoligoMoldMaintenanceSheet,
        tenant_id,
        uid,
        notify_field="submitted_notify_user_ids",
        has_approve=repair_approve,
        extra=Q(service_type="维修"),
    )
    outsource_maint_count = await _count_pending_audit_personal(
        HaoligoMoldOutsourceMaintenanceSheet,
        tenant_id,
        uid,
        notify_field="submitted_notify_user_ids",
        has_approve=outsource_maint_approve,
    )

    # 外协完修：审批队列（数据范围由 list 接口处理；此处个人 = 有 approve 看全部待审，或申请人自己）
    pending_audit_qs = tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id).filter(
        sheet_status=SHEET_STATUS_PENDING
    )
    if outsource_complete_approve:
        pending_audit_count = await pending_audit_qs.count()
    else:
        pending_audit_count = await pending_audit_qs.filter(applicant_user_id=uid).count()

    pending_mine_count = await (
        tenant_alive(HaoligoMoldOutsourceMaintenanceCompleteSheet, tenant_id)
        .filter(applicant_user_id=uid, sheet_status=SHEET_STATUS_PENDING)
        .count()
    )

    upkeep_open = await _count_open_for_complete_mold(
        tenant_id, uid, service_type="保养", has_complete=upkeep_complete
    )
    repair_open = await _count_open_for_complete_mold(
        tenant_id, uid, service_type="维修", has_complete=repair_complete
    )
    equip_open = await _count_equip_open_for_complete(tenant_id, uid, has_complete=equip_complete)

    hazard_count = 0
    if hazard_read:
        hazard_count = await (
            tenant_alive(HaoligoHazardReport, tenant_id)
            .filter(status="已登记")
            .filter(Q(responsible_user_id=uid) | _json_contains_user("report_notify_user_ids", uid))
            .count()
        )

    quality_issue = await _count_quality_handle(HaoligoQualityIssueTracking, tenant_id, uid)
    quality_complaint = await _count_quality_handle(HaoligoCustomerComplaint, tenant_id, uid)
    quality_line_stop = await _count_quality_handle(HaoligoLineStopFeedback, tenant_id, uid)

    # 同一设备完修计数只写一个 key，另一 key 保持一致但不在 sum 里双加（移动端 sum 只取其一）
    return {
        "trial": trial_count,
        "trial-failed": trial_failed_count,
        "upkeep": upkeep_count,
        "repair": repair_count,
        "outsource-maint": outsource_maint_count,
        "outsource-complete": pending_audit_count,
        "pending-audit": pending_audit_count,
        "pending-mine": pending_mine_count,
        "upkeep-complete": upkeep_open,
        "repair-complete": repair_open,
        "upkeep-sheet": equip_open,
        "equip-upkeep-complete": 0,  # 避免与 upkeep-sheet 双计；UI 仍可用 upkeep-sheet
        "hazard-list": hazard_count,
        "quality-issues-handle": quality_issue,
        "quality-complaints-handle": quality_complaint,
        "quality-line-stops-handle": quality_line_stop,
    }


def sum_personal_todo_badges(badges: dict[str, int]) -> int:
    """底栏合计：不双计设备完修。"""
    return (
        int(badges.get("trial") or 0)
        + int(badges.get("trial-failed") or 0)
        + int(badges.get("upkeep") or 0)
        + int(badges.get("repair") or 0)
        + int(badges.get("outsource-maint") or 0)
        + max(int(badges.get("outsource-complete") or 0), int(badges.get("pending-audit") or 0))
        + int(badges.get("upkeep-complete") or 0)
        + int(badges.get("repair-complete") or 0)
        + int(badges.get("upkeep-sheet") or 0)
        + int(badges.get("hazard-list") or 0)
        + int(badges.get("quality-issues-handle") or 0)
        + int(badges.get("quality-complaints-handle") or 0)
        + int(badges.get("quality-line-stops-handle") or 0)
    )
