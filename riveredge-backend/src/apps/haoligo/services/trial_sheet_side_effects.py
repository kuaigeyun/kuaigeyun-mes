"""好力 GO — 试模单保存后的不合格处理（消息、送修转仓）。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from loguru import logger

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED
from apps.haoligo.constants.mold_trial_failure_handling import (
    TRIAL_FAILURE_HANDLING_DISPATCHED,
    TRIAL_FAILURE_HANDLING_FORM_VALUES,
    TRIAL_FAILURE_HANDLING_PENDING,
    TRIAL_FAILURE_HANDLING_RECALLED,
    TRIAL_FAILURE_HANDLING_REPAIR,
)
from apps.haoligo.api._mold_sheet_audit import effective_sheet_status
from apps.haoligo.constants.mold_warehouse import (
    MOLD_WAREHOUSE_TYPE_EXTERNAL,
    MOLD_WAREHOUSE_TYPE_INTERNAL,
)
from apps.haoligo.constants.message_template_codes import (
    HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
    HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
)
from apps.haoligo.services.trial_message_templates import (
    TRIAL_DETAIL_PATH,
    ensure_haoligo_trial_message_templates,
)
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_trial_sheet import HaoligoMoldTrialSheet
from apps.haoligo.models.mold_warehouse import HaoligoMoldWarehouse
from apps.haoligo.services.spot_check_side_effects import normalize_report_user_ids, validate_report_notify_users
from apps.master_data.models.supplier import Supplier as MasterSupplier
from core.models.message_log import MessageLog
from core.models.message_template import MessageTemplate
from core.schemas.message_template import SendMessageRequest
from core.services.authorization.data_scope_constants import DIMENSION_SUPPLIER
from core.services.messaging.message_service import MessageService
from core.models.user_data_scope_binding import UserDataScopeBinding
from infra.models.user import User


def normalize_failure_handling(raw: Optional[str]) -> Optional[str]:
    """保存/创建时仅允许表单选项（待处理、立即送修）。"""
    s = (raw or "").strip()
    if not s:
        return None
    if s in (TRIAL_FAILURE_HANDLING_DISPATCHED, TRIAL_FAILURE_HANDLING_RECALLED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="「已发出」「已收回」由列表发出/收回操作维护，不可手工修改",
        )
    if s not in TRIAL_FAILURE_HANDLING_FORM_VALUES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"处理方式无效，须为：{'、'.join(TRIAL_FAILURE_HANDLING_FORM_VALUES)}",
        )
    return s


def _warehouse_matches_supplier(
    wh: HaoligoMoldWarehouse,
    sup: Optional[MasterSupplier],
    supplier_name: Optional[str],
) -> bool:
    if not sup:
        sn = (supplier_name or "").strip()
        wh_name = (wh.supplier_name or "").strip()
        return bool(sn and wh_name and wh_name == sn)
    wh_name = (wh.supplier_name or "").strip()
    wh_uuid = (wh.supplier_uuid or "").strip()
    sup_name = (sup.name or "").strip()
    sup_uuid = str(sup.uuid or "").strip()
    sup_code = (sup.code or "").strip()
    wh_code = (wh.supplier_code or "").strip()
    return bool(
        (wh_uuid and sup_uuid and wh_uuid == sup_uuid)
        or (wh_code and sup_code and wh_code == sup_code)
        or (wh_name and sup_name and wh_name == sup_name)
    )


async def resolve_supplier_external_warehouse_id(
    tenant_id: int,
    supplier_name: Optional[str],
) -> int:
    """解析试模单供应商对应的外部模具仓库（与立即送修选仓规则一致）。"""
    name = (supplier_name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="试模单缺少供应商，无法发出")
    sup = await resolve_supplier_by_name(tenant_id, name)
    rows = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(
        warehouse_type=MOLD_WAREHOUSE_TYPE_EXTERNAL,
    ).all()
    matched = [wh for wh in rows if _warehouse_matches_supplier(wh, sup, name)]
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"供应商「{name}」暂无外部模具仓库，请先在模具仓库中维护",
        )
    return int(matched[0].id)


async def resolve_supplier_by_name(tenant_id: int, supplier_name: Optional[str]) -> Optional[MasterSupplier]:
    name = (supplier_name or "").strip()
    if not name:
        return None
    row = await MasterSupplier.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        name=name,
    ).first()
    if row:
        return row
    return await MasterSupplier.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        name__icontains=name,
    ).first()


async def list_supplier_bound_user_ids(tenant_id: int, supplier_name: Optional[str]) -> List[int]:
    """供应商数据范围绑定用户 + 归属采购员。"""
    sup = await resolve_supplier_by_name(tenant_id, supplier_name)
    if not sup:
        return []
    code = (sup.code or "").strip()
    seen: set[int] = set()
    out: List[int] = []
    if sup.buyer_id and int(sup.buyer_id) > 0:
        seen.add(int(sup.buyer_id))
        out.append(int(sup.buyer_id))
    if code:
        bindings = await UserDataScopeBinding.filter(
            tenant_id=tenant_id,
            dimension=DIMENSION_SUPPLIER,
            scope_code=code,
            deleted_at__isnull=True,
        ).all()
        for b in bindings:
            uid = int(b.user_id)
            if uid > 0 and uid not in seen:
                seen.add(uid)
                out.append(uid)
    if not out:
        return []
    active = await User.filter(
        tenant_id=tenant_id,
        id__in=out,
        deleted_at__isnull=True,
        is_active=True,
    ).all()
    return [u.id for u in active]


def _merge_user_ids(*groups: List[int]) -> List[int]:
    seen: set[int] = set()
    out: List[int] = []
    for group in groups:
        for uid in group:
            if uid > 0 and uid not in seen:
                seen.add(uid)
                out.append(uid)
    return out


async def _user_ids_to_notify_preview(tenant_id: int, user_ids: List[int]) -> list[dict]:
    if not user_ids:
        return []
    users = await User.filter(
        tenant_id=tenant_id,
        id__in=user_ids,
        deleted_at__isnull=True,
    ).all()
    by_id = {u.id: u for u in users}
    items: list[dict] = []
    for uid in user_ids:
        u = by_id.get(uid)
        if not u:
            continue
        label = (u.full_name or "").strip() or (u.username or "").strip() or str(u.id)
        items.append({"id": u.id, "name": label})
    return items


async def list_supplier_notify_preview(tenant_id: int, supplier_name: Optional[str]) -> list[dict]:
    ids = await list_supplier_bound_user_ids(tenant_id, supplier_name)
    return await _user_ids_to_notify_preview(tenant_id, ids)


async def list_trial_repair_notify_preview(
    tenant_id: int,
    supplier_name: Optional[str],
    trial_user_id: Optional[int],
) -> list[dict]:
    trial_uid: List[int] = []
    if trial_user_id is not None and int(trial_user_id) > 0:
        trial_uid = [int(trial_user_id)]
    supplier_ids = await list_supplier_bound_user_ids(tenant_id, supplier_name)
    ids = _merge_user_ids(trial_uid, supplier_ids)
    return await _user_ids_to_notify_preview(tenant_id, ids)


def validate_failure_handling_payload(
    *,
    trial_result: str,
    failure_handling: Optional[str],
    pending_notify_user_ids: Optional[List[int]],
    repair_warehouse_id: Optional[int],
) -> tuple[Optional[str], List[int], Optional[int]]:
    if trial_result != "不合格":
        return None, [], None
    mode = normalize_failure_handling(failure_handling)
    if not mode:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="试模不合格时请选择处理方式")
    notify_ids = normalize_report_user_ids(pending_notify_user_ids)
    repair_id = repair_warehouse_id
    if mode == TRIAL_FAILURE_HANDLING_PENDING:
        if not notify_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="待处理时请至少指定一名消息提醒接收人",
            )
        return mode, notify_ids, None
    if mode == TRIAL_FAILURE_HANDLING_REPAIR:
        if repair_id is None or int(repair_id) < 1:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="立即送修请选择送修仓库")
        return mode, [], int(repair_id)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="处理方式无效")


async def _internal_warehouse_id_for_mold_location(
    tenant_id: int,
    mold_warehouse_id: Optional[int],
) -> Optional[int]:
    """仅当模具当前所在仓为内部仓时返回其 ID（用于记录发出/送修前的厂内归还点）。"""
    if mold_warehouse_id is None or int(mold_warehouse_id) < 1:
        return None
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=int(mold_warehouse_id)).first()
    if not wh or (wh.warehouse_type or "").strip() != MOLD_WAREHOUSE_TYPE_INTERNAL:
        return None
    return int(wh.id)


async def _validate_internal_recall_warehouse(
    tenant_id: int,
    warehouse_id: int,
) -> HaoligoMoldWarehouse:
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=int(warehouse_id)).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="收回目标仓库不存在")
    if (wh.warehouse_type or "").strip() != MOLD_WAREHOUSE_TYPE_INTERNAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="收回目标仓库须为内部（厂内）模具仓库",
        )
    return wh


async def _resolve_recall_target_warehouse_id(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    target_warehouse_id: Optional[int],
) -> int:
    """收回须转回厂内仓：显式传入 > 已记录的厂内原仓 > 首个内部模具仓库。"""
    if target_warehouse_id is not None and int(target_warehouse_id) > 0:
        await _validate_internal_recall_warehouse(tenant_id, int(target_warehouse_id))
        return int(target_warehouse_id)
    origin_id = row.dispatch_origin_warehouse_id
    if origin_id is not None and int(origin_id) > 0:
        await _validate_internal_recall_warehouse(tenant_id, int(origin_id))
        return int(origin_id)
    fallback = (
        await tenant_alive(HaoligoMoldWarehouse, tenant_id)
        .filter(warehouse_type=MOLD_WAREHOUSE_TYPE_INTERNAL)
        .order_by("id")
        .first()
    )
    if not fallback:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="未配置内部模具仓库，无法收回；请先在模具仓库中维护厂内仓",
        )
    return int(fallback.id)


async def _apply_mold_warehouse_by_id(
    row: HaoligoMold,
    *,
    tenant_id: int,
    warehouse_id: int,
) -> None:
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="送修仓库不存在")
    row.mold_warehouse_id = wh.id
    row.mold_warehouse_code = (wh.warehouse_code or "").strip()
    row.mold_warehouse_name = (wh.warehouse_name or "").strip()


async def _validate_repair_warehouse(
    tenant_id: int,
    warehouse_id: int,
    supplier_name: Optional[str],
) -> HaoligoMoldWarehouse:
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="送修仓库不存在")
    if (wh.warehouse_type or "").strip() != MOLD_WAREHOUSE_TYPE_EXTERNAL:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="送修仓库须为外部模具仓库")
    sup = await resolve_supplier_by_name(tenant_id, supplier_name)
    if not _warehouse_matches_supplier(wh, sup, supplier_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="送修仓库须关联当前试模单供应商",
        )
    return wh


async def transfer_mold_to_repair_warehouse(
    tenant_id: int,
    *,
    mold_code: Optional[str],
    repair_warehouse_id: int,
    supplier_name: Optional[str],
    trial_sheet: Optional[HaoligoMoldTrialSheet] = None,
) -> None:
    mc = (mold_code or "").strip()
    if not mc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="立即送修需要有效的模具代号")
    await _validate_repair_warehouse(tenant_id, repair_warehouse_id, supplier_name)
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"未找到模具代号「{mc}」")
    if trial_sheet is not None and getattr(trial_sheet, "dispatch_origin_warehouse_id", None) is None:
        origin_id = await _internal_warehouse_id_for_mold_location(tenant_id, mold.mold_warehouse_id)
        trial_sheet.dispatch_origin_warehouse_id = origin_id
        await trial_sheet.save(update_fields=["dispatch_origin_warehouse_id", "updated_at"])
    await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=repair_warehouse_id)
    await mold.save()


async def _resolve_repair_warehouse_name(
    tenant_id: int,
    repair_warehouse_id: Optional[int],
) -> str:
    if repair_warehouse_id is None or int(repair_warehouse_id) < 1:
        return "—"
    wh = await tenant_alive(HaoligoMoldWarehouse, tenant_id).filter(id=int(repair_warehouse_id)).first()
    if not wh:
        return "—"
    name = (wh.warehouse_name or "").strip()
    code = (wh.warehouse_code or "").strip()
    if name and code:
        return f"{code} · {name}"
    return name or code or str(wh.id)


async def _trial_message_already_sent(
    tenant_id: int,
    trial_sheet_id: int,
    template_code: str,
) -> bool:
    sid = str(trial_sheet_id)
    template = await MessageTemplate.filter(
        tenant_id=tenant_id,
        code=template_code,
        deleted_at__isnull=True,
    ).first()
    if not template:
        return False
    rows = await MessageLog.filter(
        tenant_id=tenant_id,
        type="internal",
        status="success",
        template_uuid=str(template.uuid),
        deleted_at__isnull=True,
    ).order_by("-id").limit(200)
    for row in rows:
        vars_ = row.variables or {}
        if str(vars_.get("trial_sheet_id", "")) == sid:
            return True
    return False


async def _trial_failure_message_variables(
    row: HaoligoMoldTrialSheet,
    *,
    repair_warehouse_name: str = "—",
) -> dict[str, str]:
    times = row.trial_times
    mode = (row.failure_handling or "").strip() or "—"
    return {
        "sheet_no": (row.sheet_no or "").strip() or f"#{row.id}",
        "purchase_order_no": (row.purchase_order_no or "").strip() or "—",
        "mold_code": (row.mold_code or "").strip() or "—",
        "mold_name": (row.mold_name or "").strip() or "—",
        "supplier_name": (row.supplier_name or "").strip() or "—",
        "trial_user_name": (row.trial_user_name or "").strip() or "—",
        "trial_times": str(times) if times is not None else "—",
        "failure_handling": mode,
        "repair_warehouse_name": repair_warehouse_name,
        "trial_sheet_id": str(row.id),
        "detail_path": TRIAL_DETAIL_PATH,
    }


async def _send_trial_failure_messages(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    template_code: str,
    recipient_ids: List[int],
    repair_warehouse_name: str = "—",
) -> None:
    if not recipient_ids:
        return
    await validate_report_notify_users(tenant_id, recipient_ids)
    await ensure_haoligo_trial_message_templates(tenant_id)
    variables = await _trial_failure_message_variables(
        row,
        repair_warehouse_name=repair_warehouse_name,
    )
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
                    "试模不合格站内信未成功 tenant={} sheet={} template={} user={} err={}",
                    tenant_id,
                    row.id,
                    template_code,
                    uid,
                    result.error,
                )
        except Exception as e:
            logger.error(
                "试模不合格站内信发送失败 tenant={} sheet={} template={} user={}: {}",
                tenant_id,
                row.id,
                template_code,
                uid,
                e,
            )


async def list_trial_repair_notify_recipient_ids(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
) -> List[int]:
    """立即送修：试模人员 + 供应商绑定用户。"""
    supplier_ids = await list_supplier_bound_user_ids(tenant_id, row.supplier_name)
    trial_uid: List[int] = []
    if row.trial_user_id and int(row.trial_user_id) > 0:
        trial_uid = [int(row.trial_user_id)]
    return _merge_user_ids(trial_uid, supplier_ids)


async def send_trial_failure_pending_messages(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
) -> None:
    designated = normalize_report_user_ids(row.pending_notify_user_ids)
    supplier_ids = await list_supplier_bound_user_ids(tenant_id, row.supplier_name)
    recipients = _merge_user_ids(designated, supplier_ids)
    await _send_trial_failure_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
        recipient_ids=recipients,
    )


async def send_trial_failure_repair_messages(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
) -> None:
    recipients = await list_trial_repair_notify_recipient_ids(tenant_id, row)
    repair_name = await _resolve_repair_warehouse_name(tenant_id, row.repair_warehouse_id)
    await _send_trial_failure_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
        recipient_ids=recipients,
        repair_warehouse_name=repair_name,
    )


async def persist_mold_trial_pending_notify_memory(
    tenant_id: int,
    mold_code: Optional[str],
    pending_notify_user_ids: Optional[List[int]],
) -> None:
    """试模待处理保存成功后，将提醒人员记忆到模具台账。"""
    mc = (mold_code or "").strip()
    ids = normalize_report_user_ids(pending_notify_user_ids)
    if not mc or not ids:
        return
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        return
    mold.trial_pending_notify_user_ids = ids
    await mold.save(update_fields=["trial_pending_notify_user_ids", "updated_at"])


async def dispatch_trial_pending_sheet(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    target_warehouse_id: int,
) -> None:
    """待处理 → 已发出：记录原仓库，模具转入指定供应商外部仓。"""
    if (row.trial_result or "").strip() != "不合格":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅试模不合格单据可发出")
    if (row.failure_handling or "").strip() != TRIAL_FAILURE_HANDLING_PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅处理方式为「待处理」时可发出")
    if effective_sheet_status(row) != SHEET_STATUS_APPROVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅审核通过的单据可发出")
    mc = (row.mold_code or "").strip()
    if not mc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="发出需要有效的模具代号")
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"未找到模具代号「{mc}」")
    wh_id = int(target_warehouse_id)
    if wh_id < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请选择接收仓库")
    await _validate_repair_warehouse(tenant_id, wh_id, row.supplier_name)
    row.dispatch_origin_warehouse_id = await _internal_warehouse_id_for_mold_location(
        tenant_id, mold.mold_warehouse_id
    )
    row.repair_warehouse_id = wh_id
    await transfer_mold_to_repair_warehouse(
        tenant_id,
        mold_code=mc,
        repair_warehouse_id=wh_id,
        supplier_name=row.supplier_name,
    )
    row.failure_handling = TRIAL_FAILURE_HANDLING_DISPATCHED
    await row.save()


async def recall_trial_failure_sheet(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    target_warehouse_id: Optional[int] = None,
) -> None:
    """已发出 / 立即送修 → 已收回：模具转回指定仓库（默认转外前仓库），本单结束。"""
    mode = (row.failure_handling or "").strip()
    if mode not in (TRIAL_FAILURE_HANDLING_DISPATCHED, TRIAL_FAILURE_HANDLING_REPAIR):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅处理方式为「已发出」或「立即送修」时可收回",
        )
    if effective_sheet_status(row) != SHEET_STATUS_APPROVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅审核通过的单据可收回")
    mc = (row.mold_code or "").strip()
    if not mc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="收回需要有效的模具代号")
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"未找到模具代号「{mc}」")
    wh_id = await _resolve_recall_target_warehouse_id(tenant_id, row, target_warehouse_id)
    await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=wh_id)
    await mold.save(
        update_fields=["mold_warehouse_id", "mold_warehouse_code", "mold_warehouse_name", "updated_at"]
    )
    row.failure_handling = TRIAL_FAILURE_HANDLING_RECALLED
    row.repair_warehouse_id = None
    await row.save()


async def create_replacement_trial_sheet_after_recall(
    tenant_id: int,
    *,
    source_row: HaoligoMoldTrialSheet,
    operator_user_id: int,
    resolve_applicant,
    resolve_next_trial_times,
    generate_sheet_no,
    sheet_no_rule_code: str,
) -> HaoligoMoldTrialSheet:
    """收回后生成下一试模单（待审核，试模结果待填）。"""
    from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_PENDING

    sheet_no = await generate_sheet_no(tenant_id, sheet_no_rule_code)
    mold_code = (source_row.mold_code or "").strip() or None
    trial_times = await resolve_next_trial_times(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=source_row.purchase_order_no,
    )
    trial_uid = source_row.trial_user_id if source_row.trial_user_id else operator_user_id
    trial_uid, trial_uname = await resolve_applicant(tenant_id, int(trial_uid))
    return await HaoligoMoldTrialSheet.create(
        tenant_id=tenant_id,
        sheet_no=sheet_no,
        purchase_order_no=source_row.purchase_order_no,
        supplier_name=source_row.supplier_name,
        supplier_code=getattr(source_row, "supplier_code", None),
        mold_code=mold_code,
        mold_name=(source_row.mold_name or "").strip() or None,
        trial_times=trial_times,
        trial_user_id=trial_uid,
        trial_user_name=trial_uname,
        failure_handling=None,
        pending_notify_user_ids=[],
        repair_warehouse_id=None,
        dispatch_origin_warehouse_id=None,
        result_attachment_file_uuids=[],
        inspection_attachment_file_uuids=[],
        trial_result="合格",
        sheet_status=SHEET_STATUS_PENDING,
    )


async def apply_trial_failure_after_save(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    send_notify: bool,
    allow_repeat_notify: bool = False,
) -> None:
    if (row.trial_result or "").strip() != "不合格":
        return
    mode = (row.failure_handling or "").strip()
    if mode == TRIAL_FAILURE_HANDLING_REPAIR and row.repair_warehouse_id:
        await transfer_mold_to_repair_warehouse(
            tenant_id,
            mold_code=row.mold_code,
            repair_warehouse_id=int(row.repair_warehouse_id),
            supplier_name=row.supplier_name,
            trial_sheet=row,
        )
        if send_notify:
            if not allow_repeat_notify and await _trial_message_already_sent(
                tenant_id, row.id, HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR
            ):
                return
            await send_trial_failure_repair_messages(tenant_id, row)
    elif mode == TRIAL_FAILURE_HANDLING_PENDING:
        await persist_mold_trial_pending_notify_memory(
            tenant_id,
            row.mold_code,
            row.pending_notify_user_ids,
        )
        if send_notify:
            if not allow_repeat_notify and await _trial_message_already_sent(
                tenant_id, row.id, HAOLIGO_MOLD_TRIAL_FAILURE_PENDING
            ):
                return
            await send_trial_failure_pending_messages(tenant_id, row)
