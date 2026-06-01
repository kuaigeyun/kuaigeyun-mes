"""好力 GO — 外协维保单站内信。"""

from __future__ import annotations

from typing import List

from loguru import logger

from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
    HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
)
from apps.haoligo.models.mold_outsource_maintenance_sheet import HaoligoMoldOutsourceMaintenanceSheet
from apps.haoligo.services.outsource_maintenance_message_templates import (
    OUTSOURCE_MAINTENANCE_DETAIL_PATH,
    ensure_haoligo_outsource_maintenance_message_templates,
)
from apps.haoligo.services.spot_check_side_effects import validate_report_notify_users
from apps.haoligo.services.trial_sheet_side_effects import list_supplier_bound_user_ids
from core.schemas.message_template import SendMessageRequest
from core.services.messaging.message_service import MessageService


def _merge_user_ids(*groups: List[int]) -> List[int]:
    seen: set[int] = set()
    out: List[int] = []
    for group in groups:
        for uid in group:
            i = int(uid)
            if i < 1 or i in seen:
                continue
            seen.add(i)
            out.append(i)
    return out


def _message_variables(row: HaoligoMoldOutsourceMaintenanceSheet) -> dict[str, str]:
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "outsourced_unit_name": (row.outsourced_unit_name or "").strip() or "—",
        "applicant_name": (row.applicant_name or "").strip() or "—",
        "service_type": (row.service_type or "").strip() or "—",
        "outsource_maintenance_sheet_id": str(row.id),
        "detail_path": OUTSOURCE_MAINTENANCE_DETAIL_PATH,
    }


async def _send_outsource_maintenance_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
    *,
    template_code: str,
    recipient_ids: List[int],
) -> None:
    if not recipient_ids:
        return
    await validate_report_notify_users(tenant_id, recipient_ids)
    await ensure_haoligo_outsource_maintenance_message_templates(tenant_id)
    variables = _message_variables(row)
    for uid in recipient_ids:
        try:
            result = await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=str(uid),
                    template_code=template_code,
                    variables=variables,
                    content="",
                ),
            )
            if not result.success:
                logger.error(
                    "外协维保单站内信未成功 tenant={} sheet={} template={} user={} err={}",
                    tenant_id,
                    row.id,
                    template_code,
                    uid,
                    result.error,
                )
        except Exception as e:
            logger.error(
                "外协维保单站内信发送失败 tenant={} sheet={} template={} user={}: {}",
                tenant_id,
                row.id,
                template_code,
                uid,
                e,
            )


async def send_outsource_maintenance_pending_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    supplier_ids = await list_supplier_bound_user_ids(tenant_id, row.outsourced_unit_name)
    await _send_outsource_maintenance_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_PENDING,
        recipient_ids=supplier_ids,
    )


async def send_outsource_maintenance_approved_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    applicant_ids: List[int] = []
    if row.applicant_user_id and int(row.applicant_user_id) > 0:
        applicant_ids = [int(row.applicant_user_id)]
    supplier_ids = await list_supplier_bound_user_ids(tenant_id, row.outsourced_unit_name)
    recipients = _merge_user_ids(applicant_ids, supplier_ids)
    await _send_outsource_maintenance_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_APPROVED,
        recipient_ids=recipients,
    )


async def send_outsource_maintenance_rejected_messages(
    tenant_id: int,
    row: HaoligoMoldOutsourceMaintenanceSheet,
) -> None:
    if not row.applicant_user_id or int(row.applicant_user_id) < 1:
        return
    await _send_outsource_maintenance_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_REJECTED,
        recipient_ids=[int(row.applicant_user_id)],
    )
