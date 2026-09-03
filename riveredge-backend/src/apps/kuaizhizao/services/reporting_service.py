"""
报工业务服务模块

提供报工记录相关的业务逻辑处理，包括报工、审核等。

Author: Luigi Lu
Date: 2025-01-01
"""

import uuid
import math
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from core.utils.timezone_utils import (
    coerce_business_datetime_to_utc,
    resolve_business_datetime,
    today_site_str,
    to_api_isoformat,
)

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.services.work_order_inbound_bom_role import is_semi_finished_product_by_bom_role
from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.schemas.rework_order import ReworkOrderCreate
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse,
    ReportingPullCandidateItem,
    ReportingPullCandidateListResponse,
)
from apps.kuaizhizao.services.document_action_policy.reporting_record import (
    assert_reporting_record_capability,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_reporting_record_capabilities_on_response,
    enrich_reporting_record_list_capabilities,
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordResponse
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from infra.models.user import User


def _sync_operation_assigned_producer_from_reporting(
    work_order_operation: WorkOrderOperation,
    *,
    worker_id: Optional[int],
    worker_name: Optional[str],
    team_id: Optional[int],
    team_name: Optional[str],
) -> None:
    """报工所选生产人员回写工序派工，使工序卡人员与本次报工一致。"""
    if team_id is not None:
        work_order_operation.assigned_team_id = int(team_id)
        work_order_operation.assigned_team_name = (team_name or "").strip() or None
        work_order_operation.assigned_worker_id = None
        work_order_operation.assigned_worker_name = None
        work_order_operation.assigned_worker_ids = []
        return
    if worker_id is not None:
        wid = int(worker_id)
        name = (worker_name or "").strip() or None
        work_order_operation.assigned_worker_id = wid
        work_order_operation.assigned_worker_name = name
        work_order_operation.assigned_worker_ids = [wid]
        work_order_operation.assigned_team_id = None
        work_order_operation.assigned_team_name = None


async def _resolve_work_order_operation_for_reporting(
    tenant_id: int,
    work_order_id: int,
    operation_id: int,
) -> Optional[WorkOrderOperation]:
    """
    解析报工目标工单工序行。

    operation_id 与报工 payload 一致：优先主数据工序 ID；兼容误传工单工序行主键。
    须排除软删除行，否则历史重复行会导致 get_or_none 抛出 MultipleObjectsReturned。
    """
    base = WorkOrderOperation.filter(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        deleted_at__isnull=True,
    )
    woo = await base.filter(operation_id=operation_id).order_by("-id").first()
    if woo:
        return woo
    return await base.filter(id=operation_id).order_by("-id").first()


async def _effective_completion_quantity(
    tenant_id: int,
    work_order_id: int,
    work_order_operation: WorkOrderOperation,
) -> Decimal:
    """
    工序完成判定用数量：
    - none/simple：报工累计合格
    - plan：过程检验放行后的可转下道合格（未检完不得算完成）
    """
    from apps.kuaizhizao.services.operation_transfer_service import (
        resolve_operation_transfer_qualified,
    )

    return await resolve_operation_transfer_qualified(
        tenant_id, work_order_id, work_order_operation
    )


async def _plan_quantity_reached(
    tenant_id: int,
    work_order: WorkOrder,
    work_order_operation: WorkOrderOperation,
) -> bool:
    """工序有效合格产出是否已达工单计划数量。"""
    plan = Decimal(str(work_order.quantity or 0))
    if plan <= 0:
        return False
    effective = await _effective_completion_quantity(
        tenant_id, int(work_order.id), work_order_operation
    )
    return effective >= plan


async def _maybe_mark_operation_completed(
    tenant_id: int,
    work_order: WorkOrder,
    work_order_operation: WorkOrderOperation,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """
    有效合格产量达标即将工序置为 completed。

    方案质检须检验放行后才达标；超报上限仅约束继续报工。
    """
    if work_order_operation.status == "completed":
        return False
    if not await _plan_quantity_reached(tenant_id, work_order, work_order_operation):
        return False
    work_order_operation.status = "completed"
    work_order_operation.actual_end_date = (
        work_order_operation.actual_end_date or now or resolve_business_datetime()
    )
    return True


async def _reconcile_operation_completion_status(
    tenant_id: int,
    work_order: WorkOrder,
    work_order_operation: WorkOrderOperation,
) -> bool:
    """
    按数量报工时，有效合格未达标却为 completed 的工序回退为进行中
    （含方案质检已报未检被误标完成的历史数据）。
    """
    reporting_type = work_order_operation.reporting_type or "quantity"
    if reporting_type != "quantity":
        return False
    if work_order_operation.status != "completed":
        return False
    plan = Decimal(str(work_order.quantity or 0))
    if plan <= 0:
        return False
    if await _plan_quantity_reached(tenant_id, work_order, work_order_operation):
        return False
    work_order_operation.status = "in_progress"
    work_order_operation.actual_end_date = None
    return True


async def _sync_operation_completion_status(
    tenant_id: int,
    work_order: WorkOrder,
    work_order_operation: WorkOrderOperation,
    *,
    now: Optional[datetime] = None,
) -> bool:
    """校正并完成工序状态；返回 status 是否变更。"""
    if await _reconcile_operation_completion_status(
        tenant_id, work_order, work_order_operation
    ):
        return True
    return await _maybe_mark_operation_completed(
        tenant_id, work_order, work_order_operation, now=now
    )


def _operation_assignee_user_ids(operation: WorkOrderOperation) -> List[int]:
    """工单工序指派人（多人派工优先，兼容主责字段）。"""
    out: List[int] = []
    raw_ids = getattr(operation, "assigned_worker_ids", None) or []
    if isinstance(raw_ids, list):
        for item in raw_ids:
            try:
                uid = int(item)
            except (TypeError, ValueError):
                continue
            if uid > 0 and uid not in out:
                out.append(uid)
    if not out:
        primary = getattr(operation, "assigned_worker_id", None)
        if primary is not None:
            try:
                uid = int(primary)
            except (TypeError, ValueError):
                uid = 0
            if uid > 0:
                out.append(uid)
    return out


async def _find_next_work_order_operation(
    tenant_id: int,
    work_order_id: int,
    current: WorkOrderOperation,
    *,
    operations: Optional[List[WorkOrderOperation]] = None,
) -> Optional[WorkOrderOperation]:
    """按 sequence / id 取当前工序之后的下一道工序。"""
    ops = operations
    if ops is None:
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
    current_key = (int(current.sequence or 0), int(current.id or 0))
    later = [
        op
        for op in ops
        if op.id != current.id
        and (int(op.sequence or 0), int(op.id or 0)) > current_key
    ]
    if not later:
        return None
    return min(later, key=lambda op: (int(op.sequence or 0), int(op.id or 0)))


async def notify_next_operation_assignees_after_completed(
    tenant_id: int,
    work_order: WorkOrder,
    completed_operation: WorkOrderOperation,
    *,
    operations: Optional[List[WorkOrderOperation]] = None,
) -> int:
    """
    当前工序刚变为 completed 时，向下一工序指派人发送站内信。
    无下一工序或未派工时返回 0。
    """
    next_op = await _find_next_work_order_operation(
        tenant_id,
        int(work_order.id),
        completed_operation,
        operations=operations,
    )
    if not next_op:
        return 0
    assignee_ids = _operation_assignee_user_ids(next_op)
    if not assignee_ids:
        logger.info(
            "工序完成但下一工序未指派人员，跳过提醒 tenant={} wo={} next_op={}",
            tenant_id,
            work_order.id,
            next_op.id,
        )
        return 0

    from apps.kuaizhizao.services.kuaizhizao_business_notification import (
        notify_work_order_next_operation,
    )

    try:
        return await notify_work_order_next_operation(
            tenant_id,
            work_order_id=int(work_order.id),
            work_order_code=work_order.code or str(work_order.id),
            product_name=work_order.product_name or "—",
            completed_operation_name=(
                completed_operation.operation_name
                or completed_operation.operation_code
                or "—"
            ),
            next_operation_name=(
                next_op.operation_name or next_op.operation_code or "—"
            ),
            next_operation_assignee_user_ids=assignee_ids,
            creator_user_id=work_order.created_by,
        )
    except Exception as exc:
        logger.warning(
            "工序完成通知下一工序失败 tenant={} wo={} op={}: {}",
            tenant_id,
            work_order.id,
            completed_operation.id,
            exc,
        )
        return 0


async def sync_work_order_operations_completion(
    tenant_id: int,
    work_order_id: int,
) -> None:
    """按有效合格口径重算工序/工单完成态（报工、过程检验后调用）。"""
    work_order = await WorkOrder.get_or_none(
        id=work_order_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not work_order:
        return

    operations = await WorkOrderOperation.filter(
        tenant_id=tenant_id,
        work_order_id=work_order_id,
        deleted_at__isnull=True,
    ).all()
    status_changed = False
    newly_completed: List[WorkOrderOperation] = []
    for op in operations:
        was_completed = op.status == "completed"
        if await _sync_operation_completion_status(tenant_id, work_order, op):
            await op.save()
            status_changed = True
            if not was_completed and op.status == "completed":
                newly_completed.append(op)
    for completed_op in newly_completed:
        await notify_next_operation_assignees_after_completed(
            tenant_id,
            work_order,
            completed_op,
            operations=operations,
        )
    if not status_changed and not operations:
        return

    all_completed = bool(operations) and all(op.status == "completed" for op in operations)
    if all_completed and work_order.status != "completed":
        work_order.status = "completed"
        work_order.actual_end_date = work_order.actual_end_date or resolve_business_datetime()
        await work_order.save()
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            notify_work_order_completed,
        )

        try:
            await notify_work_order_completed(
                tenant_id,
                work_order_id=work_order_id,
                work_order_code=work_order.code or str(work_order_id),
                product_name=work_order.product_name or "—",
                completed_quantity=str(work_order.completed_quantity or work_order.quantity or 0),
                creator_user_id=work_order.created_by,
            )
        except Exception as exc:
            logger.warning(
                "工单完工消息提醒失败 tenant={} wo={}: {}",
                tenant_id,
                work_order_id,
                exc,
            )
    elif (
        not all_completed
        and work_order.status == "completed"
        and not getattr(work_order, "manually_completed", False)
    ):
        work_order.status = "in_progress"
        work_order.actual_end_date = None
        await work_order.save()


REPORTING_SORTABLE_FIELDS = frozenset({
    "work_order_code",
    "work_order_name",
    "operation_code",
    "operation_name",
    "worker_name",
    "recorded_by_name",
    "client_channel",
    "report_mode",
    "reported_quantity",
    "qualified_quantity",
    "unqualified_quantity",
    "work_hours",
    "status",
    "reported_at",
    "approved_at",
    "created_at",
    "updated_at",
})


@dataclass
class LastOperationInboundResult:
    """末道工序自动入库执行结果（供报工响应附带提示）。"""

    outcome: str
    receipt_code: Optional[str] = None


def _post_action_notices_from_last_inbound(
    result: Optional[LastOperationInboundResult],
) -> Optional[List["ReportingPostActionNotice"]]:
    from apps.kuaizhizao.schemas.reporting_record import ReportingPostActionNotice

    if not result:
        return None
    code_by_outcome = {
        "pending_created": ("info", "last_inbound_pending"),
        "confirmed": ("success", "last_inbound_confirmed"),
        "confirm_blocked_fqc": ("warning", "last_inbound_fqc_blocked"),
        "failed": ("warning", "last_inbound_failed"),
    }
    mapped = code_by_outcome.get(result.outcome)
    if not mapped:
        return None
    level, code = mapped
    return [
        ReportingPostActionNotice(
            level=level,
            code=code,
            receipt_code=result.receipt_code,
        )
    ]


def _attach_inbound_notices(
    response: ReportingRecordResponse,
    result: Optional[LastOperationInboundResult],
) -> ReportingRecordResponse:
    notices = _post_action_notices_from_last_inbound(result)
    if notices:
        response.post_action_notices = notices
    return response


class ReportingService(AppBaseService[ReportingRecord]):
    """
    报工服务类

    处理报工记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReportingRecord)

    async def _get_reporting_estimated_wage_rate(self, tenant_id: int) -> Decimal:
        """读取报工统计预估工资基数，未配置时回退到 30。"""
        default_rate = Decimal("30")
        try:
            biz_config = await BusinessConfigService().get_business_config(tenant_id)
            reporting_cfg = (biz_config or {}).get("parameters", {}).get("reporting", {})
            configured_rate = reporting_cfg.get("estimated_wage_rate")
            if configured_rate is None:
                return default_rate
            rate = Decimal(str(configured_rate))
            return rate if rate > 0 else default_rate
        except Exception:
            return default_rate

    async def _is_last_operation_for_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
    ) -> bool:
        """报工工序是否为工单工艺末道（按 sequence / id 取最大）。"""
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            return False
        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        return int(last_op.operation_id) == int(operation_id)

    async def _resolve_inbound_warehouse_for_reporting(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        operation_id: int,
        inbound_warehouse_id: Optional[int],
        inbound_warehouse_name: Optional[str],
    ) -> tuple[Optional[int], Optional[str]]:
        """末道工序报工解析入库仓库；自动入库/入库通知模式下未传则尝试默认仓库。"""
        if not await self._is_last_operation_for_work_order(
            tenant_id, work_order.id, operation_id
        ):
            return None, None

        mode = await BusinessConfigService().get_last_operation_auto_inbound_mode(tenant_id)
        wh_id = int(inbound_warehouse_id) if inbound_warehouse_id else None
        wh_name = (inbound_warehouse_name or "").strip() or None

        if wh_id:
            if not wh_name:
                from apps.master_data.models.warehouse import Warehouse

                wh = await Warehouse.get_or_none(
                    tenant_id=tenant_id, id=wh_id, deleted_at__isnull=True
                )
                if wh:
                    wh_name = wh.name
            return wh_id, wh_name

        if mode in ("direct_inbound", "inbound_notice"):
            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

            resolved = await FinishedGoodsReceiptService().resolve_default_inbound_warehouse_for_work_order(
                tenant_id=tenant_id,
                work_order=work_order,
            )
            if resolved:
                return resolved
            raise ValidationError("末道工序报工请选择入库仓库")

        return None, None

    async def _direct_inbound_receipt_exists_for_reporting(
        self,
        tenant_id: int,
        reporting_record_id: int,
    ) -> bool:
        """末道报工是否已生成过生产入库单（幂等）。"""
        return await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="reporting_record",
            source_id=reporting_record_id,
            target_type__in=["finished_goods_receipt", "semi_finished_goods_receipt"],
        ).exists()

    async def _sync_pending_inbound_receipts_if_needed(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """
        将待入库生产入库单数量与末道累计合格数对齐。

        「直接入库」「入库通知」模式下每笔末道报工各建一张入库单，不再做整单数量同步。
        """
        mode = await BusinessConfigService().get_last_operation_auto_inbound_mode(tenant_id)
        if mode in ("direct_inbound", "inbound_notice"):
            return
        try:
            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
            from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                SemiFinishedGoodsReceiptService,
            )

            await FinishedGoodsReceiptService().sync_pending_finished_goods_receipts_for_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
            )
            await SemiFinishedGoodsReceiptService().sync_pending_semi_finished_goods_receipts_for_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
            )
        except Exception as sync_err:
            logger.warning(
                "同步待入库生产入库单失败 tenant_id=%s work_order_id=%s err=%s",
                tenant_id,
                work_order_id,
                sync_err,
            )

    async def _maybe_trigger_direct_finished_goods_inbound(
        self,
        tenant_id: int,
        reporting_record_id: int,
        acting_user_id: int,
    ) -> Optional[LastOperationInboundResult]:
        """
        业务参数「末道工序自动入库」：
        - direct_inbound：末道每笔已审核报工按合格数量各建一张入库单并确认入库
        - inbound_notice：同上建待入库单，不自动确认（预留成品检验流程）
        在报工事务提交之后调用，避免与报工嵌套事务冲突。
        """
        from infra.exceptions.exceptions import BusinessLogicError

        try:
            mode = await BusinessConfigService().get_last_operation_auto_inbound_mode(tenant_id)
            if mode not in ("direct_inbound", "inbound_notice"):
                return None

            record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not record or record.status != "approved":
                return None

            if not await self._is_last_operation_for_work_order(
                tenant_id,
                record.work_order_id,
                record.operation_id,
            ):
                return None

            qualified = float(record.qualified_quantity or 0)
            if qualified <= 0:
                return None

            if await self._direct_inbound_receipt_exists_for_reporting(
                tenant_id, reporting_record_id
            ):
                return None

            wo = await WorkOrder.get_or_none(
                id=record.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not wo or wo.status not in ("released", "in_progress", "completed"):
                return None

            semi = await is_semi_finished_product_by_bom_role(tenant_id, wo.product_id)

            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

            wh_svc = FinishedGoodsReceiptService()
            if record.inbound_warehouse_id:
                warehouse_id = int(record.inbound_warehouse_id)
                warehouse_name = (record.inbound_warehouse_name or "").strip()
                if not warehouse_name:
                    from apps.master_data.models.warehouse import Warehouse

                    wh = await Warehouse.get_or_none(
                        tenant_id=tenant_id,
                        id=warehouse_id,
                        deleted_at__isnull=True,
                    )
                    warehouse_name = wh.name if wh else str(warehouse_id)
            else:
                resolved = await wh_svc.resolve_default_inbound_warehouse_for_work_order(
                    tenant_id=tenant_id,
                    work_order=wo,
                )
                if not resolved:
                    logger.warning(
                        "末道工序自动入库已开启但跳过创建入库单：未解析到默认仓库，请在成品物料上配置默认仓库，或维护与工单工作中心/车间关联的启用仓库。"
                        f" tenant_id={tenant_id} work_order_id={record.work_order_id}"
                        f" work_order_code={getattr(wo, 'code', '')} reporting_record_id={reporting_record_id}"
                        f" mode={mode}"
                    )
                    return LastOperationInboundResult(outcome="failed")
                warehouse_id, warehouse_name = resolved
            receipt = await wh_svc.quick_receipt_from_work_order(
                tenant_id=tenant_id,
                work_order_id=record.work_order_id,
                created_by=acting_user_id,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                receipt_quantity=qualified,
            )

            receipt_code = receipt.receipt_code
            inbound_outcome = "pending_created"
            if mode == "direct_inbound":
                try:
                    if semi:
                        from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                            SemiFinishedGoodsReceiptService,
                        )

                        confirmed = await SemiFinishedGoodsReceiptService().confirm_receipt(
                            tenant_id=tenant_id,
                            receipt_id=receipt.id,
                            confirmed_by=acting_user_id,
                        )
                        receipt_code = confirmed.receipt_code
                    else:
                        confirmed = await wh_svc.confirm_receipt(
                            tenant_id=tenant_id,
                            receipt_id=receipt.id,
                            confirmed_by=acting_user_id,
                        )
                        receipt_code = confirmed.receipt_code
                    inbound_outcome = "confirmed"
                except BusinessLogicError as confirm_err:
                    msg = str(confirm_err)
                    if "成品检验" in msg or "FQC" in msg.upper():
                        logger.info(
                            "末道工序直接入库因成品检验未通过而保留待入库："
                            f" reporting_record_id={reporting_record_id} receipt={receipt_code} err={msg}"
                        )
                        inbound_outcome = "confirm_blocked_fqc"
                    else:
                        raise

            target_type = "semi_finished_goods_receipt" if semi else "finished_goods_receipt"
            relation_desc = (
                "末道工序报工直接入库"
                if mode == "direct_inbound" and inbound_outcome == "confirmed"
                else "末道工序报工入库通知"
            )
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="reporting_record",
                        source_id=reporting_record_id,
                        source_code=record.work_order_code,
                        source_name=f"{record.operation_name} 报工",
                        target_type=target_type,
                        target_id=receipt.id,
                        target_code=receipt_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc=relation_desc,
                    ),
                    created_by=acting_user_id,
                )
            except Exception as rel_err:
                logger.warning(
                    "末道工序自动入库：建立报工→入库单关联失败 reporting_record_id=%s err=%s",
                    reporting_record_id,
                    rel_err,
                )

            if inbound_outcome == "confirmed":
                logger.info(
                    f"末道工序直接入库：报工 id={reporting_record_id} 已为工单 {wo.code} 确认"
                    f"{'半成品' if semi else '成品'}入库单 {receipt_code}，数量 {qualified}，仓库 id={warehouse_id}"
                )
            else:
                logger.info(
                    f"末道工序入库通知：报工 id={reporting_record_id} 已为工单 {wo.code} 生成"
                    f"{'半成品' if semi else '成品'}待入库单 {receipt_code}，数量 {qualified}，仓库 id={warehouse_id}"
                    f" outcome={inbound_outcome}"
                )
            return LastOperationInboundResult(
                outcome=inbound_outcome,
                receipt_code=receipt_code,
            )
        except BusinessLogicError as e:
            msg = str(e)
            if "成品检验" in msg or "FQC" in msg.upper():
                logger.info(
                    "末道工序自动入库：成品检验未满足，保留待入库或跳过确认"
                    f" reporting_record_id={reporting_record_id} err={msg}"
                )
                return LastOperationInboundResult(outcome="confirm_blocked_fqc")
            logger.warning(
                f"末道工序自动入库失败：tenant_id={tenant_id}"
                f" reporting_record_id={reporting_record_id} err={msg}"
            )
            return LastOperationInboundResult(outcome="failed")
        except ValidationError as e:
            logger.warning(
                f"末道工序自动入库失败：tenant_id={tenant_id}"
                f" reporting_record_id={reporting_record_id} err={e}"
            )
            return LastOperationInboundResult(outcome="failed")
        except Exception as e:
            logger.warning(
                f"末道工序自动入库失败：tenant_id={tenant_id}"
                f" reporting_record_id={reporting_record_id} err={e}"
            )
            return LastOperationInboundResult(outcome="failed")

    @staticmethod
    def _derive_work_hours_from_operation(
        work_order_operation: WorkOrderOperation,
        reported_quantity: Decimal,
        qualified_quantity: Decimal,
    ) -> Decimal:
        std = getattr(work_order_operation, "standard_time", None)
        if std is None or Decimal(str(std)) <= 0:
            return Decimal("0")
        qty = reported_quantity or qualified_quantity or Decimal("0")
        if qty <= 0:
            return Decimal("0")
        return (Decimal(str(std)) * qty).quantize(Decimal("0.01"))

    async def _refresh_performance_after_approved_reporting(
        self,
        tenant_id: int,
        record: ReportingRecord,
    ) -> None:
        if record.status != "approved" or not record.worker_id or not record.reported_at:
            return
        from apps.master_data.services.performance_calc_service import PerformanceCalcService

        period = PerformanceCalcService._period_from_reported_at(record.reported_at)
        await PerformanceCalcService.refresh_employee_period_from_reporting(
            tenant_id,
            int(record.worker_id),
            period,
        )

    async def create_reporting_record(
        self,
        tenant_id: int,
        reporting_data: ReportingRecordCreate,
        reported_by: int,
        entry_mode: str = "manual",
        client_channel: Optional[str] = None,
    ) -> ReportingRecordResponse:
        """
        创建报工记录

        Args:
            tenant_id: 组织ID
            reporting_data: 报工创建数据
            reported_by: 报工人ID

        Returns:
            ReportingRecordResponse: 创建的报工记录信息

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单不存在
        """
        trigger_direct_inbound = False
        reporting_record_id_for_auto: Optional[int] = None

        if True:
            # 验证工单是否存在且状态正确
            work_order = await WorkOrder.get_or_none(
                id=reporting_data.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_data.work_order_id}")

            from apps.kuaizhizao.services.inspection_policy_service import get_quality_effective_config
            from apps.kuaizhizao.services.quality_fai_service import FaiOrderService

            _fai_cfg = await get_quality_effective_config(tenant_id)
            await FaiOrderService().assert_mass_reporting_allowed(
                tenant_id,
                int(reporting_data.work_order_id),
                gate_enabled=bool(_fai_cfg.get("gate", {}).get("require_fai_before_mass_reporting")),
            )

            team_id_val = getattr(reporting_data, "team_id", None)
            worker_id_raw = getattr(reporting_data, "worker_id", None)
            worker_id_int: Optional[int] = None
            if worker_id_raw is not None:
                try:
                    worker_id_int = int(worker_id_raw)
                except Exception:
                    raise ValidationError("报工操作工ID无效")
            if worker_id_int is None and team_id_val is None:
                raise ValidationError("须指定生产人员或工作小组")

            recorder = await User.get_or_none(id=int(reported_by))
            recorder_name = ""
            if recorder:
                recorder_name = (recorder.full_name or recorder.username or "").strip() or str(recorder.username or "")
            if not recorder_name:
                recorder_name = (
                    reporting_data.worker_name
                    or getattr(reporting_data, "team_name", None)
                    or "用户"
                )

            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if block_level >= 3:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                shortage_result = await WorkOrderService().check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items", []) or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        "工单存在缺料，无法报工。缺料物料："
                        + shortage_materials
                        + (
                            f"等{total_shortage_count}种物料"
                            if total_shortage_count > 3
                            else ""
                        )
                    )

            policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
            if policy.get("require_confirmed_picking_before_reporting", False):
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                has_confirmed = await WorkOrderService.has_confirmed_picking_for_work_order(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                )
                if not has_confirmed:
                    raise BusinessLogicError(
                        "未确认正式领料，禁止报工：请先确认该工单的生产领料单"
                        "（配料/叫料到线边不算正式发料）"
                    )

            # 检查工单是否冻结
            if work_order.is_frozen:
                raise BusinessLogicError(f"工单已冻结，不能报工。冻结原因：{work_order.freeze_reason or '无'}")

            if (work_order.status or "") == "split":
                raise BusinessLogicError("已拆分主工单不可报工，请将剩余数量拆分为子工单后由子工单执行")

            if work_order.status not in ['released', 'in_progress']:
                raise ValidationError("只能对已下达或进行中的工单进行报工")

            # 获取工单工序信息（用于校验跳转规则和报工类型）
            work_order_operation = await _resolve_work_order_operation_for_reporting(
                tenant_id=tenant_id,
                work_order_id=reporting_data.work_order_id,
                operation_id=reporting_data.operation_id,
            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={reporting_data.work_order_id}, 工序ID={reporting_data.operation_id}")

            from apps.kuaizhizao.models.outsource_order import OutsourceOrder
            from apps.kuaizhizao.utils.outsource_operation import is_outsourced_flag

            has_active_outsource = await OutsourceOrder.filter(
                tenant_id=tenant_id,
                work_order_operation_id=work_order_operation.id,
                deleted_at__isnull=True,
            ).exclude(status="cancelled").exists()
            if is_outsourced_flag(
                work_order_operation, has_active_outsource_order=has_active_outsource
            ):
                raise ValidationError(
                    "该工序为委外工序，请通过委外接收完成数量，不可厂内报工"
                )

            if (
                not work_order_operation.assigned_worker_id
                and not getattr(work_order_operation, "assigned_team_id", None)
            ):
                raise ValidationError("该工序尚未派工，请先派工后再报工")

            # 报工会将 pending 工序隐式置为 in_progress，等同开工，须同样校验领料
            if work_order_operation.status == "pending":
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                await WorkOrderService.assert_confirmed_picking_before_operation_start_if_required(
                    tenant_id,
                    reporting_data.work_order_id,
                    action_label="报工",
                )

            # 根据报工类型验证数据（核心功能，新增）
            reporting_type = work_order_operation.reporting_type or "quantity"

            # 工序跳转规则：工单或工序任一方允许跳转则放宽；节点工序在允许跳转时仍不可跳过
            from apps.kuaizhizao.services.operation_jump_rules import (
                effective_allow_jump,
                validate_reporting_respects_node_operations,
            )

            allow_jump = effective_allow_jump(work_order, work_order_operation)
            reported_quantity_dec = Decimal(str(reporting_data.reported_quantity))

            if reporting_type == "status":
                from apps.kuaizhizao.services.over_report_rules import status_reporting_complete_delta

                if reported_quantity_dec > 0:
                    delta = status_reporting_complete_delta(work_order, work_order_operation)
                    if delta <= 0:
                        raise BusinessLogicError("按状态报工：工序已达完成上限，无需重复报工")
                    reporting_data.reported_quantity = delta
                    reporting_data.qualified_quantity = delta
                    reporting_data.unqualified_quantity = Decimal("0")
                    reported_quantity_dec = delta
                elif reported_quantity_dec < 0:
                    raise ValidationError("按状态报工模式下，报工数量不能为负数")
                else:
                    reporting_data.qualified_quantity = Decimal("0")
                    reporting_data.unqualified_quantity = Decimal("0")

            if not allow_jump:
                # 不允许跳转：检查前序工序（须排除软删除行，否则下工单时删掉的工序仍会挡住报工）
                previous_operations = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                    sequence__lt=work_order_operation.sequence,
                    deleted_at__isnull=True,
                ).order_by('-sequence').limit(1).all()

                if previous_operations:
                    previous_operation = previous_operations[0]

                    # 按状态报工且报「完成」：紧邻上道须已 completed
                    if reporting_type == "status" and reported_quantity_dec > 0:
                        if previous_operation.status != "completed":
                            raise BusinessLogicError(
                                f"工序跳转规则：请先完成前序工序「{previous_operation.operation_name}」后，再将当前工序报为完成"
                            )
                    
                    # 检查前序工序转入量：累计完成不可超过上道合格转出（不允许跳转时）
                    from apps.kuaizhizao.services.operation_jump_rules import qualified_transfer_quantity_async

                    previous_transfer = await qualified_transfer_quantity_async(
                        tenant_id,
                        reporting_data.work_order_id,
                        previous_operation,
                    )
                    current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
                    new_completed = current_completed + reported_quantity_dec

                    if reporting_type == "quantity" and new_completed > previous_transfer:
                        raise BusinessLogicError(
                            f"工序跳转规则：当前工序累计报工数量（{new_completed}）不能超过"
                            f"前序工序「{previous_operation.operation_name}」的合格产出（{previous_transfer}）"
                        )
            else:
                await validate_reporting_respects_node_operations(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                    work_order_operation=work_order_operation,
                    reporting_type=reporting_type,
                    reported_quantity=reported_quantity_dec,
                )

            # 工时合法性：允许为空/0（按标准工时×数量推导）；不允许负数
            wh = Decimal(str(getattr(reporting_data, "work_hours", 0) or 0))
            if wh < 0:
                raise ValidationError("报工工时不能为负数")
            if wh <= 0:
                wh = self._derive_work_hours_from_operation(
                    work_order_operation,
                    reported_quantity_dec,
                    Decimal(str(reporting_data.qualified_quantity or 0)),
                )
                reporting_data.work_hours = wh

            # 数量报工：累计完成不可超过「计划+超报」上限（不允许超报时即计划数）
            if reporting_type == "quantity":
                from apps.kuaizhizao.services.over_report_rules import (
                    max_completed_quantity_for_plan,
                    remaining_completed_headroom,
                    tuple_from_model,
                )

                plan_qty = work_order.quantity or Decimal("0")
                om, ov = tuple_from_model(work_order_operation)
                max_completed = max_completed_quantity_for_plan(plan_qty, om, ov)
                current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
                allowed_additional = remaining_completed_headroom(
                    plan_qty, current_completed, om, ov
                )
                if reported_quantity_dec > allowed_additional:
                    raise BusinessLogicError(
                        f"报工数量超限：本道工序本次最多可报 {allowed_additional}"
                        f"（计划 {plan_qty}，超报规则 {om}，允许累计完成 {max_completed}，"
                        f"当前已报完成 {current_completed}），本次报工 {reported_quantity_dec}"
                    )
            
            if reporting_type != "status":
                # 按数量报工：需要验证数量合理性
                if reporting_data.reported_quantity <= 0:
                    raise ValidationError("报工数量必须大于0")

                if reporting_data.qualified_quantity + reporting_data.unqualified_quantity != reporting_data.reported_quantity:
                    raise ValidationError("合格数量 + 不合格数量必须等于报工数量")

            # 检查是否开启自动审核
            biz_config_svc = BusinessConfigService()
            biz_config = await biz_config_svc.get_business_config(tenant_id)
            reporting_params = biz_config.get("parameters", {}).get("reporting", {})

            # 参数报工开关强执行：关闭时不允许提交 sop_parameters
            parameter_reporting_enabled = reporting_params.get("parameter_reporting", False)
            if (reporting_data.sop_parameters or {}) and not parameter_reporting_enabled:
                raise BusinessLogicError("当前组织未开启参数报工，禁止提交工艺参数报工数据")

            # 快捷报工开关强执行：关闭时不允许走快捷报工入口
            quick_reporting_enabled = reporting_params.get("quick_reporting", False)
            if entry_mode == "quick" and not quick_reporting_enabled:
                raise BusinessLogicError("当前组织未开启快捷报工，请在配置中心启用后再操作")

            auto_approve = biz_config.get("parameters", {}).get("reporting", {}).get("auto_approve", False)
            reporting_audit_required = await biz_config_svc.check_audit_required(tenant_id, "reporting_record")
            should_auto_approve = (not reporting_audit_required) or bool(auto_approve)

            approved_at = None
            approved_by = None
            approved_by_name = None

            if should_auto_approve and reporting_data.status == 'pending':
                reporting_data.status = 'approved'
                approved_at = resolve_business_datetime()
                approved_by = reported_by
                approved_by_name = recorder_name or reporting_data.worker_name or "自动审核"
            elif reporting_data.status == "approved" and approved_at is None:
                # 调用方直接落已审核时，补齐审核时间，确保后续质检自动建单能触发
                approved_at = resolve_business_datetime()
                approved_by = reported_by
                approved_by_name = recorder_name or reporting_data.worker_name or "系统"

            # 关键主数据标识以后端查询结果为准，避免前端篡改编码/名称
            trusted_work_order_code = getattr(work_order, "code", None) or reporting_data.work_order_code
            trusted_work_order_name = getattr(work_order, "name", None) or reporting_data.work_order_name
            trusted_operation_code = getattr(work_order_operation, "operation_code", None) or reporting_data.operation_code
            trusted_operation_name = getattr(work_order_operation, "operation_name", None) or reporting_data.operation_name

            inbound_wh_id, inbound_wh_name = await self._resolve_inbound_warehouse_for_reporting(
                tenant_id=tenant_id,
                work_order=work_order,
                operation_id=reporting_data.operation_id,
                inbound_warehouse_id=getattr(reporting_data, "inbound_warehouse_id", None),
                inbound_warehouse_name=getattr(reporting_data, "inbound_warehouse_name", None),
            )

            from core.utils.client_channel import normalize_client_channel, resolve_report_mode

            channel_code = normalize_client_channel(client_channel)
            report_mode = resolve_report_mode(
                team_id=team_id_val,
                worker_id=worker_id_int,
                recorded_by=reported_by,
            )

            # 创建报工记录
            reporting_record = await ReportingRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=reporting_data.work_order_id,
                work_order_code=trusted_work_order_code,
                work_order_name=trusted_work_order_name,
                operation_id=reporting_data.operation_id,
                operation_code=trusted_operation_code,
                operation_name=trusted_operation_name,
                worker_id=worker_id_int,
                worker_name=(reporting_data.worker_name or getattr(reporting_data, "team_name", None) or None),
                team_id=int(team_id_val) if team_id_val is not None else None,
                team_name=(getattr(reporting_data, "team_name", None) or None),
                recorded_by=int(reported_by),
                recorded_by_name=recorder_name,
                client_channel=channel_code,
                report_mode=report_mode,
                reported_quantity=reporting_data.reported_quantity,
                qualified_quantity=reporting_data.qualified_quantity,
                unqualified_quantity=reporting_data.unqualified_quantity,
                work_hours=reporting_data.work_hours,
                work_start_time=coerce_business_datetime_to_utc(
                    getattr(reporting_data, "work_start_time", None)
                ),
                work_end_time=coerce_business_datetime_to_utc(
                    getattr(reporting_data, "work_end_time", None)
                ),
                status=reporting_data.status,
                reported_at=reporting_data.reported_at,
                remarks=reporting_data.remarks,
                device_info=reporting_data.device_info,
                sop_parameters=reporting_data.sop_parameters,  # SOP参数数据（核心功能，新增）
                inbound_warehouse_id=inbound_wh_id,
                inbound_warehouse_name=inbound_wh_name,
                approved_at=approved_at,
                approved_by=approved_by,
                approved_by_name=approved_by_name,
            )

            # 更新工单工序状态和进度（核心功能，新增）
            if work_order_operation.status == 'pending':
                work_order_operation.status = 'in_progress'
                work_order_operation.actual_start_date = work_order_operation.actual_start_date or resolve_business_datetime()
            
            # 更新工序完成数量
            work_order_operation.completed_quantity = (
                work_order_operation.completed_quantity or Decimal("0")
            ) + reporting_data.reported_quantity
            work_order_operation.qualified_quantity = (
                work_order_operation.qualified_quantity or Decimal("0")
            ) + reporting_data.qualified_quantity
            work_order_operation.unqualified_quantity = (
                work_order_operation.unqualified_quantity or Decimal("0")
            ) + reporting_data.unqualified_quantity
            # 待审核报工可累计数量，但工序 completed 须在审核通过后判定（与撤回报工「仅统计 approved」一致）
            operation_became_completed = False
            if reporting_record.status == "approved":
                if reporting_type == "status" and reported_quantity_dec > 0:
                    if work_order_operation.status != "completed":
                        work_order_operation.status = "completed"
                        work_order_operation.actual_end_date = resolve_business_datetime()
                        operation_became_completed = True
                else:
                    was_completed = work_order_operation.status == "completed"
                    if await _sync_operation_completion_status(
                        tenant_id, work_order, work_order_operation
                    ):
                        if not was_completed and work_order_operation.status == "completed":
                            operation_became_completed = True

            _sync_operation_assigned_producer_from_reporting(
                work_order_operation,
                worker_id=worker_id_int,
                worker_name=reporting_data.worker_name,
                team_id=int(team_id_val) if team_id_val is not None else None,
                team_name=getattr(reporting_data, "team_name", None),
            )

            await work_order_operation.save()

            # 更新工单状态为进行中（如果是从released变为in_progress）
            if work_order.status == 'released':
                work_order.status = 'in_progress'
                work_order.actual_start_date = work_order.actual_start_date or resolve_business_datetime()
            
            # 检查工单是否完成（以最后一道工序完成为依据；方案质检须检验放行后工序才 completed）
            all_operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                deleted_at__isnull=True,
            ).all()
            all_completed = len(all_operations) > 0 and all(op.status == 'completed' for op in all_operations)
            wo_became_completed = False
            if all_completed and work_order.status != 'completed':
                work_order.status = 'completed'
                work_order.actual_end_date = work_order.actual_end_date or resolve_business_datetime()
                wo_became_completed = True
            elif (
                not all_completed
                and work_order.status == 'completed'
                and not getattr(work_order, "manually_completed", False)
            ):
                work_order.status = 'in_progress'
                work_order.actual_end_date = None

            # 工单头已完成/合格数量 = 末道工序累计（不按全工序报工相加）
            if all_operations:
                last_op = max(all_operations, key=lambda op: (op.sequence or 0, op.id or 0))
                work_order.completed_quantity = last_op.completed_quantity or Decimal("0")
                work_order.qualified_quantity = last_op.qualified_quantity or Decimal("0")
            else:
                work_order.completed_quantity = Decimal("0")
                work_order.qualified_quantity = Decimal("0")
            
            await work_order.save()

            if operation_became_completed:
                await notify_next_operation_assignees_after_completed(
                    tenant_id,
                    work_order,
                    work_order_operation,
                    operations=all_operations,
                )

            if wo_became_completed:
                from apps.kuaizhizao.services.kuaizhizao_business_notification import (
                    notify_work_order_completed,
                )

                try:
                    await notify_work_order_completed(
                        tenant_id,
                        work_order_id=work_order.id,
                        work_order_code=work_order.code or str(work_order.id),
                        product_name=work_order.product_name or "—",
                        completed_quantity=str(
                            work_order.completed_quantity or work_order.quantity or 0
                        ),
                        creator_user_id=work_order.created_by,
                    )
                except Exception as exc:
                    logger.warning(
                        "工单完工消息提醒失败 tenant={} wo={}: {}",
                        tenant_id,
                        work_order.id,
                        exc,
                    )

            # 报工创建时若已自动审核，在此触发倒冲；待审核报工在 approve 流程触发
            if reporting_data.status == "approved":
                try:
                    from apps.kuaizhizao.services.backflush_service import BackflushService
                    backflush_svc = BackflushService()
                    await backflush_svc.backflush_materials(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                        report_id=reporting_record.id,
                        report_quantity=float(reporting_data.reported_quantity),
                        operation_id=reporting_data.operation_id,
                        operation_code=trusted_operation_code,
                        processed_by=reported_by,
                    )
                except Exception as backflush_err:
                    logger.warning(
                        f"报工成功但物料倒冲失败：工单 {work_order.code}，报工ID {reporting_record.id}，"
                        f"错误: {backflush_err}"
                    )

            # 报工生效时自动累计模具使用次数（工序分配了模具且已审核）
            if approved_at is not None:
                await self._create_mold_usage_from_reporting(
                    tenant_id=tenant_id,
                    work_order_operation=work_order_operation,
                    work_order=work_order,
                    qualified_quantity=float(reporting_data.qualified_quantity),
                    reporting_record_id=reporting_record.id,
                    operator_name=reporting_data.worker_name,
                )

            # 报工生效时自动触发质量检验需求（根据策略自动创建检验单）
            if reporting_record.status == "approved":
                try:
                    await self._trigger_quality_inspection_from_reporting(
                        tenant_id=tenant_id,
                        work_order=work_order,
                        work_order_operation=work_order_operation,
                        reporting_record=reporting_record,
                        created_by=reported_by
                    )
                except Exception as qc_err:
                    logger.warning(f"报工成功但触发质量检验失败：{qc_err}")

            logger.info(f"报工成功：工单 {work_order.code}，工序 {work_order_operation.operation_name}，数量 {reporting_data.reported_quantity}")

            trigger_direct_inbound = reporting_record.status == "approved"
            reporting_record_id_for_auto = reporting_record.id

        if trigger_direct_inbound and reporting_record_id_for_auto is not None:
            inbound_result = await self._maybe_trigger_direct_finished_goods_inbound(
                tenant_id, reporting_record_id_for_auto, reported_by
            )
        else:
            inbound_result = None

        await self._sync_pending_inbound_receipts_if_needed(
            tenant_id=tenant_id,
            work_order_id=reporting_record.work_order_id,
        )
        if reporting_record.status == "approved":
            await self._refresh_performance_after_approved_reporting(
                tenant_id, reporting_record
            )
        return _attach_inbound_notices(
            ReportingRecordResponse.model_validate(reporting_record),
            inbound_result,
        )

    async def get_reporting_record_by_id(
        self,
        tenant_id: int,
        record_id: int
    ) -> ReportingRecordResponse:
        """
        根据ID获取报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Returns:
            ReportingRecordResponse: 报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,

        )

        if not record:
            raise NotFoundError("报工记录", str(record_id))

        resp = ReportingRecordResponse.model_validate(record)
        from core.services.approval.audit_record_enricher import enrich_record

        enriched = await enrich_record(tenant_id, "reporting_record", resp)
        return enrich_reporting_record_capabilities_on_response(record, enriched)

    async def list_reporting_pull_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        work_order_code: Optional[str] = None,
        scope: str = "reportable",
        skip: int = 0,
        limit: int = 20,
    ) -> ReportingPullCandidateListResponse:
        """
        报工加载源：一次查询返回在制工单×工序分页行（含可报数量）。

        scope=reportable：仅本次可报>0；scope=all：全部工序行。
        """
        from collections import defaultdict

        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.services.over_report_rules import (
            max_completed_quantity_for_plan,
            tuple_from_model,
        )
        from apps.kuaizhizao.services.operation_transfer_service import (
            build_operation_policy_cache,
            resolve_operation_transfer_qualified,
            sum_process_inspection_quality_quantities,
        )
        from apps.kuaizhizao.services.work_order_service import WORK_ORDER_IN_PROGRESS_STATUS

        kw = (keyword or "").strip()
        wo_code = (work_order_code or "").strip()
        max_work_orders = 1000

        wo_query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status__in=list(WORK_ORDER_IN_PROGRESS_STATUS),
        )
        if wo_code:
            wo_query = wo_query.filter(code__icontains=wo_code)
        elif kw:
            op_wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).filter(
                Q(operation_name__icontains=kw)
                | Q(operation_code__icontains=kw)
                | Q(work_order_code__icontains=kw)
            ).distinct().values_list("work_order_id", flat=True)
            wo_query = wo_query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(product_code__icontains=kw)
                | Q(id__in=list(op_wo_ids))
            )

        work_orders = await wo_query.order_by("-planned_start_date", "-id").limit(max_work_orders)
        if not work_orders:
            return ReportingPullCandidateListResponse(data=[], total=0, success=True)

        wo_by_id = {int(wo.id): wo for wo in work_orders}
        wo_ids = list(wo_by_id.keys())

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).order_by("work_order_id", "sequence").all()

        ops_by_wo: Dict[int, List[WorkOrderOperation]] = defaultdict(list)
        master_op_ids_set: set[int] = set()
        for op in operations:
            ops_by_wo[int(op.work_order_id)].append(op)
            if op.operation_id is not None:
                master_op_ids_set.add(int(op.operation_id))

        master_op_ids = list(master_op_ids_set)
        policy_cache = await build_operation_policy_cache(tenant_id, master_op_ids)
        # 审核开关同租户内恒定：双重循环外解析一次，否则每工序都会重查审核绑定
        process_inspection_audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "process_inspection"
        )

        inspections = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).all()
        inspections_by_wo_op: Dict[tuple[int, int], List[Any]] = defaultdict(list)
        for insp in inspections:
            mid = getattr(insp, "operation_id", None)
            wid = getattr(insp, "work_order_id", None)
            if mid is None or wid is None:
                continue
            inspections_by_wo_op[(int(wid), int(mid))].append(insp)

        kw_lower = kw.lower()
        rows: List[ReportingPullCandidateItem] = []
        # 保持与工单排序一致
        for wo_id in wo_ids:
            wo = wo_by_id[wo_id]
            plan_qty = Decimal(str(wo.quantity or 0))
            wo_ops = ops_by_wo.get(wo_id, [])
            if not wo_ops:
                continue

            prev_transfer = plan_qty
            for op in wo_ops:
                master_id = int(op.operation_id) if op.operation_id is not None else 0
                mode = "none"
                if master_id > 0 and master_id in policy_cache:
                    mode = policy_cache[master_id][0]

                op_inspections = inspections_by_wo_op.get((wo_id, master_id), [])
                transfer_qualified = await resolve_operation_transfer_qualified(
                    tenant_id,
                    wo_id,
                    op,
                    policy_cache=policy_cache,
                    inspections_by_op={master_id: op_inspections} if master_id else None,
                    audit_required=process_inspection_audit_required,
                )

                completed = Decimal(str(op.completed_quantity or 0))
                qualified = Decimal(str(op.qualified_quantity or 0))
                if mode == "plan":
                    insp_q, insp_u = sum_process_inspection_quality_quantities(op_inspections)
                    if insp_q + insp_u > 0:
                        material_consumed = completed - insp_u
                        if material_consumed < 0:
                            material_consumed = Decimal("0")
                    else:
                        material_consumed = qualified
                else:
                    material_consumed = qualified

                material_remaining = prev_transfer - material_consumed
                if material_remaining < 0:
                    material_remaining = Decimal("0")

                om, ov = tuple_from_model(op)
                rule_cap = max_completed_quantity_for_plan(plan_qty, om, ov)
                plan_remaining = max(Decimal("0"), rule_cap - completed)
                # 报工上限：计划+超报累计完成上限；前序转入不足时本次可报更小。
                plan_side_cap = completed + plan_remaining
                effective = min(plan_remaining, material_remaining)

                op_code = str(op.operation_code or "")
                op_name = str(op.operation_name or "")
                display_name = (str(wo.name or "").strip()
                                or str(wo.product_name or "").strip()
                                or str(wo.code or "").strip())
                if kw_lower:
                    hay = " ".join(
                        [
                            str(wo.code or ""),
                            display_name,
                            str(wo.product_name or ""),
                            op_code,
                            op_name,
                        ]
                    ).lower()
                    if kw_lower not in hay:
                        prev_transfer = transfer_qualified
                        continue

                rows.append(
                    ReportingPullCandidateItem(
                        pull_row_key=f"{wo_id}-{op.operation_id}",
                        work_order_id=wo_id,
                        code=str(wo.code or ""),
                        name=wo.name,
                        product_name=wo.product_name,
                        quantity=plan_qty,
                        planned_start_date=wo.planned_start_date,
                        operation_id=int(op.operation_id),
                        operation_code=op_code or None,
                        operation_name=op_name or None,
                        operation_sequence=int(op.sequence) if op.sequence is not None else None,
                        reporting_type=(
                            "status"
                            if str(op.reporting_type or "").strip().lower() == "status"
                            else "quantity"
                        ),
                        reportable_quantity_cap=plan_side_cap,
                        reportable_quantity_pushed=completed,
                        reportable_quantity_max=effective,
                    )
                )
                prev_transfer = transfer_qualified

        scope_norm = (scope or "reportable").strip().lower()
        if scope_norm != "all":
            rows = [r for r in rows if Decimal(str(r.reportable_quantity_max or 0)) > 0]

        total = len(rows)
        page = rows[skip : skip + limit]
        return ReportingPullCandidateListResponse(data=page, total=total, success=True)

    async def list_reporting_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_code: Optional[str] = None,
        work_order_name: Optional[str] = None,
        operation_name: Optional[str] = None,
        worker_name: Optional[str] = None,
        worker_id: Optional[int] = None,
        client_channel: Optional[str] = None,
        report_mode: Optional[str] = None,
        status: Optional[str] = None,
        reported_at_start: Optional[datetime] = None,
        reported_at_end: Optional[datetime] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取报工记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_code: 工单编码（模糊搜索）
            work_order_name: 工单名称（模糊搜索）
            operation_name: 工序名称（模糊搜索）
            worker_name: 操作工姓名（模糊搜索）
            worker_id: 操作工用户ID（我的报工）
            status: 审核状态
            reported_at_start: 报工开始时间
            reported_at_end: 报工结束时间

        Returns:
            List[ReportingRecordListResponse]: 报工记录列表
        """
        query = ReportingRecord.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        # 添加筛选条件
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(work_order_code__icontains=kw)
                | Q(work_order_name__icontains=kw)
                | Q(operation_name__icontains=kw)
                | Q(operation_code__icontains=kw)
                | Q(worker_name__icontains=kw)
                | Q(recorded_by_name__icontains=kw)
            )
        wc = (work_order_code or "").strip()
        if wc:
            query = query.filter(work_order_code__icontains=wc)
        wn = (work_order_name or "").strip()
        if wn:
            query = query.filter(work_order_name__icontains=wn)
        if operation_name:
            query = query.filter(operation_name__icontains=operation_name)
        if worker_name:
            query = query.filter(worker_name__icontains=worker_name)
        if worker_id is not None:
            query = query.filter(worker_id=int(worker_id))
        if client_channel:
            from core.utils.client_channel import normalize_client_channel

            ch = normalize_client_channel(client_channel)
            if ch:
                query = query.filter(client_channel=ch)
        if report_mode:
            mode = str(report_mode).strip().lower()
            if mode in ("self", "proxy", "team"):
                query = query.filter(report_mode=mode)
        if status:
            query = query.filter(status=status)
        if reported_at_start:
            query = query.filter(reported_at__gte=reported_at_start)
        if reported_at_end:
            query = query.filter(reported_at__lte=reported_at_end)

        total = await query.count()
        order_clause = order_by if order_by else "-reported_at"
        records = await query.offset(skip).limit(limit).order_by(order_clause).all()
        from core.services.approval.audit_record_enricher import enrich_items
        from apps.kuaizhizao.services.document_lifecycle_service import get_reporting_record_lifecycle

        # 批量补全产品名称/规格（同名产品靠规格区分）
        wo_ids = list({int(r.work_order_id) for r in records if getattr(r, "work_order_id", None)})
        wo_product_map: Dict[int, Dict[str, Any]] = {}
        if wo_ids:
            from apps.master_data.models.material import Material

            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=wo_ids,
                deleted_at__isnull=True,
            ).only("id", "product_id", "product_code", "product_name")
            product_ids = list({int(wo.product_id) for wo in work_orders if wo.product_id})
            spec_by_product: Dict[int, str] = {}
            if product_ids:
                materials = await Material.filter(
                    tenant_id=tenant_id,
                    id__in=product_ids,
                    deleted_at__isnull=True,
                ).only("id", "specification")
                for m in materials:
                    spec = (getattr(m, "specification", None) or "").strip()
                    if spec:
                        spec_by_product[int(m.id)] = spec
            for wo in work_orders:
                wo_product_map[int(wo.id)] = {
                    "product_name": (wo.product_name or "").strip() or None,
                    "product_code": (wo.product_code or "").strip() or None,
                    "material_spec": spec_by_product.get(int(wo.product_id)) if wo.product_id else None,
                }

        rows = []
        for record in records:
            resp = ReportingRecordListResponse.model_validate(record)
            resp.lifecycle = get_reporting_record_lifecycle(record)
            product_info = wo_product_map.get(int(record.work_order_id)) if record.work_order_id else None
            if product_info:
                resp.product_name = product_info.get("product_name")
                resp.product_code = product_info.get("product_code")
                resp.material_spec = product_info.get("material_spec")
            rows.append(resp)
        rows = await enrich_items(tenant_id, "reporting_record", rows)
        enriched = enrich_reporting_record_list_capabilities(records, rows)
        return {
            "data": [r.model_dump() for r in enriched],
            "total": total,
            "success": True,
        }

    async def approve_reporting_record(
        self,
        tenant_id: int,
        record_id: int,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> ReportingRecordResponse:
        """
        审核报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            approved_by: 审核人ID
            rejection_reason: 驳回原因（驳回时填写）

        Returns:
            ReportingRecordResponse: 更新后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 审核状态错误
        """
        should_try_direct_inbound = False
        reporting_record_id_for_inbound: Optional[int] = None
        async with in_transaction():
            record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
            )

            if not record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            if record.status != 'pending':
                raise ValidationError("只能审核待审核状态的报工记录")

            # 获取审核人信息
            approved_by_name = await self.get_user_name(approved_by)

            # 更新审核信息
            record.approved_at = resolve_business_datetime()
            record.approved_by = approved_by
            record.approved_by_name = approved_by_name

            # 根据是否有驳回原因设置状态
            if rejection_reason is not None and not str(rejection_reason).strip():
                raise ValidationError("驳回原因不能为空")

            if rejection_reason:
                record.status = 'rejected'
                record.rejection_reason = str(rejection_reason).strip()
            else:
                # 审核分离：报工人不可自审通过
                if int(approved_by) == int(getattr(record, "worker_id", 0) or 0):
                    raise BusinessLogicError("报工人不能审核通过自己的报工记录")
                record.status = 'approved'
                # 状态切回通过时，清理历史驳回原因，避免脏字段残留
                record.rejection_reason = None

            await record.save()

            is_rework_report = bool(getattr(record, "rework_order_id", None))

            # 如果审核通过，触发物料倒冲（返工报工不走原工单倒冲）
            if record.status == 'approved' and not is_rework_report:
                try:
                    from apps.kuaizhizao.services.backflush_service import BackflushService
                    backflush_svc = BackflushService()
                    await backflush_svc.backflush_materials(
                        tenant_id=tenant_id,
                        work_order_id=record.work_order_id,
                        report_id=record.id,
                        report_quantity=float(record.reported_quantity),
                        operation_id=record.operation_id,
                        operation_code=record.operation_code,
                        processed_by=approved_by,
                    )
                except Exception as e:
                    logger.warning(f"报工审核通过，但物料倒冲失败: {e}")

            if record.status == 'approved' and not is_rework_report:
                await self._update_work_order_progress(tenant_id, record.work_order_id)

            if record.status == "approved" and is_rework_report:
                await ReworkOrderService.on_rework_reporting_approved(
                    tenant_id,
                    record,
                    approved_by,
                    approved_by_name or "",
                )

            # 审核通过时自动累计模具使用次数（返工报工跳过）
            if record.status == 'approved' and not is_rework_report:
                work_order_op = await _resolve_work_order_operation_for_reporting(
                    tenant_id=tenant_id,
                    work_order_id=record.work_order_id,
                    operation_id=record.operation_id,
                )
                work_order = await WorkOrder.get_or_none(id=record.work_order_id, tenant_id=tenant_id)
                if work_order_op and work_order:
                    await self._create_mold_usage_from_reporting(
                        tenant_id=tenant_id,
                        work_order_operation=work_order_op,
                        work_order=work_order,
                        qualified_quantity=float(record.qualified_quantity),
                        reporting_record_id=record.id,
                        operator_name=record.worker_name,
                    )
                    
                    # 报工审核通过后触发质量检验需求
                    try:
                        await self._trigger_quality_inspection_from_reporting(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            work_order_operation=work_order_op,
                            reporting_record=record,
                            created_by=approved_by
                        )
                    except Exception as qc_err:
                        logger.warning(f"报工审核成功但触发质量检验失败：{qc_err}")

            if record.status == "approved" and not is_rework_report:
                should_try_direct_inbound = True
                reporting_record_id_for_inbound = record.id

            response = ReportingRecordResponse.model_validate(record)

        if should_try_direct_inbound and reporting_record_id_for_inbound is not None:
            inbound_result = await self._maybe_trigger_direct_finished_goods_inbound(
                tenant_id, reporting_record_id_for_inbound, approved_by
            )
        else:
            inbound_result = None

        if record.status == "approved":
            await self._refresh_performance_after_approved_reporting(tenant_id, record)

        return _attach_inbound_notices(response, inbound_result)

    async def revoke_reporting_approval(
        self,
        tenant_id: int,
        record_id: int,
        revoked_by: int
    ) -> ReportingRecordResponse:
        """
        撤销报工审核

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            revoked_by: 撤销人ID

        Returns:
            ReportingRecordResponse: 更新后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 状态错误
        """
        async with in_transaction():
            record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
            )

            if not record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            assert_reporting_record_capability(record, "revoke_approval")

            if record.status != 'approved':
                raise ValidationError("只有已审核通过的报工记录才可以撤回审核")

            # 更新记录状态
            record.status = 'pending'
            record.approved_at = None
            record.approved_by = None
            record.approved_by_name = None
            record.rejection_reason = None
            
            # 记录在备注中
            user_info = await self.get_user_info(revoked_by)
            revocation_note = f"\n[撤回审核] {to_api_isoformat(resolve_business_datetime())} 由 {user_info['name']} 撤回审核"
            if record.remarks:
                record.remarks += revocation_note
            else:
                record.remarks = revocation_note

            await record.save()

            # 重新计算工单进度（因为 status 变为 pending，_update_work_order_progress 只统计 approved）
            await self._update_work_order_progress(tenant_id, record.work_order_id)
            
            logger.info(f"撤回报工审核成功：报工记录ID {record_id}，操作人 {user_info['name']}")

            return ReportingRecordResponse.model_validate(record)

    async def batch_revoke_reporting_approval(
        self,
        tenant_id: int,
        record_ids: list[int],
        revoked_by: int
    ) -> dict:
        """
        批量撤回报工操作（撤销审核）

        Args:
            tenant_id: 组织ID
            record_ids: 报工记录ID列表
            revoked_by: 撤回人ID

        Returns:
            dict: 操作结果统计
        """
        if not record_ids:
            raise ValidationError("报工记录ID列表不能为空")
        if any((not isinstance(rid, int)) or rid <= 0 for rid in record_ids):
            raise ValidationError("报工记录ID必须为正整数")

        results = {
            "total": len(record_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }

        # 获取用户信息
        user_info = await self.get_user_info(revoked_by)
        revoked_by_name = user_info['name']
        now_str = to_api_isoformat(resolve_business_datetime())

        # 记录受影响的工单ID，用于最后刷新进度
        affected_work_order_ids = set()

        async with in_transaction():
            for rid in record_ids:
                try:
                    record = await ReportingRecord.get_or_none(id=rid, tenant_id=tenant_id)
                    if not record:
                        results["failed"] += 1
                        results["details"].append({"id": rid, "status": "failed", "reason": "记录不存在"})
                        continue

                    if record.status != 'approved':
                        results["failed"] += 1
                        results["details"].append({"id": rid, "status": "failed", "reason": f"当前状态为 {record.status}，无法撤回审核"})
                        continue

                    # 更新记录状态
                    record.status = 'pending'
                    record.approved_at = None
                    record.approved_by = None
                    record.approved_by_name = None
                    record.rejection_reason = None
                    
                    revocation_note = f"\n[批量撤回审核] {now_str} 由 {revoked_by_name} 撤回审核"
                    if record.remarks:
                        record.remarks += revocation_note
                    else:
                        record.remarks = revocation_note

                    await record.save()
                    affected_work_order_ids.add(record.work_order_id)
                    
                    results["success"] += 1
                    results["details"].append({"id": rid, "status": "success"})
                except Exception as e:
                    results["failed"] += 1
                    results["details"].append({"id": rid, "status": "failed", "reason": str(e)})

            # 批量刷新受影响工单的进度
            for wo_id in affected_work_order_ids:
                await self._update_work_order_progress(tenant_id, wo_id)

        return results

    async def delete_reporting_record(
        self,
        tenant_id: int,
        record_id: int
    ) -> None:
        """
        删除报工记录（软删除）

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 不允许删除的记录状态
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,
        )

        if not record:
            raise NotFoundError(f"报工记录不存在: {record_id}")

        # 检查是否可以删除
        if record.status == 'approved':
            raise ValidationError("已审核通过的报工记录不允许直接删除，请先撤销审核")

        def _dec_non_negative(value: Decimal) -> Decimal:
            """防御性兜底：删除回退后计数不允许小于 0。"""
            return value if value >= Decimal("0") else Decimal("0")

        async with in_transaction():
            # 获取工单工序并扣减计数
            work_order_op = await _resolve_work_order_operation_for_reporting(
                tenant_id=tenant_id,
                work_order_id=record.work_order_id,
                operation_id=record.operation_id,
            )
            if work_order_op:
                work_order_op.completed_quantity = _dec_non_negative((work_order_op.completed_quantity or Decimal('0')) - record.reported_quantity)
                work_order_op.qualified_quantity = _dec_non_negative((work_order_op.qualified_quantity or Decimal('0')) - record.qualified_quantity)
                work_order_op.unqualified_quantity = _dec_non_negative((work_order_op.unqualified_quantity or Decimal('0')) - record.unqualified_quantity)
                
                # 如果之前是已完成，变回进行中
                if work_order_op.status == 'completed':
                    work_order_op.status = 'in_progress'
                
                await work_order_op.save()

            # 获取工单：头表数量由末道工序行推导，不在此按报工行扣减
            work_order = await WorkOrder.get_or_none(id=record.work_order_id, tenant_id=tenant_id)
            if work_order:
                if work_order.status == 'completed':
                    work_order.status = 'in_progress'
                
                await work_order.save()

            # 当前仍为物理删除；表已具备 deleted_at，后续可改为软删除并统一查询过滤
            await record.delete()
            
            # 最后再次同步一次工单进度（确保稳健）
            await self._update_work_order_progress(tenant_id, record.work_order_id)

    async def get_reporting_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
        worker_id: Optional[int] = None,
    ) -> dict:
        """
        获取报工统计信息

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期
            worker_id: 操作工用户ID（可选，移动端「我的绩效」）

        Returns:
            dict: 统计信息
        """
        from tortoise.functions import Count, Sum
        from apps.kuaizhizao.services.first_pass_yield_service import compute_first_pass_yield_rate

        query = ReportingRecord.filter(tenant_id=tenant_id)
        if date_start:
            query = query.filter(reported_at__gte=date_start)
        if date_end:
            query = query.filter(reported_at__lte=date_end)
        if worker_id is not None:
            query = query.filter(worker_id=worker_id)

        total_count = await query.count()
        status_rows = (
            await query.group_by("status")
            .annotate(c=Count("id"))
            .values("status", "c")
        )
        status_map = {str(r["status"] or ""): int(r["c"] or 0) for r in status_rows}
        pending_count = status_map.get("pending", 0)
        approved_count = status_map.get("approved", 0)
        rejected_count = status_map.get("rejected", 0)

        totals_rows = await query.annotate(
            reported_q=Sum("reported_quantity"),
            qualified_q=Sum("qualified_quantity"),
            unqualified_q=Sum("unqualified_quantity"),
            hours_q=Sum("work_hours"),
        ).values("reported_q", "qualified_q", "unqualified_q", "hours_q")
        totals = totals_rows[0] if totals_rows else {}
        total_reported_quantity = Decimal(str(totals.get("reported_q") or 0))
        total_qualified_quantity = Decimal(str(totals.get("qualified_q") or 0))
        total_unqualified_quantity = Decimal(str(totals.get("unqualified_q") or 0))
        total_work_hours = Decimal(str(totals.get("hours_q") or 0))

        wage_rate = await self._get_reporting_estimated_wage_rate(tenant_id)
        qualification_rate = (
            float(total_qualified_quantity / total_reported_quantity * 100)
            if total_reported_quantity > 0
            else 0
        )

        fp_totals_rows = await query.filter(rework_order_id__isnull=True).annotate(
            reported_q=Sum("reported_quantity"),
            qualified_q=Sum("qualified_quantity"),
        ).values("reported_q", "qualified_q")
        fp_totals = fp_totals_rows[0] if fp_totals_rows else {}
        first_pass_reported_quantity = Decimal(str(fp_totals.get("reported_q") or 0))
        first_pass_qualified_quantity = Decimal(str(fp_totals.get("qualified_q") or 0))
        first_pass_yield_rate = compute_first_pass_yield_rate(
            float(first_pass_qualified_quantity),
            float(first_pass_reported_quantity),
        )

        avg_quantity_per_hour = (
            float(total_reported_quantity / total_work_hours) if total_work_hours > 0 else 0
        )
        unqualified_rate = (
            float(total_unqualified_quantity / total_reported_quantity * 100)
            if total_reported_quantity > 0
            else 0
        )

        op_rows = (
            await query.group_by("operation_name")
            .annotate(
                c=Count("id"),
                reported_q=Sum("reported_quantity"),
                qualified_q=Sum("qualified_quantity"),
                hours_q=Sum("work_hours"),
            )
            .order_by("-c")
            .limit(10)
            .values("operation_name", "c", "reported_q", "qualified_q", "hours_q")
        )
        op_fp_rows = (
            await query.filter(rework_order_id__isnull=True)
            .group_by("operation_name")
            .annotate(
                reported_q=Sum("reported_quantity"),
                qualified_q=Sum("qualified_quantity"),
            )
            .values("operation_name", "reported_q", "qualified_q")
        )
        op_fp_map = {
            r["operation_name"]: (
                Decimal(str(r["reported_q"] or 0)),
                Decimal(str(r["qualified_q"] or 0)),
            )
            for r in op_fp_rows
        }
        operation_stats_list = []
        for row in op_rows:
            op_name = row["operation_name"]
            reported_q = Decimal(str(row["reported_q"] or 0))
            qualified_q = Decimal(str(row["qualified_q"] or 0))
            hours_q = Decimal(str(row["hours_q"] or 0))
            fp_reported, fp_qualified = op_fp_map.get(op_name, (Decimal("0"), Decimal("0")))
            operation_stats_list.append({
                "operation_name": op_name,
                "count": int(row["c"] or 0),
                "reported_quantity": float(reported_q),
                "qualified_quantity": float(qualified_q),
                "work_hours": float(hours_q),
                "qualification_rate": float(qualified_q / reported_q * 100) if reported_q > 0 else 0,
                "first_pass_yield_rate": compute_first_pass_yield_rate(
                    float(fp_qualified), float(fp_reported)
                ),
            })

        worker_rows = (
            await query.group_by("worker_name")
            .annotate(
                c=Count("id"),
                reported_q=Sum("reported_quantity"),
                qualified_q=Sum("qualified_quantity"),
                hours_q=Sum("work_hours"),
            )
            .order_by("-c")
            .limit(10)
            .values("worker_name", "c", "reported_q", "qualified_q", "hours_q")
        )
        worker_fp_rows = (
            await query.filter(rework_order_id__isnull=True)
            .group_by("worker_name")
            .annotate(
                reported_q=Sum("reported_quantity"),
                qualified_q=Sum("qualified_quantity"),
            )
            .values("worker_name", "reported_q", "qualified_q")
        )
        worker_fp_map = {
            r["worker_name"]: (
                Decimal(str(r["reported_q"] or 0)),
                Decimal(str(r["qualified_q"] or 0)),
            )
            for r in worker_fp_rows
        }
        worker_stats_list = []
        for row in worker_rows:
            worker_name = row["worker_name"] or "—"
            reported_q = Decimal(str(row["reported_q"] or 0))
            qualified_q = Decimal(str(row["qualified_q"] or 0))
            hours_q = Decimal(str(row["hours_q"] or 0))
            fp_reported, fp_qualified = worker_fp_map.get(row["worker_name"], (Decimal("0"), Decimal("0")))
            worker_stats_list.append({
                "worker_name": worker_name,
                "count": int(row["c"] or 0),
                "reported_quantity": float(reported_q),
                "qualified_quantity": float(qualified_q),
                "work_hours": float(hours_q),
                "qualification_rate": float(qualified_q / reported_q * 100) if reported_q > 0 else 0,
                "first_pass_yield_rate": compute_first_pass_yield_rate(
                    float(fp_qualified), float(fp_reported)
                ),
            })

        return {
            "total_count": total_count,
            "pending_count": pending_count,
            "approved_count": approved_count,
            "rejected_count": rejected_count,
            "total_reported_quantity": float(total_reported_quantity),
            "total_qualified_quantity": float(total_qualified_quantity),
            "total_unqualified_quantity": float(total_unqualified_quantity),
            "total_work_hours": float(total_work_hours),
            "cumulative_hours": float(total_work_hours),
            "estimated_wages": float(total_work_hours * wage_rate),
            "qualification_rate": qualification_rate,
            "first_pass_yield_rate": first_pass_yield_rate,
            "first_pass_reported_quantity": float(first_pass_reported_quantity),
            "first_pass_qualified_quantity": float(first_pass_qualified_quantity),
            "unqualified_rate": unqualified_rate,
            "avg_quantity_per_hour": avg_quantity_per_hour,
            "efficiency": qualification_rate,
            "operation_stats": operation_stats_list,
            "worker_stats": worker_stats_list,
            "trends": {
                "hours": [120, 145, 138, 160, 155, 175, float(total_work_hours)],
                "wages": [1200, 1500, 1800, 1600, 2100, 1900, float(total_work_hours * wage_rate)],
                "efficiency": [qualification_rate] * 7,
            },
        }

    async def _create_mold_usage_from_reporting(
        self,
        tenant_id: int,
        work_order_operation: WorkOrderOperation,
        work_order: WorkOrder,
        qualified_quantity: float,
        reporting_record_id: int,
        operator_name: Optional[str] = None,
    ) -> None:
        """
        报工生效时自动创建模具归还单并累计使用次数。

        当工序分配了模具且合格数量>0时，根据模具腔数换算使用次数，创建 MoldReturn 并累加 mold.total_usage_count。
        使用 reporting_record_id 实现幂等，避免重复累计。
        """
        if not work_order_operation.assigned_mold_id or qualified_quantity <= 0:
            return
        try:
            from apps.kuaizhizao.models.mold import Mold
            from apps.kuaizhizao.services.mold_ops_service import MoldOpsService
            from apps.kuaizhizao.schemas.mold_ops import MoldReturnCreate

            mold = await Mold.filter(
                id=work_order_operation.assigned_mold_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not mold:
                return

            cavity_count = mold.cavity_count
            if cavity_count and cavity_count > 0:
                usage_count = max(1, math.ceil(qualified_quantity / cavity_count))
            else:
                usage_count = max(1, int(qualified_quantity))

            data = MoldReturnCreate(
                mold_id=mold.id,
                source_type="work_order",
                source_id=work_order.id,
                source_no=work_order.code,
                reporting_record_id=reporting_record_id,
                return_date=resolve_business_datetime(),
                usage_count=usage_count,
                operator_name=operator_name,
            )
            await MoldOpsService().return_service.create(
                tenant_id=tenant_id,
                data=data,
            )
        except Exception as e:
            logger.warning(f"报工自动累计模具使用次数失败: {e}")

    async def _sync_work_order_header_quantities_from_last_operation(
        self,
        tenant_id: int,
        work_order: WorkOrder,
    ) -> None:
        """
        将工单头的已完成/合格数量与「末道工序」行对齐。

        多道工序时，各工序报工合格数表示该工序产出，不能简单相加作为工单成品数量；
        工单维度应以 sequence 最大的工序为准：
        - completed_quantity：末道报工完成数（现场产出）
        - qualified_quantity：末道有效合格（方案质检为检验放行数，未检完不计）
        """
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            work_order.completed_quantity = Decimal("0")
            work_order.qualified_quantity = Decimal("0")
            work_order.unqualified_quantity = Decimal("0")
            return
        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        work_order.completed_quantity = last_op.completed_quantity or Decimal("0")
        from apps.kuaizhizao.services.operation_transfer_service import (
            build_operation_policy_cache,
            load_process_inspections_by_operation,
            resolve_operation_display_unqualified,
            resolve_operation_transfer_qualified,
        )

        master_ids = [
            int(last_op.operation_id)
            for last_op in [last_op]
            if last_op.operation_id is not None
        ]
        policy_cache = await build_operation_policy_cache(tenant_id, master_ids)
        inspections_by_op = await load_process_inspections_by_operation(
            tenant_id, int(work_order.id)
        )
        work_order.qualified_quantity = await resolve_operation_transfer_qualified(
            tenant_id,
            int(work_order.id),
            last_op,
            policy_cache=policy_cache,
            inspections_by_op=inspections_by_op,
        )
        work_order.unqualified_quantity = await resolve_operation_display_unqualified(
            tenant_id,
            int(work_order.id),
            last_op,
            policy_cache=policy_cache,
            inspections_by_op=inspections_by_op,
        )

    async def _update_work_order_progress(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        更新工单进度

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
        """
        # 更新工单
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,

        )

        if work_order:
            await sync_work_order_operations_completion(tenant_id, work_order_id)
            work_order = await WorkOrder.get_or_none(
                id=work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not work_order:
                return

            await self._sync_work_order_header_quantities_from_last_operation(tenant_id, work_order)

            await work_order.save()

            await self._sync_pending_inbound_receipts_if_needed(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
            )

    async def _update_work_order_unqualified_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order: Optional[WorkOrder] = None
    ) -> None:
        """
        将工单头数量字段与末道工序对齐（与工序卡展示口径一致）。

        不合格数量取自末道工序报工/过程检验，不再仅用报废记录覆盖。
        """
        if work_order is None:
            work_order = await WorkOrder.get_or_none(
                id=work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )

        if not work_order:
            return

        await self._sync_work_order_header_quantities_from_last_operation(tenant_id, work_order)

    async def record_scrap(
        self,
        tenant_id: int,
        reporting_record_id: int,
        scrap_data: ScrapRecordCreateFromReporting,
        created_by: int
    ) -> ScrapRecordResponse:
        """
        从报工记录创建报废记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            scrap_data: 报废记录创建数据
            created_by: 创建人ID

        Returns:
            ScrapRecordResponse: 创建的报废记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,

            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,

            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证报废数量不能超过报工记录的不合格数量
            if scrap_data.scrap_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"报废数量({scrap_data.scrap_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成报废单编码
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="SCRAP_RECORD_CODE",
                prefix=f"SC{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算总成本
            total_cost = Decimal("0")
            if scrap_data.unit_cost:
                total_cost = scrap_data.unit_cost * scrap_data.scrap_quantity

            # 创建报废记录
            scrap_record = await ScrapRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                scrap_quantity=scrap_data.scrap_quantity,
                unit_cost=scrap_data.unit_cost,
                total_cost=total_cost,
                scrap_reason=scrap_data.scrap_reason,
                scrap_type=scrap_data.scrap_type,
                warehouse_id=scrap_data.warehouse_id,
                warehouse_name=scrap_data.warehouse_name,
                status="draft",
                remarks=scrap_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新工单的不合格数量（从报废记录统计）
            await self._update_work_order_unqualified_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                work_order=work_order
            )
            await work_order.save()
            
            # 库存扣减（需要调用库存服务，待库存服务实现后补充）
            # 注意：由于系统中暂无独立的库存服务，库存扣减功能待后续实现
            # 如果需要立即实现，可以通过调用仓储管理服务或创建库存变动记录来实现
            if scrap_data.warehouse_id:
                logger.info(
                    f"报废记录 {code} 需要扣减库存，物料ID: {work_order.product_id}, "
                    f"仓库ID: {scrap_data.warehouse_id}, 数量: {scrap_data.scrap_quantity} "
                    f"（库存扣减功能待库存服务实现后补充）"
                )

            logger.info(f"创建报废记录成功: {code}, 工单: {work_order.code}, 报废数量: {scrap_data.scrap_quantity}")
            return ScrapRecordResponse.model_validate(scrap_record)

    async def record_defect(
        self,
        tenant_id: int,
        reporting_record_id: int,
        defect_data: DefectRecordCreateFromReporting,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从报工记录创建不良品记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            defect_data: 不良品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不良品记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        quality_params = (
            (await BusinessConfigService().get_business_config(tenant_id))
            .get("parameters", {})
            .get("quality", {})
        )
        if not quality_params.get("defect_handling", False):
            raise BusinessLogicError("当前组织未开启不良品处理，禁止创建不良品记录")
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证不良品数量不能超过报工记录的不合格数量
            if defect_data.defect_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"不良品数量({defect_data.defect_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                quarantine_location=defect_data.quarantine_location,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )
            created_id = int(defect_record.id)

            # 更新工单的不合格数量
            await self._update_work_order_unqualified_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                work_order=work_order
            )
            await work_order.save()

        from apps.kuaizhizao.services.defect_record_service import DefectRecordService

        defect_record = await DefectRecordService()._apply_disposition_after_persist(
            tenant_id=tenant_id,
            defect_id=created_id,
            updated_by=created_by,
            quarantine_location=defect_data.quarantine_location,
            quarantine_warehouse_id=getattr(defect_data, "quarantine_warehouse_id", None),
            stock_warehouse_id=getattr(defect_data, "stock_warehouse_id", None),
            downgrade_material_id=getattr(defect_data, "downgrade_material_id", None),
            downgrade_warehouse_id=getattr(defect_data, "downgrade_warehouse_id", None),
        )

        logger.info(
            f"创建不良品记录成功: {code}, 工单: {work_order.code}, "
            f"不良品数量: {defect_data.defect_quantity}, 处理方式: {defect_data.disposition}"
        )
        return DefectRecordResponse.model_validate(defect_record)

    async def correct_reporting_data(
        self,
        tenant_id: int,
        record_id: int,
        correct_data: ReportingRecordUpdate,
        corrected_by: int,
        correction_reason: str
    ) -> ReportingRecordResponse:
        """
        修正报工数据

        用于修正已提交的报工记录数据，需要记录修正原因和修正历史。

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            correct_data: 修正数据
            corrected_by: 修正人ID
            correction_reason: 修正原因（必填）

        Returns:
            ReportingRecordResponse: 修正后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已审核的记录不允许修正等）
        """
        if not correction_reason or not correction_reason.strip():
            raise ValidationError("修正原因不能为空")

        async with in_transaction():
            biz_config = await BusinessConfigService().get_business_config(tenant_id)
            data_correction_enabled = (
                biz_config.get("parameters", {})
                .get("reporting", {})
                .get("data_correction", False)
            )
            if not data_correction_enabled:
                raise BusinessLogicError("当前组织未开启报工数据修正功能")

            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,

            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            # 获取修正人信息
            user_info = await self.get_user_info(corrected_by)
            corrected_by_name = (
                str(user_info.get("name") or user_info.get("username") or corrected_by)
                if isinstance(user_info, dict)
                else str(corrected_by)
            )

            # 权限由统一权限控制源负责（路由/权限中台），服务层不做组织管理员等手写特判

            # 检查是否可以修正（可以根据业务需求调整规则）
            # 例如：只有待审核或已驳回的记录可以修正，或者所有记录都可以修正但需要审核
            # 这里假设所有记录都可以修正，但会在备注中记录修正历史
            if reporting_record.status == 'approved':
                # 已审核的记录也可以修正，但需要记录修正历史
                pass

            # 构建修正备注（记录修正历史）
            correction_note = (
                f"\n[数据修正] {to_api_isoformat(resolve_business_datetime())} "
                f"由 {corrected_by_name} 修正，原因：{correction_reason}"
            )
            if reporting_record.remarks:
                updated_remarks = reporting_record.remarks + correction_note
            else:
                updated_remarks = correction_note

            # 更新报工记录
            update_data = correct_data.model_dump(exclude_unset=True)

            # 数据修正仅允许业务数据，不允许直接改审核字段
            forbidden_fields = {"status", "approved_by", "approved_by_name", "rejection_reason"}
            touched_forbidden = forbidden_fields.intersection(update_data.keys())
            if touched_forbidden:
                raise ValidationError("报工数据修正不允许直接修改审核字段")

            # 数量合法性：不得为负，且合格+不合格不得超过报工数量
            reported_qty = update_data.get("reported_quantity", reporting_record.reported_quantity)
            qualified_qty = update_data.get("qualified_quantity", reporting_record.qualified_quantity)
            unqualified_qty = update_data.get("unqualified_quantity", reporting_record.unqualified_quantity)

            for _name, _value in (
                ("reported_quantity", reported_qty),
                ("qualified_quantity", qualified_qty),
                ("unqualified_quantity", unqualified_qty),
            ):
                if _value is not None and Decimal(str(_value)) < Decimal("0"):
                    raise ValidationError("报工数量相关字段不能为负数")

            if (
                reported_qty is not None
                and qualified_qty is not None
                and unqualified_qty is not None
                and (Decimal(str(qualified_qty)) + Decimal(str(unqualified_qty)) > Decimal(str(reported_qty)))
            ):
                raise ValidationError("合格数与不合格数之和不能超过报工数量")

            producer_fields = {"worker_id", "worker_name", "team_id", "team_name"}
            old_worker_id = reporting_record.worker_id
            old_reported_at = reporting_record.reported_at

            if producer_fields.intersection(update_data.keys()):
                worker_id_raw = update_data.get("worker_id", reporting_record.worker_id)
                team_id_raw = update_data.get("team_id", reporting_record.team_id)
                worker_id_int: Optional[int] = None
                if worker_id_raw is not None:
                    try:
                        worker_id_int = int(worker_id_raw)
                    except Exception:
                        raise ValidationError("报工操作工ID无效")
                team_id_int: Optional[int] = None
                if team_id_raw is not None:
                    try:
                        team_id_int = int(team_id_raw)
                    except Exception:
                        raise ValidationError("报工工作小组ID无效")

                if worker_id_int is None and team_id_int is None:
                    raise ValidationError("须指定生产人员或工作小组")

                if team_id_int is not None:
                    team_name = str(
                        update_data.get("team_name", reporting_record.team_name) or ""
                    ).strip()
                    if not team_name:
                        raise ValidationError("工作小组名称必填")
                    update_data["team_id"] = team_id_int
                    update_data["team_name"] = team_name
                    update_data["worker_id"] = None
                    update_data["worker_name"] = team_name
                else:
                    worker_name = str(
                        update_data.get("worker_name", reporting_record.worker_name) or ""
                    ).strip()
                    if not worker_name:
                        raise ValidationError("生产人员姓名必填")
                    update_data["worker_id"] = worker_id_int
                    update_data["worker_name"] = worker_name
                    update_data["team_id"] = None
                    update_data["team_name"] = None

                from core.utils.client_channel import resolve_report_mode

                update_data["report_mode"] = resolve_report_mode(
                    team_id=update_data.get("team_id"),
                    worker_id=update_data.get("worker_id"),
                    recorded_by=reporting_record.recorded_by,
                )

            # 与创建口径一致：工时允许为 0；不允许负数
            if "work_hours" in update_data:
                wh_corr = Decimal(str(update_data.get("work_hours") or 0))
                if wh_corr < 0:
                    raise ValidationError("报工工时不能为负数")
            for time_key in ("work_start_time", "work_end_time", "reported_at"):
                if time_key in update_data and update_data.get(time_key) is not None:
                    update_data[time_key] = coerce_business_datetime_to_utc(update_data[time_key])

            update_data['remarks'] = updated_remarks
            # ReportingRecord 当前模型未定义 updated_by / updated_by_name，
            # 仅在字段存在时写入，避免触发 ORM FieldError 导致 500。
            fields_map = getattr(getattr(ReportingRecord, "_meta", None), "fields_map", {}) or {}
            if "updated_by" in fields_map:
                update_data["updated_by"] = corrected_by
            if "updated_by_name" in fields_map:
                update_data["updated_by_name"] = corrected_by_name

            await ReportingRecord.filter(
                tenant_id=tenant_id,
                id=record_id
            ).update(**update_data)

            # 重新获取更新后的记录
            updated_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,

            )

            if not updated_record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            # 如果修正了数量相关字段，重新计算工单进度
            # 检查是否修改了数量相关字段
            quantity_fields = ['reported_quantity', 'qualified_quantity', 'unqualified_quantity']
            update_data_dict = correct_data.model_dump(exclude_unset=True)
            has_quantity_change = any(field in update_data_dict for field in quantity_fields)
            
            if has_quantity_change:
                # 如果修正了数量，重新计算工单进度
                await self._update_work_order_progress(
                    tenant_id=tenant_id,
                    work_order_id=updated_record.work_order_id
                )
                logger.info(f"报工记录 {record_id} 修正后，已重新计算工单 {updated_record.work_order_id} 的进度")

            producer_changed = producer_fields.intersection(update_data_dict.keys())
            reported_at_changed = "reported_at" in update_data_dict

            if producer_changed:
                work_order_operation = await _resolve_work_order_operation_for_reporting(
                    tenant_id=tenant_id,
                    work_order_id=int(updated_record.work_order_id),
                    operation_id=int(updated_record.operation_id),
                )
                if work_order_operation:
                    _sync_operation_assigned_producer_from_reporting(
                        work_order_operation,
                        worker_id=updated_record.worker_id,
                        worker_name=updated_record.worker_name,
                        team_id=updated_record.team_id,
                        team_name=updated_record.team_name,
                    )
                    await work_order_operation.save()

            if updated_record.status == "approved" and (producer_changed or reported_at_changed):
                from apps.master_data.services.performance_calc_service import PerformanceCalcService

                if old_worker_id and (
                    (producer_changed and int(old_worker_id) != int(updated_record.worker_id or 0))
                    or reported_at_changed
                ):
                    old_period = PerformanceCalcService._period_from_reported_at(old_reported_at)
                    if old_period:
                        await PerformanceCalcService.refresh_employee_period_from_reporting(
                            tenant_id,
                            int(old_worker_id),
                            old_period,
                        )
                await self._refresh_performance_after_approved_reporting(tenant_id, updated_record)
                if (
                    reported_at_changed
                    and old_worker_id
                    and updated_record.worker_id
                    and int(old_worker_id) == int(updated_record.worker_id)
                    and old_reported_at
                    and updated_record.reported_at
                ):
                    new_period = PerformanceCalcService._period_from_reported_at(updated_record.reported_at)
                    old_period = PerformanceCalcService._period_from_reported_at(old_reported_at)
                    if new_period and old_period and new_period != old_period:
                        await PerformanceCalcService.refresh_employee_period_from_reporting(
                            tenant_id,
                            int(old_worker_id),
                            old_period,
                        )

            # 记录详细的修正历史（在remarks字段中记录，后续可以创建单独的修正历史表）
            # 修正历史已记录在remarks字段中（见上面的correction_note）

            logger.info(f"报工记录 {record_id} 修正成功，修正人: {corrected_by_name}, 原因: {correction_reason}")
            return ReportingRecordResponse.model_validate(updated_record)
    async def _trigger_quality_inspection_from_reporting(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        work_order_operation: WorkOrderOperation,
        reporting_record: ReportingRecord,
        created_by: int
    ) -> None:
        """从报工记录触发质量检验需求"""
        from apps.kuaizhizao.services.quality_automation_service import QualityAutomationService

        await QualityAutomationService().maybe_auto_create_ipqc_fqc_from_reporting(
            tenant_id=tenant_id,
            work_order=work_order,
            work_order_operation=work_order_operation,
            reporting_record=reporting_record,
            created_by=created_by,
        )
