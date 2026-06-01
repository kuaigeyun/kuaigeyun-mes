"""好力 GO — 试模单保存后的不合格处理（消息、送修转仓）。"""

from __future__ import annotations

from typing import List, Optional

from fastapi import HTTPException, status
from loguru import logger

from apps.haoligo.api._qs import tenant_alive
from apps.haoligo.constants.mold_sheet_audit import SHEET_STATUS_APPROVED
from apps.haoligo.constants.mold_trial_workflow_phase import (
    WORKFLOW_PHASE_CLOSED,
    WORKFLOW_PHASE_TRIAL,
    WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION,
)
from apps.haoligo.constants.mold_status import MOLD_LEDGER_STATUS_SET
from apps.haoligo.constants.mold_trial_failure_handling import (
    TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
    TRIAL_FAILURE_HANDLING_DISPATCHED,
    TRIAL_FAILURE_HANDLING_FORM_VALUES,
    TRIAL_FAILURE_HANDLING_IN_PROGRESS,
    TRIAL_FAILURE_HANDLING_PENDING,
    TRIAL_FAILURE_HANDLING_RECALLED,
    TRIAL_FAILURE_HANDLING_REPAIR,
    TRIAL_FAILURE_HANDLING_VENDOR_ADJUSTABLE,
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
    if s in (
        TRIAL_FAILURE_HANDLING_DISPATCHED,
        TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
        TRIAL_FAILURE_HANDLING_RECALLED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="「已发出」「调整完成」「已收回」由列表操作维护，不可手工修改",
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
    allow_pending: bool = True,
    unqualified_label: str = "试模",
) -> tuple[Optional[str], List[int], Optional[int]]:
    if trial_result != "不合格":
        return None, [], None
    mode = normalize_failure_handling(failure_handling)
    if not mode:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{unqualified_label}不合格时请选择处理方式",
        )
    if not allow_pending and mode == TRIAL_FAILURE_HANDLING_PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{unqualified_label}不合格仅支持「立即送修」",
        )
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
    await _send_trial_failure_messages(
        tenant_id,
        row,
        template_code=HAOLIGO_MOLD_TRIAL_FAILURE_PENDING,
        recipient_ids=designated,
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


def _effective_unqualified_result(row: HaoligoMoldTrialSheet) -> str:
    """试产阶段不合格以试产结果为准，试模阶段以试模结果为准。"""
    phase = (getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip()
    prod = (getattr(row, "production_trial_result", None) or "").strip()
    if phase in (WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION, WORKFLOW_PHASE_CLOSED) and prod:
        return prod
    return (row.trial_result or "").strip()


def is_trial_failure_flow_in_progress(failure_handling: Optional[str]) -> bool:
    """不合格处理方式处于发出/送修/调整完成等进行中（未确认收回）。"""
    return (failure_handling or "").strip() in TRIAL_FAILURE_HANDLING_IN_PROGRESS


def is_mold_trial_process_incomplete(row: HaoligoMoldTrialSheet) -> bool:
    """试模/试产流程未结案，或不合格后尚未确认收回。"""
    if is_trial_failure_flow_in_progress(row.failure_handling):
        return True
    phase = (getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip()
    return phase != WORKFLOW_PHASE_CLOSED


async def find_incomplete_mold_trial_sheet(
    tenant_id: int,
    *,
    mold_code: str | None,
    purchase_order_no: str | None,
) -> HaoligoMoldTrialSheet | None:
    mc = (mold_code or "").strip()
    if mc:
        qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(mold_code=mc)
    else:
        po = (purchase_order_no or "").strip()
        if not po:
            return None
        qs = tenant_alive(HaoligoMoldTrialSheet, tenant_id).filter(purchase_order_no=po)
    rows = await qs.order_by("-id")
    for row in rows:
        if is_mold_trial_process_incomplete(row):
            return row
    return None


async def assert_mold_trial_process_can_start_new_sheet(
    tenant_id: int,
    *,
    mold_code: str | None,
    purchase_order_no: str | None,
) -> None:
    blocking = await find_incomplete_mold_trial_sheet(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=purchase_order_no,
    )
    if not blocking:
        return
    sheet_label = (blocking.sheet_no or "").strip() or f"#{blocking.id}"
    mc = (mold_code or "").strip() or (blocking.mold_code or "").strip()
    if mc:
        detail = (
            f"模具代号「{mc}」仍有未完结的试模流程（试模单 {sheet_label}），"
            "请先完成试模/试产及发出收回等环节后再新建"
        )
    else:
        po = (purchase_order_no or "").strip() or (blocking.purchase_order_no or "").strip()
        detail = (
            f"采购订单「{po}」仍有未完结的试模流程（试模单 {sheet_label}），"
            "请先完成当前试模流程后再新建"
        )
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


async def list_incomplete_trial_mold_blocks(tenant_id: int) -> List[dict]:
    """按模具代号汇总未完结试模单（每个代号取最近一条阻塞单）。"""
    rows = await tenant_alive(HaoligoMoldTrialSheet, tenant_id).order_by("-id")
    seen: set[str] = set()
    items: List[dict] = []
    for row in rows:
        if not is_mold_trial_process_incomplete(row):
            continue
        mc = (row.mold_code or "").strip()
        if not mc or mc in seen:
            continue
        seen.add(mc)
        items.append(
            {
                "mold_code": mc,
                "blocking_sheet_no": (row.sheet_no or "").strip() or None,
                "blocking_sheet_id": int(row.id),
            }
        )
    return items


async def mold_trial_create_availability(
    tenant_id: int,
    *,
    mold_code: str | None,
    purchase_order_no: str | None,
) -> tuple[bool, Optional[str]]:
    blocking = await find_incomplete_mold_trial_sheet(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=purchase_order_no,
    )
    if not blocking:
        return True, None
    label = (blocking.sheet_no or "").strip() or None
    return False, label


async def set_mold_ledger_status_ready(tenant_id: int, mold_code: Optional[str]) -> None:
    mc = (mold_code or "").strip()
    if not mc:
        return
    mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
    if not mold:
        return
    if "待用" not in MOLD_LEDGER_STATUS_SET:
        return
    mold.status = "待用"
    await mold.save(update_fields=["status", "updated_at"])


async def dispatch_trial_pending_sheet(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    target_warehouse_id: int,
) -> None:
    """待处理 → 已发出：记录原仓库，模具转入指定供应商外部仓。"""
    if _effective_unqualified_result(row) != "不合格":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅试产不合格且待处理的单据可发出")
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
    repair_name = await _resolve_repair_warehouse_name(tenant_id, row.repair_warehouse_id)
    if not await _trial_message_already_sent(tenant_id, row.id, HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR):
        recipients = await list_trial_repair_notify_recipient_ids(tenant_id, row)
        await _send_trial_failure_messages(
            tenant_id,
            row,
            template_code=HAOLIGO_MOLD_TRIAL_FAILURE_REPAIR,
            recipient_ids=recipients,
            repair_warehouse_name=repair_name,
        )


async def mark_trial_adjustment_complete(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
) -> None:
    """确认维修/调整已完成（立即送修或已发出；模具仍在外部仓，待本公司到厂后确认收回）。"""
    if _effective_unqualified_result(row) != "不合格":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅不合格试模/试产单可确认调整完成")
    if effective_sheet_status(row) != SHEET_STATUS_APPROVED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="仅审核通过的单据可确认调整完成")
    mode = (row.failure_handling or "").strip()
    if mode not in TRIAL_FAILURE_HANDLING_VENDOR_ADJUSTABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="仅「已发出」或「立即送修」状态可确认调整完成",
        )
    row.failure_handling = TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE
    await row.save(update_fields=["failure_handling", "updated_at"])


async def recall_trial_failure_sheet(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    target_warehouse_id: Optional[int] = None,
) -> None:
    """调整完成 → 已收回：模具到厂后转回厂内仓，本单结束。"""
    mode = (row.failure_handling or "").strip()
    if mode != TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请待外协厂商确认调整完成后再确认收回",
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
    row.workflow_phase = WORKFLOW_PHASE_CLOSED
    await row.save(update_fields=["failure_handling", "repair_warehouse_id", "workflow_phase", "updated_at"])


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
    await assert_mold_trial_process_can_start_new_sheet(
        tenant_id,
        mold_code=mold_code,
        purchase_order_no=source_row.purchase_order_no,
    )
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
        workflow_phase=WORKFLOW_PHASE_TRIAL,
        production_trial_result=None,
        production_trial_user_id=None,
        production_trial_user_name=None,
        sheet_status=SHEET_STATUS_PENDING,
    )


async def apply_production_trial_failure_after_save(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    send_notify: bool,
    allow_repeat_notify: bool = False,
) -> None:
    if (row.production_trial_result or "").strip() != "不合格":
        return
    await apply_trial_failure_after_save(
        tenant_id,
        row,
        send_notify=send_notify,
        allow_repeat_notify=allow_repeat_notify,
        result_field="production",
    )


async def apply_trial_failure_after_save(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
    *,
    send_notify: bool,
    allow_repeat_notify: bool = False,
    result_field: str = "trial",
) -> None:
    if result_field == "production":
        unqualified = (row.production_trial_result or "").strip() != "不合格"
    else:
        unqualified = (row.trial_result or "").strip() != "不合格"
    if unqualified:
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


async def revert_trial_failure_side_effects_on_revoke(
    tenant_id: int,
    row: HaoligoMoldTrialSheet,
) -> None:
    """撤销审核：回滚不合格试模/试产的转仓与流程终态，恢复为待主管再审前的业务态。"""
    if _effective_unqualified_result(row) != "不合格":
        phase = (getattr(row, "workflow_phase", None) or WORKFLOW_PHASE_TRIAL).strip()
        if phase == WORKFLOW_PHASE_CLOSED:
            pr = (getattr(row, "production_trial_result", None) or "").strip()
            if pr == "合格":
                row.workflow_phase = WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION
        return

    mode = (row.failure_handling or "").strip()
    if mode == TRIAL_FAILURE_HANDLING_RECALLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="处理方式为「已收回」的试模单不可撤销审核",
        )

    if mode in (
        TRIAL_FAILURE_HANDLING_REPAIR,
        TRIAL_FAILURE_HANDLING_DISPATCHED,
        TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE,
    ):
        mc = (row.mold_code or "").strip()
        if not mc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="撤销审核失败：缺少模具代号")
        mold = await tenant_alive(HaoligoMold, tenant_id).filter(mold_code=mc).first()
        if not mold:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"未找到模具代号「{mc}」")
        if mode == TRIAL_FAILURE_HANDLING_ADJUSTMENT_DONE:
            row.failure_handling = (
                TRIAL_FAILURE_HANDLING_DISPATCHED
                if row.dispatch_origin_warehouse_id
                else TRIAL_FAILURE_HANDLING_REPAIR
            )
        else:
            wh_id = await _resolve_recall_target_warehouse_id(tenant_id, row, None)
            await _apply_mold_warehouse_by_id(mold, tenant_id=tenant_id, warehouse_id=wh_id)
            await mold.save(
                update_fields=["mold_warehouse_id", "mold_warehouse_code", "mold_warehouse_name", "updated_at"]
            )
            row.dispatch_origin_warehouse_id = None

    if mode == TRIAL_FAILURE_HANDLING_DISPATCHED:
        row.failure_handling = TRIAL_FAILURE_HANDLING_PENDING
        row.repair_warehouse_id = None
    elif mode == TRIAL_FAILURE_HANDLING_REPAIR:
        row.failure_handling = TRIAL_FAILURE_HANDLING_REPAIR

    tr = (row.trial_result or "").strip()
    pr = (getattr(row, "production_trial_result", None) or "").strip()
    if tr == "不合格":
        row.workflow_phase = WORKFLOW_PHASE_TRIAL
    elif pr == "不合格":
        row.workflow_phase = WORKFLOW_PHASE_TRIAL_PASS_PENDING_PRODUCTION
    else:
        row.workflow_phase = WORKFLOW_PHASE_TRIAL
