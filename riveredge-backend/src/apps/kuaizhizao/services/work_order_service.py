"""
工单业务服务模块

提供工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

Author: Luigi Lu
Date: 2025-01-01
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union
from decimal import Decimal

from tortoise.exceptions import IntegrityError
from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from core.utils.timezone_utils import (
    coerce_business_datetime_to_utc,
    now_utc,
    resolve_business_datetime,
    to_api_isoformat,
    today_site_str,
)

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.services.document_action_policy.work_order import (
    assert_work_order_capability,
    derive_work_order_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_work_order_capabilities_on_response,
)
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse,
    WorkOrderSplitRequest,
    WorkOrderSplitResponse,
    WorkOrderOperationCreate,
    WorkOrderOperationUpdate,
    WorkOrderOperationResponse,
    WorkOrderOperationsUpdateRequest,
    WorkOrderFreezeRequest,
    WorkOrderUnfreezeRequest,
    WorkOrderPriorityRequest,
    WorkOrderBatchPriorityRequest,
    WorkOrderSchedulingQuickActionRequest,
    WorkOrderMergeRequest,
    WorkOrderMergeResponse,
    WorkOrderOperationDispatch,
    DefectTypeMinimal,
    DefaultOperatorSnapshot,
    WorkOrderKittingAnalysisResponse,
    MaterialKittingItem,
    KittingRelatedWorkOrderSummary,
    KittingRelatedOutsourceWorkOrderSummary,
    KittingSupplyProgress,
    MaterialLocationInfo,
)
from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.services.work_order_tracking_service import (
    WorkOrderTrackingService,
    TRACKING_SERIAL,
    TRACKING_BOTH,
)
from apps.kuaizhizao.utils.inventory_helper import (
    get_material_available_quantity,
    get_material_detailed_locations,
)
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.services.document_timing_service import DocumentTimingService
from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.process import ProcessRoute, Operation
from apps.master_data.services.material_product_process_service import (
    MaterialProductProcessService,
)
from apps.master_data.models.factory import Workshop, WorkCenter, Workstation, WorkGroup
from apps.kuaizhizao.models.equipment import Equipment
from apps.master_data.services.process_service import batch_get_operation_defect_types_via_table
from core.services.business.code_generation_service import CodeGenerationService
from apps.kuaizhizao.constants import DocumentStatus
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_CUSTOMER_PROVIDED,
    SOURCE_TYPE_CONFIGURE,
)
from loguru import logger
from infra.services.business_config_service import BusinessConfigService
from infra.models.user import User


async def _batch_sop_for_master_operations(
    tenant_id: int,
    *,
    product_id: Optional[int],
    master_operation_ids: Iterable[int],
) -> Dict[int, Any]:
    """
    批量解析工单工序卡所需 SOP（与 ProcessService.get_sop_for_reporting 规则一致），
    避免按工序循环重复加载工单产品/物料。
    """
    from apps.master_data.models.process import SOP
    from apps.master_data.schemas.process_schemas import SOPResponse

    unique_ids = sorted({int(i) for i in master_operation_ids if i is not None})
    if not unique_ids:
        return {}

    material_uuid: Optional[str] = None
    group_uuid: Optional[str] = None
    if product_id:
        material = await Material.filter(
            id=int(product_id),
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        if material:
            material_uuid = str(material.uuid)
            group_id = getattr(material, "group_id", None)
            if group_id:
                group = await MaterialGroup.filter(
                    id=int(group_id),
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if group:
                    group_uuid = str(group.uuid)

    material_sops: List[Any] = []
    group_sops: List[Any] = []
    if material_uuid:
        material_sops = await SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            material_uuids__contains=[material_uuid],
        ).prefetch_related("operation").all()
    if group_uuid:
        group_sops = await SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            material_group_uuids__contains=[group_uuid],
        ).prefetch_related("operation").all()
    op_sops = await SOP.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
        is_active=True,
        operation_id__in=unique_ids,
    ).prefetch_related("operation").all()

    def _pick(sops: List[Any], op_id: int) -> Any:
        exact = sorted(
            (s for s in sops if getattr(s, "operation_id", None) == op_id),
            key=lambda s: str(getattr(s, "code", "") or ""),
        )
        if exact:
            return exact[0]
        unbound = sorted(
            (s for s in sops if getattr(s, "operation_id", None) is None),
            key=lambda s: str(getattr(s, "code", "") or ""),
        )
        return unbound[0] if unbound else None

    result: Dict[int, Any] = {}
    for op_id in unique_ids:
        sop = _pick(material_sops, op_id) if material_sops else None
        if sop is None and group_sops:
            sop = _pick(group_sops, op_id)
        if sop is None:
            op_only = sorted(
                (s for s in op_sops if getattr(s, "operation_id", None) == op_id),
                key=lambda s: str(getattr(s, "code", "") or ""),
            )
            sop = op_only[0] if op_only else None
        if sop is not None:
            result[op_id] = SOPResponse.model_validate(sop)
    return result


async def _batch_default_operators_snapshots_by_master_operation_id(
    tenant_id: int,
    master_operation_ids: List[int],
) -> Dict[int, List[DefaultOperatorSnapshot]]:
    """按 master Operation.id 批量解析工序档案中的默认生产人员（含 uuid，供前端下拉与默认选中）。"""
    if not master_operation_ids:
        return {}
    uniq = list({int(x) for x in master_operation_ids if x is not None})
    if not uniq:
        return {}
    master_ops = await Operation.filter(
        tenant_id=tenant_id,
        id__in=uniq,
        deleted_at__isnull=True,
    ).all()
    all_user_ids: List[int] = []
    raw_ids_by_master: Dict[int, List[int]] = {}
    for mo in master_ops:
        raw = getattr(mo, "default_operator_ids", None) or []
        ids: List[int] = []
        if isinstance(raw, list):
            for x in raw:
                try:
                    ids.append(int(x))
                except (TypeError, ValueError):
                    continue
        raw_ids_by_master[mo.id] = ids
        all_user_ids.extend(ids)
    uid_set = list({i for i in all_user_ids if i})
    users = (
        await User.filter(
            tenant_id=tenant_id,
            id__in=uid_set,
            deleted_at__isnull=True,
        ).all()
        if uid_set
        else []
    )
    user_by_id = {u.id: u for u in users}
    out: Dict[int, List[DefaultOperatorSnapshot]] = {}
    for mo in master_ops:
        snaps: List[DefaultOperatorSnapshot] = []
        for uid in raw_ids_by_master.get(mo.id, []):
            u = user_by_id.get(uid)
            if not u:
                continue
            snaps.append(
                DefaultOperatorSnapshot(
                    id=u.id,
                    uuid=str(getattr(u, "uuid", "") or ""),
                    name=str(u.full_name or u.username or str(u.id)),
                )
            )
        out[mo.id] = snaps
    return out


def _parse_assigned_worker_ids(
    raw_ids: Any,
    fallback_worker_id: Optional[int] = None,
) -> List[int]:
    """解析派工人员 ID 列表，去重并保持顺序。"""
    out: List[int] = []
    if isinstance(raw_ids, list):
        for x in raw_ids:
            try:
                uid = int(x)
            except (TypeError, ValueError):
                continue
            if uid > 0 and uid not in out:
                out.append(uid)
    if not out and fallback_worker_id is not None:
        try:
            uid = int(fallback_worker_id)
        except (TypeError, ValueError):
            uid = 0
        if uid > 0:
            out.append(uid)
    return out


async def _resolve_assigned_worker_fields(
    tenant_id: int,
    worker_ids: List[int],
) -> Tuple[List[int], Optional[int], Optional[str]]:
    """解析派工人员列表，返回 (ids, primary_id, joined_names)。"""
    if not worker_ids:
        return [], None, None
    users = await User.filter(
        tenant_id=tenant_id,
        id__in=worker_ids,
        deleted_at__isnull=True,
    ).all()
    user_by_id = {u.id: u for u in users}
    ordered_ids: List[int] = []
    names: List[str] = []
    for uid in worker_ids:
        if uid in ordered_ids:
            continue
        u = user_by_id.get(uid)
        if not u:
            continue
        ordered_ids.append(uid)
        name = str(u.full_name or u.username or uid).strip()
        if name:
            names.append(name)
    if not ordered_ids:
        return [], None, None
    return ordered_ids, ordered_ids[0], ("、".join(names) if names else None)


async def _resolve_sales_order_snapshot_fields(
    tenant_id: int,
    sales_order_id: Optional[int],
    sales_order_code: Optional[str],
    sales_order_name: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """仅有 sales_order_id 时从销售订单主表补全编号/名称，便于列表与详情展示。"""
    if not sales_order_id:
        return sales_order_code, sales_order_name
    if sales_order_code and sales_order_name:
        return sales_order_code, sales_order_name
    so = await SalesOrder.get_or_none(
        id=sales_order_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not so:
        return sales_order_code, sales_order_name
    code = sales_order_code or so.order_code
    name = sales_order_name or (
        f"{so.order_code} - {so.customer_name}" if so.customer_name else so.order_code
    )
    return code, name


def _max_reportable_quantity_for_op(work_order: WorkOrder, op: WorkOrderOperation) -> Decimal:
    from apps.kuaizhizao.services.over_report_rules import max_completed_quantity_for_plan, tuple_from_model

    plan_qty = work_order.quantity or Decimal("0")
    om, ov = tuple_from_model(op)
    return max_completed_quantity_for_plan(plan_qty, om, ov)


# 交期延期检测：与菜单工单「逾期」徽章同一口径（排除终态，不按白名单漏掉「执行中」等）
WORK_ORDER_DELAY_EXCLUDED_STATUSES = (
    "completed",
    "已完成",
    "COMPLETED",
    "cancelled",
    "已取消",
    "CANCELLED",
    "split",
    "已拆分",
    "SPLIT",
)

# 在制工单（缺料检测等场景）
WORK_ORDER_IN_PROGRESS_STATUS = (
    "in_progress",
    "进行中",
    "执行中",
    "生产中",
    "released",
    "已下达",
    "IN_PROGRESS",
    "RELEASED",
)


_SCHEDULABLE_WO_STATUSES = frozenset({"draft", "released", "in_progress"})


def _business_datetimes_equal(a: Any, b: Any) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return coerce_business_datetime_to_utc(a) == coerce_business_datetime_to_utc(b)


def _is_schedulable_work_order_status(status: Optional[str]) -> bool:
    from apps.kuaizhizao.constants import normalize_status

    normalized = normalize_status(str(status or "")).lower()
    return normalized in _SCHEDULABLE_WO_STATUSES


def _referenced_work_order_operation_ids(operations: Iterable[Any]) -> set[int]:
    """从工序批量更新 payload 收集已引用的工单工序行 id。"""
    referenced: set[int] = set()
    for op_data in operations:
        wo_op_id = getattr(op_data, "id", None)
        if wo_op_id is not None:
            referenced.add(int(wo_op_id))
    return referenced


def _match_existing_work_order_operation(
    op_data: Any,
    existing_operations: list[WorkOrderOperation],
    used_existing_ids: set[int],
) -> Optional[WorkOrderOperation]:
    """匹配清单行到既有工单工序：有行 id 时只按 id；否则按主数据 operation_id（原序号）。"""
    wo_op_id = getattr(op_data, "id", None)
    if wo_op_id is not None:
        target_id = int(wo_op_id)
        for eop in existing_operations:
            if eop.id == target_id and eop.id not in used_existing_ids and eop.deleted_at is None:
                return eop
        return None
    payload_master_id = int(op_data.operation_id)
    for eop in sorted(existing_operations, key=lambda o: (o.sequence or 0, o.id or 0)):
        if eop.id in used_existing_ids or eop.deleted_at is not None:
            continue
        if int(eop.operation_id) == payload_master_id:
            return eop
    return None


def _work_order_operation_ids_to_remove(
    existing_operations: Iterable[WorkOrderOperation],
    reported_operation_ids: set[int],
    matched_existing_ids: set[int],
) -> list[int]:
    """返回应软删的工单工序 id（未报工且未匹配到新清单）。"""
    to_remove: list[int] = []
    for op in existing_operations:
        if op.deleted_at is not None:
            continue
        if op.id in reported_operation_ids:
            continue
        if op.id not in matched_existing_ids:
            to_remove.append(op.id)
    return to_remove


async def _soft_delete_work_order_operation_row(
    op: WorkOrderOperation,
    updated_by: int,
    user_name: str,
) -> None:
    """软删工单工序并释放 (tenant, work_order, sequence) 唯一槽位。"""
    op.deleted_at = now_utc()
    op.sequence = -int(op.id)
    op.updated_by = updated_by
    op.updated_by_name = user_name
    await op.save()


def _reported_work_order_operation_content_changed(
    existing_op: WorkOrderOperation,
    op_data: Any,
) -> bool:
    """已报工工序是否被改动了业务内容（序号重排不算）。"""
    if int(existing_op.operation_id) != int(op_data.operation_id):
        return True
    if str(existing_op.operation_code or "") != str(getattr(op_data, "operation_code", None) or ""):
        return True
    if str(existing_op.operation_name or "") != str(getattr(op_data, "operation_name", None) or ""):
        return True
    return False


_PLANNED_DATES_LOCKED_WO_STATUSES = frozenset({"completed", "cancelled", "split"})


def _is_work_order_planned_dates_locked_status(status: Optional[str]) -> bool:
    from apps.kuaizhizao.constants import normalize_status

    normalized = normalize_status(str(status or "")).lower()
    return normalized in _PLANNED_DATES_LOCKED_WO_STATUSES


def _assert_work_order_planned_dates_unchanged_or_editable(
    work_order: WorkOrder,
    update_data: Dict[str, Any],
) -> None:
    if not _is_work_order_planned_dates_locked_status(str(work_order.status or "")):
        return
    for field in ("planned_start_date", "planned_end_date"):
        if field not in update_data:
            continue
        if not _business_datetimes_equal(update_data[field], getattr(work_order, field, None)):
            raise BusinessLogicError("已结束工单不可修改计划开始或计划结束时间")


def _normalize_naive_local_datetime(value: datetime) -> datetime:
    """比较用：统一为站点墙钟 naive（勿用服务器本机时区）。

    aware：按瞬时转到站点时区后剥 tz；naive：视为已是站点墙钟（历史业务字段口径）。
    """
    from core.utils.timezone_utils import site_timezone_name
    from zoneinfo import ZoneInfo

    if value.tzinfo is not None:
        return value.astimezone(ZoneInfo(site_timezone_name())).replace(tzinfo=None)
    return value


def _material_shortage_block_applies(block_level: int, stage: str) -> bool:
    """缺料拦截级别是否命中当前阶段。"""
    stage_map = {
        "release": 1,
        "operation_start": 2,
        "reporting": 3,
    }
    required_level = stage_map.get(stage, 999)
    return int(block_level or 0) >= required_level


class WorkOrderService(AppBaseService[WorkOrder]):
    """
    工单服务类

    处理工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(WorkOrder)

    async def _is_work_order_param_enabled(self, tenant_id: int, key: str, default: bool = False) -> bool:
        config = await BusinessConfigService().get_business_config(tenant_id)
        return bool(
            config.get("parameters", {})
            .get("work_order", {})
            .get(key, default)
        )

    @staticmethod
    def _get_production_return_service():
        from apps.kuaizhizao.services.warehouse_service import ProductionReturnService

        return ProductionReturnService()

    async def _batch_work_order_downstream_push_progress(
        self,
        tenant_id: int,
        work_orders: List[WorkOrder],
    ) -> Dict[int, float]:
        """
        批量计算工单完工进度（0-100）：
        以最后一道工序的「有效合格 / 工单计划数量」。
        方案质检用过程检验放行数，未检完不得显示 100%。
        """
        wo_by_id = {int(wo.id): wo for wo in work_orders if wo.id is not None}
        wo_ids = list(wo_by_id.keys())
        if not wo_ids:
            return {}

        op_rows = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).all()

        last_op_by_wo: Dict[int, WorkOrderOperation] = {}
        for op in op_rows:
            if op.work_order_id is None:
                continue
            wo_id = int(op.work_order_id)
            prev = last_op_by_wo.get(wo_id)
            if prev is None or int(op.sequence or 0) > int(prev.sequence or 0):
                last_op_by_wo[wo_id] = op

        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.services.operation_transfer_service import (
            build_operation_policy_cache,
            resolve_operation_transfer_qualified,
        )

        master_op_ids = [
            int(op.operation_id)
            for op in last_op_by_wo.values()
            if op.operation_id is not None
        ]
        policy_cache = await build_operation_policy_cache(tenant_id, master_op_ids)

        insp_rows = await ProcessInspection.filter(
            tenant_id=tenant_id,
            work_order_id__in=wo_ids,
            deleted_at__isnull=True,
        ).all()
        inspections_by_wo_master: Dict[int, Dict[int, list]] = {}
        for row in insp_rows:
            wid = getattr(row, "work_order_id", None)
            oid = getattr(row, "operation_id", None)
            if wid is None or oid is None:
                continue
            inspections_by_wo_master.setdefault(int(wid), {}).setdefault(int(oid), []).append(row)

        def _clamp(pct: float) -> float:
            if pct < 0:
                return 0.0
            if pct > 100:
                return 100.0
            return round(pct, 1)

        result: Dict[int, float] = {}
        for wo_id, wo in wo_by_id.items():
            planned = float(wo.quantity or 0)
            if planned <= 0:
                result[wo_id] = 0.0
                continue
            last_op = last_op_by_wo.get(wo_id)
            if last_op is None:
                result[wo_id] = 0.0
                continue
            effective = await resolve_operation_transfer_qualified(
                tenant_id,
                wo_id,
                last_op,
                policy_cache=policy_cache,
                inspections_by_op=inspections_by_wo_master.get(wo_id),
            )
            result[wo_id] = _clamp((float(effective) / planned) * 100.0)
        return result

    @staticmethod
    async def has_confirmed_picking_for_work_order(tenant_id: int, work_order_id: int) -> bool:
        """是否存在已确认的正式发料领料单（排除历史叫料备料转移型单据）。"""
        from apps.kuaizhizao.utils.picking_posting import filter_gi_picking_ids

        confirmed_statuses = ["已领料", "已确认", "confirmed", "picked"]
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=confirmed_statuses,
            deleted_at__isnull=True,
        ).all()
        return bool(filter_gi_picking_ids(pickings))

    @staticmethod
    async def assert_confirmed_picking_before_operation_start_if_required(
        tenant_id: int,
        work_order_id: int,
        *,
        action_label: str = "开工",
    ) -> None:
        """流程参数「开工前必须确认领料」：所有制造模式均生效。"""
        policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
        if not policy.get("require_confirmed_picking_before_operation_start", False):
            return
        if not await WorkOrderService.has_confirmed_picking_for_work_order(tenant_id, work_order_id):
            raise BusinessLogicError(
                f"未确认正式领料，禁止{action_label}："
                "请先确认该工单的生产领料单（线边备料/补料到线边不算正式发料）"
            )

    async def _match_process_route_for_material(
        self,
        tenant_id: int,
        material_id: int
    ) -> Optional[ProcessRoute]:
        """
        为物料自动匹配工艺路线（与 MaterialProductProcessService.resolve_process_route_for_material 一致）。
        """
        material = await Material.get_or_none(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not material:
            return None

        process_route = await MaterialProductProcessService.resolve_process_route_for_material(
            tenant_id, material_id
        )
        if process_route:
            logger.info(
                f"物料 {material.main_code or material.code} 匹配工艺路线: {process_route.code}"
            )
            return process_route

        logger.warning(f"物料 {material.main_code or material.code} 未找到匹配的工艺路线")
        return None

    async def _generate_work_order_operations_from_route(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        process_route: ProcessRoute,
        created_by: int,
        *,
        operation_sequence: Optional[Any] = None,
    ) -> List[WorkOrderOperation]:
        """
        根据工艺路线（或物料产品工艺序列）自动生成工单工序单
        
        Args:
            tenant_id: 组织ID
            work_order: 工单对象
            process_route: 工艺路线对象
            created_by: 创建人ID
            operation_sequence: 优先使用的产品工艺/覆盖序列；缺省则用路线模板
            
        Returns:
            List[WorkOrderOperation]: 生成的工单工序单列表
        """
        sequence_data = (
            operation_sequence
            if operation_sequence is not None
            else process_route.operation_sequence
        )
        if not sequence_data:
            logger.warning(f"工艺路线 {process_route.code} 没有可用工序序列")
            return []
        
        # 获取创建人信息
        user_info = await self.get_user_info(created_by)
        
        # 解析工序序列（支持多种前端保存格式）
        operation_list = []
        
        if isinstance(sequence_data, list):
            # 列表格式：[{"operation_id": 1, "sequence": 1, ...}, ...] 或 [{"uuid": "..."}, ...]
            for item in sequence_data:
                if isinstance(item, dict):
                    op_id = item.get("operation_id") or item.get("operationId")
                    op_uuid = item.get("uuid") or item.get("operation_uuid")
                    sequence = item.get("sequence", len(operation_list) + 1)
                    operation_list.append({
                        "operation_id": op_id,
                        "operation_uuid": op_uuid,
                        "sequence": sequence,
                        "extra_data": item  # 保存额外数据（如workshop_id, work_center_id等）
                    })
        elif isinstance(sequence_data, dict):
            # 字典格式：{"operations": [...], "sequence": [...]}（前端工艺路线页面保存格式）
            if "operations" in sequence_data and isinstance(sequence_data["operations"], list):
                ops = sequence_data["operations"]
                seq_uuids = sequence_data.get("sequence")
                # 前端格式：{"sequence": [uuid1, uuid2], "operations": [{uuid, code, name}, ...]}，两者顺序一致
                if isinstance(seq_uuids, list) and seq_uuids:
                    for idx, op_uuid in enumerate(seq_uuids, 1):
                        op_obj = next((o for o in ops if isinstance(o, dict) and (o.get("uuid") or o.get("operation_uuid")) == op_uuid), None)
                        if op_obj:
                            op_id = op_obj.get("operation_id") or op_obj.get("operationId")
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": op_uuid if isinstance(op_uuid, str) else (op_obj.get("uuid") or op_obj.get("operation_uuid")),
                                "sequence": idx,
                                "extra_data": op_obj
                            })
                        elif isinstance(op_uuid, str):
                            operation_list.append({
                                "operation_id": None,
                                "operation_uuid": op_uuid,
                                "sequence": idx,
                                "extra_data": {}
                            })
                else:
                    for idx, op_obj in enumerate(ops, 1):
                        if isinstance(op_obj, dict):
                            op_id = op_obj.get("operation_id") or op_obj.get("operationId")
                            op_uuid = op_obj.get("uuid") or op_obj.get("operation_uuid")
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": op_uuid,
                                "sequence": op_obj.get("sequence", idx),
                                "extra_data": op_obj
                            })
            elif "sequence" in sequence_data and isinstance(sequence_data["sequence"], list):
                # 仅 sequence 数组（UUID 列表）
                for idx, op_uuid in enumerate(sequence_data["sequence"], 1):
                    if isinstance(op_uuid, str):
                        operation_list.append({
                            "operation_id": None,
                            "operation_uuid": op_uuid,
                            "sequence": idx,
                            "extra_data": {}
                        })
            elif "operation_ids" in sequence_data or "operationIds" in sequence_data:
                op_ids = sequence_data.get("operation_ids") or sequence_data.get("operationIds", [])
                for idx, op_id in enumerate(op_ids, 1):
                    operation_list.append({
                        "operation_id": op_id,
                        "operation_uuid": None,
                        "sequence": idx,
                        "extra_data": {}
                    })
            else:
                # 键值对格式
                for key, value in sequence_data.items():
                    if isinstance(value, dict):
                        op_id = value.get("operation_id") or value.get("operationId") or (int(key) if key.isdigit() else None)
                        op_uuid = value.get("uuid") or value.get("operation_uuid")
                        sequence = value.get("sequence", len(operation_list) + 1)
                        operation_list.append({
                            "operation_id": op_id,
                            "operation_uuid": op_uuid,
                            "sequence": sequence,
                            "extra_data": value
                        })
                    else:
                        op_id = int(key) if key.isdigit() else None
                        if op_id:
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": None,
                                "sequence": len(operation_list) + 1,
                                "extra_data": {}
                            })
        
        # 按序列排序
        operation_list.sort(key=lambda x: x["sequence"])
        
        # 解析 UUID 为 operation_id（前端可能只存 uuid）
        op_uuids = [op["operation_uuid"] for op in operation_list if op.get("operation_uuid") and not op.get("operation_id")]
        if op_uuids:
            ops_by_uuid = await Operation.filter(
                uuid__in=op_uuids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            uuid_to_id = {o.uuid: o.id for o in ops_by_uuid}
            for op in operation_list:
                if not op.get("operation_id") and op.get("operation_uuid"):
                    op["operation_id"] = uuid_to_id.get(op["operation_uuid"])
        
        # 获取所有工序信息
        operation_ids = [op["operation_id"] for op in operation_list if op["operation_id"]]
        operations = await Operation.filter(
            id__in=operation_ids,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        operation_map = {op.id: op for op in operations}

        # 批量获取默认资源名称
        all_user_ids = set()
        all_team_ids = set()
        all_workshop_ids = set()
        all_work_center_ids = set()
        all_station_ids = set()
        all_eq_ids = set()

        for op in operations:
            if op.default_operator_ids: all_user_ids.update(op.default_operator_ids)
            if op.default_team_ids: all_team_ids.update(op.default_team_ids)
            if op.default_workshop_ids: all_workshop_ids.update(op.default_workshop_ids)
            if op.default_work_center_ids: all_work_center_ids.update(op.default_work_center_ids)
            if hasattr(op, "default_station_ids") and op.default_station_ids: all_station_ids.update(op.default_station_ids)
            if op.default_equipment_ids: all_eq_ids.update(op.default_equipment_ids)

        user_names = {u.id: (u.full_name or u.username) for u in await User.filter(id__in=list(all_user_ids)).all()} if all_user_ids else {}
        team_names = {t.id: t.name for t in await WorkGroup.filter(id__in=list(all_team_ids)).all()} if all_team_ids else {}
        workshop_names = {w.id: w.name for w in await Workshop.filter(id__in=list(all_workshop_ids)).all()} if all_workshop_ids else {}
        center_names = {c.id: c.name for c in await WorkCenter.filter(id__in=list(all_work_center_ids)).all()} if all_work_center_ids else {}
        station_names = {s.id: s.name for s in await Workstation.filter(id__in=list(all_station_ids)).all()} if all_station_ids else {}
        eq_names = {e.id: e.name for e in await Equipment.filter(id__in=list(all_eq_ids)).all()} if all_eq_ids else {}

        from apps.kuaizhizao.services.over_report_rules import (
            OVER_REPORT_NONE,
            merge_over_report_layers,
            tuple_from_model,
            parse_over_report_from_extra,
            extra_has_over_report_keys,
        )

        material_row = await Material.get_or_none(
            id=work_order.product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        mat_t = tuple_from_model(material_row)
        route_def_t = tuple_from_model(process_route)
        wo_head_t = tuple_from_model(work_order)
        
        from apps.kuaizhizao.utils.work_order_operation_scheduling import (
            build_operation_time_slots,
            operation_total_hours,
        )

        prepared_ops: List[Dict[str, Any]] = []
        for op_data in operation_list:
            op_id = op_data["operation_id"]
            if op_id not in operation_map:
                logger.warning(f"工序ID {op_id} 不存在，跳过")
                continue

            operation = operation_map[op_id]
            extra_data = op_data.get("extra_data", {})

            workshop_id = extra_data.get("workshop_id") or (operation.default_workshop_ids[0] if operation.default_workshop_ids else None) or work_order.workshop_id
            workshop_name = extra_data.get("workshop_name") or workshop_names.get(workshop_id) or work_order.workshop_name

            work_center_id = extra_data.get("work_center_id") or (operation.default_work_center_ids[0] if operation.default_work_center_ids else None) or work_order.work_center_id
            work_center_name = extra_data.get("work_center_name") or center_names.get(work_center_id) or work_order.work_center_name

            assigned_worker_id = extra_data.get("assigned_worker_id") or (operation.default_operator_ids[0] if operation.default_operator_ids else None)
            assigned_worker_name = extra_data.get("assigned_worker_name") or user_names.get(assigned_worker_id)

            assigned_team_id = extra_data.get("assigned_team_id") or (operation.default_team_ids[0] if operation.default_team_ids else None)
            assigned_team_name = extra_data.get("assigned_team_name") or team_names.get(assigned_team_id)

            assigned_station_id = extra_data.get("assigned_station_id") or (getattr(operation, "default_station_ids", [])[0] if getattr(operation, "default_station_ids", None) else None)
            assigned_station_name = extra_data.get("assigned_station_name") or station_names.get(assigned_station_id)

            assigned_equipment_id = extra_data.get("assigned_equipment_id") or (operation.default_equipment_ids[0] if operation.default_equipment_ids else None)
            assigned_equipment_name = extra_data.get("assigned_equipment_name") or eq_names.get(assigned_equipment_id)

            standard_time = extra_data.get("standard_time")
            setup_time = extra_data.get("setup_time")

            reporting_type = extra_data.get("reporting_type") or extra_data.get("reportingType") or "quantity"
            allow_jump = False
            is_node = extra_data.get("is_node_operation")
            if is_node is None:
                is_node = extra_data.get("isNodeOperation")
            is_node = bool(is_node) if is_node is not None else False

            from apps.kuaizhizao.utils.outsource_operation import parse_route_step_outsource

            outsource_meta = parse_route_step_outsource(extra_data if isinstance(extra_data, dict) else {})
            # 计划委外不占本厂工位：忽略默认工位派工
            if outsource_meta["outsource_kind"] != "none":
                assigned_station_id = None
                assigned_station_name = None
                assigned_worker_id = None
                assigned_worker_name = None
                assigned_equipment_id = None
                assigned_equipment_name = None

            step_explicit = extra_has_over_report_keys(extra_data)
            step_t = parse_over_report_from_extra(extra_data)
            line_t = (OVER_REPORT_NONE, Decimal("0"))
            orm, orv = merge_over_report_layers(
                mat_t,
                tuple_from_model(operation),
                route_def_t,
                step_t,
                step_explicit,
                wo_head_t,
                line_t,
                False,
            )

            total_hours = operation_total_hours(setup_time, standard_time, work_order.quantity)
            standard_hours_per_unit = float(standard_time) if standard_time else 0
            setup_hours = float(setup_time) if setup_time else 0

            prepared_ops.append({
                "op_data": op_data,
                "operation": operation,
                "workshop_id": workshop_id,
                "workshop_name": workshop_name,
                "work_center_id": work_center_id,
                "work_center_name": work_center_name,
                "assigned_worker_id": assigned_worker_id,
                "assigned_worker_name": assigned_worker_name,
                "assigned_team_id": assigned_team_id,
                "assigned_team_name": assigned_team_name,
                "assigned_station_id": assigned_station_id,
                "assigned_station_name": assigned_station_name,
                "assigned_equipment_id": assigned_equipment_id,
                "assigned_equipment_name": assigned_equipment_name,
                "reporting_type": reporting_type,
                "allow_jump": allow_jump,
                "is_node": is_node,
                "orm": orm,
                "orv": orv,
                "total_hours": total_hours,
                "standard_hours_per_unit": standard_hours_per_unit,
                "setup_hours": setup_hours,
                "outsource_kind": outsource_meta["outsource_kind"],
                "outsource_lead_time_days": outsource_meta["outsource_lead_time_days"],
                "default_outsource_supplier_id": outsource_meta["default_outsource_supplier_id"],
                "default_outsource_supplier_name": outsource_meta["default_outsource_supplier_name"],
            })

        from apps.kuaizhizao.utils.working_time import load_scheduling_work_context
        _anchor = work_order.planned_start_date or work_order.planned_end_date
        _around = _anchor.date() if _anchor else None
        _holidays, _work_hours, _overtime = await load_scheduling_work_context(tenant_id, around=_around)
        time_slots = build_operation_time_slots(
            [row["total_hours"] for row in prepared_ops],
            planned_start=work_order.planned_start_date,
            planned_end=work_order.planned_end_date,
            holidays=_holidays,
            work_hours=_work_hours,
            overtime=_overtime,
        )

        work_order_operations = []
        for idx, row in enumerate(prepared_ops):
            operation = row["operation"]
            op_data = row["op_data"]
            planned_start_date, planned_end_date = time_slots[idx]

            work_order_op = await WorkOrderOperation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                operation_id=operation.id,
                operation_code=operation.code,
                operation_name=operation.name,
                sequence=op_data["sequence"],
                workshop_id=row["workshop_id"],
                workshop_name=row["workshop_name"],
                work_center_id=row["work_center_id"],
                work_center_name=row["work_center_name"],
                assigned_worker_id=row["assigned_worker_id"],
                assigned_worker_name=row["assigned_worker_name"],
                assigned_team_id=row["assigned_team_id"],
                assigned_team_name=row["assigned_team_name"],
                assigned_station_id=row["assigned_station_id"],
                assigned_station_name=row["assigned_station_name"],
                assigned_equipment_id=row["assigned_equipment_id"],
                assigned_equipment_name=row["assigned_equipment_name"],
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                standard_time=Decimal(str(row["standard_hours_per_unit"])) if row["standard_hours_per_unit"] else None,
                setup_time=Decimal(str(row["setup_hours"])) if row["setup_hours"] else None,
                reporting_type=row["reporting_type"],
                allow_jump=row["allow_jump"],
                is_node_operation=row["is_node"],
                over_report_mode=row["orm"],
                over_report_value=row["orv"],
                outsource_kind=row.get("outsource_kind") or "none",
                outsource_lead_time_days=row.get("outsource_lead_time_days"),
                default_outsource_supplier_id=row.get("default_outsource_supplier_id"),
                default_outsource_supplier_name=row.get("default_outsource_supplier_name"),
                status='pending',
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            work_order_operations.append(work_order_op)
        
        # 更新工单计划时间：有交期锚点时保持 planned_end 不后移
        if work_order_operations and time_slots:
            work_order.planned_start_date = time_slots[0][0]
            if work_order.planned_end_date is None:
                work_order.planned_end_date = time_slots[-1][1]
            await work_order.save()
        
        logger.info(f"为工单 {work_order.code} 自动生成了 {len(work_order_operations)} 个工序单")
        return work_order_operations

    async def compute_and_apply_operation_planned_times(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        operations: List[WorkOrderOperation],
        updated_by: Optional[int] = None,
    ) -> None:
        """
        根据工单计划开始时间和工序工时，推算并更新各工序的计划时间（供排程服务复用）

        Args:
            tenant_id: 组织ID
            work_order: 工单（需有 planned_start_date）
            operations: 工序列表（需按 sequence 排序）
            updated_by: 更新人ID（可选）
        """
        if not operations:
            return
        from apps.kuaizhizao.utils.work_order_operation_scheduling import (
            build_operation_time_slots,
            operation_total_hours,
        )

        sorted_ops = sorted(operations, key=lambda x: x.sequence)
        durations = [
            operation_total_hours(op.setup_time, op.standard_time, work_order.quantity)
            for op in sorted_ops
        ]
        from apps.kuaizhizao.utils.working_time import load_scheduling_work_context
        _anchor = work_order.planned_start_date or work_order.planned_end_date
        _around = _anchor.date() if _anchor else None
        _holidays, _work_hours, _overtime = await load_scheduling_work_context(tenant_id, around=_around)
        time_slots = build_operation_time_slots(
            durations,
            planned_start=work_order.planned_start_date,
            planned_end=work_order.planned_end_date,
            holidays=_holidays,
            work_hours=_work_hours,
            overtime=_overtime,
        )

        for idx, op in enumerate(sorted_ops):
            if idx >= len(time_slots):
                break
            planned_start_date, planned_end_date = time_slots[idx]
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                id=op.id,
            ).update(
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
            )

        if time_slots:
            wo_updates: Dict[str, Any] = {"planned_start_date": time_slots[0][0], "updated_by": updated_by}
            if work_order.planned_end_date is None:
                wo_updates["planned_end_date"] = time_slots[-1][1]
            await WorkOrder.filter(tenant_id=tenant_id, id=work_order.id).update(**wo_updates)

    async def create_work_order(
        self,
        tenant_id: int,
        work_order_data: WorkOrderCreate,
        created_by: int,
        allow_draft: bool = False
    ) -> WorkOrderResponse:
        """
        创建工单

        Args:
            tenant_id: 组织ID
            work_order_data: 工单创建数据
            created_by: 创建人ID

        Returns:
            WorkOrderResponse: 创建的工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 处理工单编码
            # 1. 如果提供了 code，验证唯一性并使用（手工填写）
            # 2. 如果未提供 code 但提供了 code_rule，使用编码规则生成
            # 3. 如果两者都未提供，抛出验证错误
            code = work_order_data.code
            # 获取 code_rule（如果 Schema 中有定义）
            code_rule = getattr(work_order_data, 'code_rule', None)
            
            if code:
                # 手工填写编码，验证唯一性
                existing = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    raise ValidationError(f"工单编码 {code} 已存在")
            elif code_rule:
                # 使用编码规则生成编码；批量下推时若序号未校准到库内最大号会撞号，
                # 故生成后若已存在则继续占号直至唯一。
                today = today_site_str()
                context = {"prefix": f"WO{today}"}
                code = None
                for _attempt in range(30):
                    candidate = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code=code_rule,
                        context=context,
                    )
                    existing = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        code=candidate,
                        deleted_at__isnull=True,
                    ).first()
                    if not existing:
                        code = candidate
                        break
                if not code:
                    raise ValidationError(
                        "无法生成唯一工单编码，请检查编码规则序号或清理重复规则后重试"
                    )
            else:
                raise ValidationError("必须提供 code 或 code_rule")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 处理产品/物料信息
            # 1. 如果提供了 product_id，验证物料是否存在并获取编码和名称
            # 2. 如果未提供 product_id，则根据 product_code 查找物料
            product_id = work_order_data.product_id
            product_code = work_order_data.product_code
            product_name = work_order_data.product_name
            
            if product_id:
                # 验证物料是否存在
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=product_id,
                    deleted_at__isnull=True
                ).first()
                
                if not material:
                    raise ValidationError(f"物料ID {product_id} 不存在")
                
                if not material.is_active:
                    raise ValidationError(f"物料ID {product_id} 已停用")
                
                # 使用物料的实际编码和名称（覆盖用户提供的内容）
                product_code = material.code
                product_name = material.name
            elif product_code:
                # 根据 product_code 查找物料
                material = await Material.filter(
                    tenant_id=tenant_id,
                    code=product_code,
                    deleted_at__isnull=True
                ).first()
                
                if not material:
                    raise ValidationError(f"物料编码 {product_code} 不存在")
                
                if not material.is_active:
                    raise ValidationError(f"物料编码 {product_code} 已停用")
                
                product_id = material.id
                product_code = material.code
                if not product_name:
                    product_name = material.name
            else:
                raise ValidationError("必须提供 product_id 或 product_code")

            # 物料来源验证（核心功能，新增）
            # 1. 获取物料来源类型
            source_type = await get_material_source_type(tenant_id, product_id)
            
            # 2. 验证物料来源配置完整性
            if source_type:
                validation_passed, validation_errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=product_id,
                    source_type=source_type
                )
                
                # 3. 根据物料来源类型验证是否可以创建工单（allow_draft 时跳过验证，生成草稿由下游补全）
                if not allow_draft:
                    if source_type == SOURCE_TYPE_MAKE:
                        # 自制件：必须有BOM和工艺路线
                        if not validation_passed:
                            error_msg = f"自制件物料来源验证失败，无法创建工单：\n" + "\n".join(validation_errors)
                            logger.warning(f"工单创建失败 - {error_msg}")
                            raise ValidationError(error_msg)
                    elif source_type == SOURCE_TYPE_OUTSOURCE:
                        # 委外件：必须有委外供应商和委外工序（验证失败时不允许创建工单）
                        if not validation_passed:
                            error_msg = f"委外件物料来源验证失败，无法创建工单：\n" + "\n".join(validation_errors)
                            logger.warning(f"工单创建失败 - {error_msg}")
                            raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_BUY:
                    # 采购件：不生成生产工单（应该生成采购订单）
                    error_msg = f"采购件不应创建生产工单，物料: {product_code} ({product_name})，请使用采购订单功能"
                    logger.warning(f"工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_CUSTOMER_PROVIDED:
                    error_msg = (
                        f"客供料不应创建生产工单，物料: {product_code} ({product_name})，"
                        "请通过客供料入库管理库存"
                    )
                    logger.warning(f"工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_PHANTOM:
                    # 虚拟件：不生成工单（直接展开到下层物料）
                    error_msg = f"虚拟件不应创建工单，物料: {product_code} ({product_name})，虚拟件会自动展开到下层物料"
                    logger.warning(f"工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_CONFIGURE:
                    # 配置件：必须提供属性以确定具体 BOM 配置
                    variant_attrs = getattr(work_order_data, "variant_attributes", None)
                    if not variant_attrs or not isinstance(variant_attrs, dict) or len(variant_attrs) == 0:
                        error_msg = f"配置件必须提供属性（variant_attributes），物料: {product_code} ({product_name})，例如 {{\"color\":\"red\",\"size\":\"M\"}}"
                        logger.warning(f"工单创建失败 - {error_msg}")
                        raise ValidationError(error_msg)
                
                logger.info(f"物料来源验证通过，物料: {product_code} ({product_name}), 来源类型: {source_type}")
            else:
                # 如果没有物料来源类型，默认按自制件处理（向后兼容）
                logger.warning(f"物料 {product_code} 未配置物料来源类型，默认按自制件处理")

            # 来源工艺路线与工序跳转（路线级默认 + 工单快照）
            operations_input = getattr(work_order_data, "operations", None) or []
            has_manual_ops = bool(operations_input and len(operations_input) > 0)
            explicit_pr_id = getattr(work_order_data, "process_route_id", None)

            process_route_resolved: Optional[ProcessRoute] = None
            if explicit_pr_id is not None:
                process_route_resolved = await ProcessRoute.get_or_none(
                    id=explicit_pr_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if not process_route_resolved:
                    raise ValidationError(f"工艺路线不存在或未启用: id={explicit_pr_id}")

            if not process_route_resolved and not has_manual_ops:
                process_route_resolved = await self._match_process_route_for_material(
                    tenant_id=tenant_id,
                    material_id=product_id,
                )

            resolved_operation_sequence: Optional[Any] = None
            resolved_allow_jump = False
            if process_route_resolved and not has_manual_ops:
                resolved_operation_sequence, resolved_allow_jump = (
                    await MaterialProductProcessService.resolve_sequence_for_material(
                        tenant_id,
                        product_id,
                        process_route_resolved,
                    )
                )

            wo_jump_req = getattr(work_order_data, "allow_operation_jump", None)
            if wo_jump_req is None:
                if process_route_resolved and not has_manual_ops:
                    wo_allow_jump = resolved_allow_jump
                else:
                    wo_allow_jump = bool(
                        getattr(process_route_resolved, "allow_operation_jump", False)
                    ) if process_route_resolved else False
            else:
                wo_allow_jump = bool(wo_jump_req)

            stored_pr_id: Optional[int] = explicit_pr_id
            if stored_pr_id is None and process_route_resolved and not has_manual_ops:
                stored_pr_id = process_route_resolved.id

            resolved_so_code, resolved_so_name = await _resolve_sales_order_snapshot_fields(
                tenant_id,
                work_order_data.sales_order_id,
                work_order_data.sales_order_code,
                work_order_data.sales_order_name,
            )

            tracking_service = WorkOrderTrackingService()
            tracking_input = tracking_service.extract_create_tracking_input(work_order_data)
            tracking_mode = tracking_service.validate_create_tracking(
                material=material,
                quantity=work_order_data.quantity,
                tracking_input=tracking_input,
            )
            tracking_kwargs = tracking_service.build_tracking_create_kwargs(
                tracking_mode, tracking_input
            )
            if tracking_input.get("planned_serial_nos"):
                # 父单不存列表，拆分时写入子单
                pass

            # 创建工单（审核默认关闭→已通过可直接下达；开启后需提交审核）
            audit_required = await BusinessConfigService().check_audit_required(
                tenant_id, "work_order"
            )
            initial_review = "已通过" if not audit_required else "草稿"
            work_order = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=work_order_data.name,
                product_id=product_id,
                product_code=product_code,
                product_name=product_name,
                quantity=work_order_data.quantity,
                production_mode=work_order_data.production_mode,
                sales_order_id=work_order_data.sales_order_id,
                sales_order_code=resolved_so_code,
                sales_order_name=resolved_so_name,
                workshop_id=work_order_data.workshop_id,
                workshop_name=work_order_data.workshop_name,
                work_center_id=work_order_data.work_center_id,
                work_center_name=work_order_data.work_center_name,
                status=work_order_data.status or "draft",
                review_status=initial_review,
                priority=work_order_data.priority,
                planned_start_date=coerce_business_datetime_to_utc(
                    work_order_data.planned_start_date
                ),
                planned_end_date=coerce_business_datetime_to_utc(
                    work_order_data.planned_end_date
                ),
                actual_start_date=coerce_business_datetime_to_utc(
                    work_order_data.actual_start_date
                ),
                actual_end_date=coerce_business_datetime_to_utc(
                    work_order_data.actual_end_date
                ),
                completed_quantity=work_order_data.completed_quantity,
                qualified_quantity=work_order_data.qualified_quantity,
                unqualified_quantity=work_order_data.unqualified_quantity,
                variant_attributes=getattr(work_order_data, "variant_attributes", None),
                configurable_selections=getattr(work_order_data, "configurable_selections", None),
                remarks=work_order_data.remarks,
                allow_operation_jump=wo_allow_jump,
                process_route_id=stored_pr_id,
                over_report_mode=getattr(work_order_data, "over_report_mode", None) or "none",
                over_report_value=getattr(work_order_data, "over_report_value", None) or Decimal("0"),
                created_by=created_by,
                created_by_name=user_info["name"],
                **tracking_kwargs,
            )

            # 记录"创建"节点开始时间（必须在同一事务内，失败时需抛出以触发回滚）
            try:
                timing_service = DocumentTimingService()
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order.id,
                    document_code=work_order.code,
                    node_name="创建",
                    node_code="created",
                    operator_id=created_by,
                    operator_name=user_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败会导致事务中止，必须重新抛出，否则后续工序单创建会报"当前事务被终止"
                logger.warning(f"记录工单创建节点时间失败: {e}")
                raise

            # 处理工序单（如果提供了 operations，使用提供的工序；否则自动匹配工艺路线）
            operations = getattr(work_order_data, 'operations', None)
            
            if operations and len(operations) > 0:
                # 使用提供的工序创建工单工序单
                try:
                    user_info = await self.get_user_info(created_by)
                    work_order_operations = []
                    
                    # 计算计划时间
                    planned_start = work_order.planned_start_date or resolve_business_datetime()
                    current_time = planned_start
                    
                    from apps.kuaizhizao.services.over_report_rules import (
                        OVER_REPORT_NONE,
                        merge_over_report_layers,
                        tuple_from_model,
                        normalize_over_report_mode,
                        to_decimal,
                    )

                    mat_t = tuple_from_model(material)
                    route_empty = (OVER_REPORT_NONE, Decimal("0"))
                    wo_head_t = tuple_from_model(work_order)

                    for idx, op_data in enumerate(operations, 1):
                        # 验证工序是否存在
                        operation = await Operation.get_or_none(
                            id=op_data.operation_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        )
                        
                        if not operation:
                            raise ValidationError(f"工序ID {op_data.operation_id} 不存在")
                        
                        # 使用提供的工序数据，如果没有则使用默认值
                        sequence = op_data.sequence if op_data.sequence else idx
                        workshop_id = op_data.workshop_id or work_order.workshop_id
                        workshop_name = op_data.workshop_name or work_order.workshop_name
                        work_center_id = op_data.work_center_id or work_order.work_center_id
                        work_center_name = op_data.work_center_name or work_order.work_center_name
                        
                        # 计算计划时间（如果有标准工时）；业务墙钟 naive → UTC
                        planned_start_date = (
                            coerce_business_datetime_to_utc(op_data.planned_start_date)
                            or current_time
                        )
                        planned_end_date = coerce_business_datetime_to_utc(
                            op_data.planned_end_date
                        )
                        
                        if not planned_end_date and op_data.standard_time:
                            # 根据标准工时计算结束时间
                            from datetime import timedelta
                            standard_hours = float(op_data.standard_time)
                            setup_hours = float(op_data.setup_time) if op_data.setup_time else 0
                            total_hours = setup_hours + (standard_hours * float(work_order.quantity))
                            planned_end_date = planned_start_date + timedelta(hours=total_hours)
                        elif not planned_end_date:
                            # 如果没有标准工时，默认1小时
                            from datetime import timedelta
                            planned_end_date = planned_start_date + timedelta(hours=1)
                        
                        # 创建工序单：报工类型可覆盖；跳转由工单级控制；节点仅来自开单传入
                        rt = getattr(op_data, "reporting_type", None)
                        if rt is None:
                            rt = operation.reporting_type or "quantity"
                        aj = False
                        ino = getattr(op_data, "is_node_operation", None)
                        if ino is not None:
                            ino = bool(ino)
                        else:
                            ino = False

                        fs = getattr(op_data, "model_fields_set", set()) or set()
                        line_explicit = bool(fs & {"over_report_mode", "over_report_value"})
                        if line_explicit:
                            line_t = (
                                normalize_over_report_mode(getattr(op_data, "over_report_mode", None)),
                                to_decimal(getattr(op_data, "over_report_value", None)),
                            )
                        else:
                            line_t = (OVER_REPORT_NONE, Decimal("0"))
                        orm, orv = merge_over_report_layers(
                            mat_t,
                            tuple_from_model(operation),
                            route_empty,
                            route_empty,
                            False,
                            wo_head_t,
                            line_t,
                            line_explicit,
                        )

                        work_order_op = await WorkOrderOperation.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            work_order_id=work_order.id,
                            work_order_code=work_order.code,
                            operation_id=operation.id,
                            operation_code=operation.code,
                            operation_name=operation.name,
                            sequence=sequence,
                            workshop_id=workshop_id,
                            workshop_name=workshop_name,
                            work_center_id=work_center_id,
                            work_center_name=work_center_name,
                            planned_start_date=planned_start_date,
                            planned_end_date=planned_end_date,
                            standard_time=op_data.standard_time,
                            setup_time=op_data.setup_time,
                            remarks=op_data.remarks,
                            reporting_type=rt,
                            allow_jump=aj,
                            is_node_operation=ino,
                            over_report_mode=orm,
                            over_report_value=orv,
                            status='pending',
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        
                        work_order_operations.append(work_order_op)
                        current_time = planned_end_date
                    
                    # 更新工单计划时间：有交期锚点时不后移交期
                    if work_order_operations:
                        if work_order.planned_end_date:
                            await self.compute_and_apply_operation_planned_times(
                                tenant_id,
                                work_order,
                                work_order_operations,
                                updated_by=created_by,
                            )
                        else:
                            last_op = work_order_operations[-1]
                            work_order.planned_end_date = last_op.planned_end_date
                            await work_order.save()
                    
                    logger.info(f"工单 {work_order.code} 已创建 {len(work_order_operations)} 个工序单（使用提供的工序）")
                except Exception as e:
                    logger.error(f"为工单 {work_order.code} 创建工序单失败: {e}", exc_info=True)
                    raise ValidationError(f"创建工序单失败: {str(e)}")
            else:
                # 自动按已解析工艺路线生成工序单
                try:
                    if process_route_resolved:
                        await self._generate_work_order_operations_from_route(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            process_route=process_route_resolved,
                            created_by=created_by,
                            operation_sequence=resolved_operation_sequence,
                        )
                        logger.info(
                            f"工单 {work_order.code} 已自动生成工序单（基于工艺路线: {process_route_resolved.code}）"
                        )
                    else:
                        logger.warning(f"工单 {work_order.code} 未找到匹配的工艺路线，未自动生成工序单")
                except Exception as e:
                    # 自动生成工序单失败不影响工单创建，记录日志
                    logger.error(f"为工单 {work_order.code} 自动生成工序单失败: {e}", exc_info=True)

            serial_split_children: List[WorkOrder] = []
            if tracking_mode in (TRACKING_SERIAL, TRACKING_BOTH):
                serial_split_children = await tracking_service.apply_serial_split_after_create(
                    tenant_id=tenant_id,
                    parent_work_order=work_order,
                    material=material,
                    tracking_input=tracking_input,
                    created_by=created_by,
                    created_by_name=user_info["name"],
                    work_order_service=self,
                )

            work_order_id_created = work_order.id
            response = WorkOrderResponse.model_validate(work_order)
            response = response.model_copy(
                update=WorkOrderTrackingService.tracking_fields_for_response(work_order)
            )
            if material:
                from apps.kuaizhizao.utils.material_unit_utils import build_work_order_unit_fields

                response = response.model_copy(update=build_work_order_unit_fields(material, work_order))
            if serial_split_children:
                response = response.model_copy(
                    update={"serial_split_child_count": len(serial_split_children)}
                )

        from apps.kuaizhizao.services.work_order_readiness_service import (
            dispatch_work_order_readiness_refresh,
        )

        await dispatch_work_order_readiness_refresh(tenant_id, work_order_id_created)
        return response

    async def get_work_order_by_id(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> WorkOrderResponse:
        """
        根据ID获取工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Returns:
            WorkOrderResponse: 工单信息

        Raises:
            NotFoundError: 工单不存在
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        response = WorkOrderResponse.model_validate(work_order)
        # 获取 UniLifecycle 里程碑历史
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_work_order_lifecycle,
            get_document_milestones
        )
        milestones = await get_document_milestones(tenant_id, "work_order", work_order_id)
        response.lifecycle = get_work_order_lifecycle(work_order, milestones=milestones)
        # 制造模式 / 规格：物料主数据（product_id 即本单制造的产品物料）
        if work_order.product_id:
            product = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if product and product.source_config and isinstance(product.source_config, dict):
                response.manufacturing_mode = product.source_config.get("manufacturing_mode") or "fabrication"
            else:
                response.manufacturing_mode = "fabrication"
            spec = (getattr(product, "specification", None) or "").strip() if product else ""
            if spec:
                response.material_spec = spec
            if product:
                from apps.kuaizhizao.utils.material_unit_utils import build_work_order_unit_fields

                response = response.model_copy(update=build_work_order_unit_fields(product, work_order))
        else:
            response.manufacturing_mode = "fabrication"
        if work_order.sales_order_id and not work_order.sales_order_code:
            rc, rn = await _resolve_sales_order_snapshot_fields(
                tenant_id,
                work_order.sales_order_id,
                work_order.sales_order_code,
                work_order.sales_order_name,
            )
            response.sales_order_code = rc
            response.sales_order_name = rn
        if (work_order.status or "") == "split" and work_order.parent_work_order_id is None:
            remaining = await self.compute_split_remaining_quantity(tenant_id, work_order_id)
            response = response.model_copy(update={"split_remaining_quantity": remaining})
            child_count = await WorkOrder.filter(
                tenant_id=tenant_id,
                parent_work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).count()
            if child_count:
                response = response.model_copy(update={"serial_split_child_count": child_count})
        response = response.model_copy(
            update=WorkOrderTrackingService.tracking_fields_for_response(work_order)
        )
        returnable_map = await self._get_production_return_service().batch_work_orders_have_returnable_picking(
            tenant_id,
            [work_order_id],
        )
        downstream_map = await self.batch_work_orders_have_revoke_blocking_downstream(
            tenant_id,
            [work_order_id],
        )
        from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_record

        audit_required = await audit_enabled_for(tenant_id, "work_order")
        response = enrich_work_order_capabilities_on_response(
            work_order,
            response,
            has_returnable_picking=returnable_map.get(work_order_id, False),
            has_downstream_documents=downstream_map.get(work_order_id, False),
            audit_required=audit_required,
        )
        return await enrich_record(
            tenant_id, "work_order", response, audit_enabled=audit_required
        )

    async def compute_split_remaining_quantity(
        self,
        tenant_id: int,
        parent_work_order_id: int,
    ) -> Decimal:
        """已拆分主工单的剩余可分配数量 = 原数量 - 未删除子工单数量之和。"""
        parent = await self.get_by_id(tenant_id, parent_work_order_id, raise_if_not_found=True)
        child_rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            parent_work_order_id=parent_work_order_id,
            deleted_at__isnull=True,
        ).only("quantity")
        allocated = sum(Decimal(str(row.quantity)) for row in child_rows)
        return max(Decimal("0"), parent.quantity - allocated)

    async def _next_split_child_sequence(
        self,
        tenant_id: int,
        parent_work_order_id: int,
        parent_code: str,
    ) -> int:
        from apps.kuaizhizao.services.work_order_tree_service import _SPLIT_CODE_SUFFIX

        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            parent_work_order_id=parent_work_order_id,
            deleted_at__isnull=True,
        ).only("code")
        max_idx = 0
        for row in rows:
            match = _SPLIT_CODE_SUFFIX.match(row.code or "")
            if match and match.group(1) == parent_code:
                max_idx = max(max_idx, int(match.group(2)))
        return max_idx + 1

    async def _work_order_summaries_for_scan(
        self,
        tenant_id: int,
        work_order_ids: Iterable[int],
        *,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """扫码定位用的工单摘要（优先进行中 / 已下达）。"""
        ids = [int(i) for i in work_order_ids if i is not None]
        if not ids:
            return []
        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
            parent_work_order_id__isnull=True,
        ).exclude(status__in=["completed", "cancelled"]).order_by("-updated_at").limit(limit).all()
        # 进行中 / 已下达优先
        priority = {"in_progress": 0, "released": 1, "confirmed": 2, "paused": 3}
        rows = sorted(
            rows,
            key=lambda w: (priority.get(str(w.status or ""), 9), -(w.updated_at.timestamp() if w.updated_at else 0)),
        )
        return [
            {
                "id": wo.id,
                "code": wo.code,
                "name": wo.name,
                "product_name": wo.product_name,
                "product_code": wo.product_code,
                "status": wo.status,
                "planned_quantity": float(wo.quantity or 0),
                "completed_quantity": float(wo.completed_quantity or 0),
            }
            for wo in rows[:limit]
        ]

    async def resolve_work_orders_by_scan(
        self,
        tenant_id: int,
        raw: str,
        *,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        扫码报工定位：支持工单码 / 设备码 / 人员码 / 工位码。

        - 标准 JSON：type=WO|EQ|EMP|STATION|WS
        - 工位历史码可能误打成 type=EQ（设备字段塞工位 uuid/code），EQ 未命中设备时回退工位
        - 纯文本：精确匹配工单编码 → 设备编码 → 工位编码 → 用户名
        """
        from apps.kuaizhizao.models.equipment import Equipment
        from apps.master_data.models.factory import Workstation
        from infra.models.user import User as UserModel

        text = (raw or "").strip()
        if not text:
            return {
                "match_type": "none",
                "matched": None,
                "work_orders": [],
                "message": "扫码内容为空",
            }

        qr_type: Optional[str] = None
        data: Dict[str, Any] = {}
        try:
            parsed = json.loads(text) if text.startswith("{") else None
            if isinstance(parsed, dict) and parsed.get("type"):
                qr_type = str(parsed.get("type") or "").strip().upper()
                data = parsed.get("data") if isinstance(parsed.get("data"), dict) else {}
        except Exception:
            parsed = None

        async def by_worker(user_id: int, matched: Dict[str, Any]) -> Dict[str, Any]:
            wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_id=user_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            orders = await self._work_order_summaries_for_scan(tenant_id, wo_ids, limit=limit)
            return {
                "match_type": "employee",
                "matched": matched,
                "work_orders": orders,
                "message": None if orders else "该人员暂无派工工单",
            }

        async def by_equipment(eq_id: int, matched: Dict[str, Any]) -> Dict[str, Any]:
            wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_equipment_id=eq_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            orders = await self._work_order_summaries_for_scan(tenant_id, wo_ids, limit=limit)
            return {
                "match_type": "equipment",
                "matched": matched,
                "work_orders": orders,
                "message": None if orders else "该设备暂无派工工单",
            }

        async def by_station(st_id: int, matched: Dict[str, Any]) -> Dict[str, Any]:
            wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_station_id=st_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            orders = await self._work_order_summaries_for_scan(tenant_id, wo_ids, limit=limit)
            return {
                "match_type": "station",
                "matched": matched,
                "work_orders": orders,
                "message": None if orders else "该工位暂无派工工单",
            }

        # —— 结构化二维码 ——
        if qr_type == "WO":
            code = str(data.get("work_order_code") or data.get("code") or "").strip()
            uuid_val = str(data.get("work_order_uuid") or data.get("uuid") or "").strip()
            wo = None
            if uuid_val:
                wo = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, uuid=uuid_val, deleted_at__isnull=True
                )
            if not wo and code:
                wo = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, code=code, deleted_at__isnull=True
                )
            if not wo:
                return {
                    "match_type": "none",
                    "matched": None,
                    "work_orders": [],
                    "message": "未找到该工单",
                }
            orders = await self._work_order_summaries_for_scan(tenant_id, [wo.id], limit=limit)
            if not orders:
                # 已完成等仍返回该工单本身，便于查看
                orders = [{
                    "id": wo.id,
                    "code": wo.code,
                    "name": wo.name,
                    "product_name": wo.product_name,
                    "product_code": wo.product_code,
                    "status": wo.status,
                    "planned_quantity": float(wo.quantity or 0),
                    "completed_quantity": float(wo.completed_quantity or 0),
                }]
            return {
                "match_type": "work_order",
                "matched": {"id": wo.id, "code": wo.code, "name": wo.name},
                "work_orders": orders,
                "message": None,
            }

        if qr_type == "EMP":
            emp_uuid = str(data.get("employee_uuid") or data.get("uuid") or "").strip()
            emp_code = str(data.get("employee_code") or data.get("code") or "").strip()
            user = None
            if emp_uuid:
                user = await UserModel.get_or_none(
                    tenant_id=tenant_id, uuid=emp_uuid, deleted_at__isnull=True
                )
            if not user and emp_code:
                user = await UserModel.get_or_none(
                    tenant_id=tenant_id, username=emp_code, deleted_at__isnull=True
                )
            if not user:
                return {
                    "match_type": "none",
                    "matched": None,
                    "work_orders": [],
                    "message": "未找到该人员",
                }
            return await by_worker(
                user.id,
                {
                    "id": user.id,
                    "code": user.username,
                    "name": user.full_name or user.username,
                },
            )

        if qr_type in ("STATION", "WS"):
            st_uuid = str(
                data.get("station_uuid")
                or data.get("workstation_uuid")
                or data.get("uuid")
                or data.get("equipment_uuid")
                or ""
            ).strip()
            st_code = str(
                data.get("station_code")
                or data.get("workstation_code")
                or data.get("code")
                or data.get("equipment_code")
                or ""
            ).strip()
            station = None
            if st_uuid:
                station = await Workstation.get_or_none(
                    tenant_id=tenant_id, uuid=st_uuid, deleted_at__isnull=True
                )
            if not station and st_code:
                station = await Workstation.get_or_none(
                    tenant_id=tenant_id, code=st_code, deleted_at__isnull=True
                )
            if not station:
                return {
                    "match_type": "none",
                    "matched": None,
                    "work_orders": [],
                    "message": "未找到该工位",
                }
            return await by_station(
                station.id,
                {"id": station.id, "code": station.code, "name": station.name},
            )

        if qr_type == "EQ":
            eq_uuid = str(data.get("equipment_uuid") or data.get("uuid") or "").strip()
            eq_code = str(data.get("equipment_code") or data.get("code") or "").strip()
            equipment = None
            if eq_uuid:
                equipment = await Equipment.get_or_none(
                    tenant_id=tenant_id, uuid=eq_uuid, deleted_at__isnull=True
                )
            if not equipment and eq_code:
                equipment = await Equipment.get_or_none(
                    tenant_id=tenant_id, code=eq_code, deleted_at__isnull=True
                )
            if equipment:
                return await by_equipment(
                    equipment.id,
                    {
                        "id": equipment.id,
                        "code": equipment.code,
                        "name": equipment.name,
                    },
                )
            # 兼容：工位详情曾用 type=EQ 生成工位码
            station = None
            if eq_uuid:
                station = await Workstation.get_or_none(
                    tenant_id=tenant_id, uuid=eq_uuid, deleted_at__isnull=True
                )
            if not station and eq_code:
                station = await Workstation.get_or_none(
                    tenant_id=tenant_id, code=eq_code, deleted_at__isnull=True
                )
            if station:
                return await by_station(
                    station.id,
                    {"id": station.id, "code": station.code, "name": station.name},
                )
            return {
                "match_type": "none",
                "matched": None,
                "work_orders": [],
                "message": "未找到该设备或工位",
            }

        # —— 纯文本精确匹配 ——
        code = text
        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        )
        if wo:
            orders = await self._work_order_summaries_for_scan(tenant_id, [wo.id], limit=limit)
            if not orders:
                orders = [{
                    "id": wo.id,
                    "code": wo.code,
                    "name": wo.name,
                    "product_name": wo.product_name,
                    "product_code": wo.product_code,
                    "status": wo.status,
                    "planned_quantity": float(wo.quantity or 0),
                    "completed_quantity": float(wo.completed_quantity or 0),
                }]
            return {
                "match_type": "work_order",
                "matched": {"id": wo.id, "code": wo.code, "name": wo.name},
                "work_orders": orders,
                "message": None,
            }

        equipment = await Equipment.get_or_none(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        )
        if equipment:
            return await by_equipment(
                equipment.id,
                {"id": equipment.id, "code": equipment.code, "name": equipment.name},
            )

        station = await Workstation.get_or_none(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        )
        if station:
            return await by_station(
                station.id,
                {"id": station.id, "code": station.code, "name": station.name},
            )

        user = await UserModel.get_or_none(
            tenant_id=tenant_id, username=code, deleted_at__isnull=True
        )
        if user:
            return await by_worker(
                user.id,
                {
                    "id": user.id,
                    "code": user.username,
                    "name": user.full_name or user.username,
                },
            )

        return {
            "match_type": "none",
            "matched": None,
            "work_orders": [],
            "message": "未匹配到工单、设备、工位或人员",
        }

    async def list_work_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        production_mode: Optional[str] = None,
        status: Optional[str] = None,
        workshop_id: Optional[int] = None,
        work_center_id: Optional[int] = None,
        assigned_worker_id: Optional[int] = None,
        keyword: Optional[str] = None,
        sales_order_code: Optional[str] = None,
        planned_start_from: Optional[str] = None,
        planned_start_to: Optional[str] = None,
        planned_end_from: Optional[str] = None,
        planned_end_to: Optional[str] = None,
        order_by: Optional[str] = None,
        include_operations: bool = False,
        include_operation_steps: bool = False,
        include_readiness: bool = False,
        include_scores: bool = False,
        include_downstream_push_progress: bool = True,
    ) -> Tuple[List[WorkOrderListResponse], int]:
        """
        获取工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 工单编码（模糊搜索）
            name: 工单名称（模糊搜索）
            product_name: 产品名称（模糊搜索）
            production_mode: 生产模式
            status: 工单状态
            workshop_id: 车间ID
            work_center_id: 工作中心ID
            keyword: 关键词搜索（工单编码、名称、产品、来源订单号等）
            sales_order_code: 来源订单号（销售订单编码，模糊）
            planned_start_from/to: 计划开始日期范围
            planned_end_from/to: 计划结束日期范围
            order_by: 排序，如 code、-created_at
            include_readiness: 为 True 时强制重算当前页并写库；默认 False 时列表读 work_orders.readiness_rate 持久化字段

        Returns:
            Tuple[List[WorkOrderListResponse], int]: (工单列表, 总数)
        """
        from tortoise.expressions import Q
        from datetime import datetime

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,  # 只查询未删除的工单
            parent_work_order_id__isnull=True,  # 列表仅展示原工单；拆分工单挂在 children
        ).filter(
            Q(group_role__isnull=True)
            | Q(group_role__in=["root", "component", "outsource_component"]),
        )

        # 添加筛选条件
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if production_mode:
            query = query.filter(production_mode=production_mode)
        if status:
            query = query.filter(status=status)
        if workshop_id:
            query = query.filter(workshop_id=workshop_id)
        if work_center_id:
            query = query.filter(work_center_id=work_center_id)
        if assigned_worker_id:
            # 筛选有工序分配给该员工的工单（含多人派工 assigned_worker_ids）
            wo_ids_primary = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_id=assigned_worker_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            wo_ids_multi = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_ids__contains=assigned_worker_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            wo_id_set = set(wo_ids_primary) | set(wo_ids_multi)
            if wo_id_set:
                query = query.filter(id__in=wo_id_set)
            else:
                query = query.filter(id__in=[])  # 无匹配
        if sales_order_code and str(sales_order_code).strip():
            query = query.filter(sales_order_code__icontains=str(sales_order_code).strip())
        if keyword and str(keyword).strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw)
                | Q(name__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(product_code__icontains=kw)
                | Q(sales_order_code__icontains=kw)
                | Q(sales_order_name__icontains=kw)
            )
        if planned_start_from:
            try:
                dt = datetime.strptime(planned_start_from[:10], "%Y-%m-%d").date()
                query = query.filter(planned_start_date__gte=dt)
            except (ValueError, TypeError):
                pass
        if planned_start_to:
            try:
                dt = datetime.strptime(planned_start_to[:10], "%Y-%m-%d").date()
                query = query.filter(planned_start_date__lte=dt)
            except (ValueError, TypeError):
                pass
        if planned_end_from:
            try:
                dt = datetime.strptime(planned_end_from[:10], "%Y-%m-%d").date()
                query = query.filter(planned_end_date__gte=dt)
            except (ValueError, TypeError):
                pass
        if planned_end_to:
            try:
                dt = datetime.strptime(planned_end_to[:10], "%Y-%m-%d").date()
                query = query.filter(planned_end_date__lte=dt)
            except (ValueError, TypeError):
                pass

        # 获取总数（用于分页）
        total = await query.count()

        # 排序
        order_clause = order_by if order_by else "-code"
        work_orders = await query.offset(skip).limit(limit).order_by(order_clause).all()

        from apps.kuaizhizao.services.work_order_tree_service import (
            WorkOrderTreeService,
            is_split_child_code,
        )

        orphan_split_ids = [
            wo.id
            for wo in work_orders
            if wo.id is not None
            and wo.parent_work_order_id is None
            and is_split_child_code(wo.code)
        ]
        if orphan_split_ids:
            tree_svc = WorkOrderTreeService()
            if await tree_svc.backfill_split_parent_links(tenant_id, child_ids=orphan_split_ids):
                work_orders = await query.offset(skip).limit(limit).order_by(order_clause).all()

        # 制造模式 / 规格：定义在「产品物料」主数据；工单通过 product_id 关联
        product_ids = list({wo.product_id for wo in work_orders if wo.product_id})
        manufacturing_mode_by_product: dict[int, str] = {}
        material_spec_by_product: dict[int, str] = {}
        material_by_product: dict[int, Material] = {}
        if product_ids:
            materials = await Material.filter(
                tenant_id=tenant_id,
                id__in=product_ids,
                deleted_at__isnull=True,
            ).only("id", "source_config", "specification", "base_unit", "units")
            for m in materials:
                material_by_product[m.id] = m
                sc = m.source_config or {}
                if isinstance(sc, dict):
                    manufacturing_mode_by_product[m.id] = sc.get("manufacturing_mode") or "fabrication"
                else:
                    manufacturing_mode_by_product[m.id] = "fabrication"
                spec = (getattr(m, "specification", None) or "").strip()
                if spec:
                    material_spec_by_product[m.id] = spec

        # 列表展示：仅有 sales_order_id、缺编号/名称时，批量补全销售订单快照（历史数据或下推未写冗余字段）
        so_ids_missing_label = list(
            {
                wo.sales_order_id
                for wo in work_orders
                if wo.sales_order_id and not getattr(wo, "sales_order_code", None)
            }
        )
        so_snapshot_map: dict[int, tuple[str, str]] = {}
        if so_ids_missing_label:
            sos = await SalesOrder.filter(
                tenant_id=tenant_id,
                id__in=so_ids_missing_label,
                deleted_at__isnull=True,
            ).only("id", "order_code", "customer_name")
            for so in sos:
                so_snapshot_map[so.id] = (
                    so.order_code,
                    f"{so.order_code} - {so.customer_name}" if so.customer_name else so.order_code,
                )

        # 批量预取工序（include_operations 时消除 N+1）
        operations_map: dict[int, list] = {}
        operation_steps_map: dict[int, list] = {}
        if (include_operations or include_operation_steps) and work_orders:
            wo_ids = [wo.id for wo in work_orders if wo.id is not None]
            split_child_ids: list[int] = []
            if include_operation_steps and wo_ids:
                split_child_ids = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    parent_work_order_id__in=wo_ids,
                    deleted_at__isnull=True,
                ).values_list("id", flat=True)
            fetch_ids = list({*wo_ids, *split_child_ids})
            if fetch_ids:
                all_ops = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id__in=fetch_ids,
                    deleted_at__isnull=True
                ).order_by("work_order_id", "sequence").all()
                from apps.kuaizhizao.services.work_order_operation_steps import (
                    build_work_order_operation_steps,
                )

                ops_by_wo: dict[int, list] = {}
                for op in all_ops:
                    ops_by_wo.setdefault(op.work_order_id, []).append(op)

                qty_by_wo: dict[int, float] = {wo.id: float(wo.quantity or 0) for wo in work_orders if wo.id}
                if split_child_ids:
                    split_rows = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        id__in=split_child_ids,
                        deleted_at__isnull=True,
                    ).only("id", "quantity")
                    for row in split_rows:
                        qty_by_wo[row.id] = float(row.quantity or 0)

                for wo_id, ops in ops_by_wo.items():
                    if include_operations:
                        operations_map[wo_id] = [
                            {
                                "id": op.id,
                                "operation_name": op.operation_name,
                                "sequence": op.sequence,
                                "work_center_id": op.work_center_id,
                                "work_center_name": op.work_center_name,
                                "planned_start_date": op.planned_start_date,
                                "planned_end_date": op.planned_end_date,
                                "assigned_worker_id": op.assigned_worker_id,
                                "assigned_worker_name": op.assigned_worker_name,
                                "assigned_team_id": op.assigned_team_id,
                                "assigned_team_name": op.assigned_team_name,
                                "assigned_station_id": op.assigned_station_id,
                                "assigned_station_name": op.assigned_station_name,
                                "assigned_equipment_id": op.assigned_equipment_id,
                                "assigned_equipment_name": op.assigned_equipment_name,
                                "assigned_mold_name": op.assigned_mold_name,
                                "assigned_tool_name": op.assigned_tool_name,
                            }
                            for op in ops
                        ]
                    if include_operation_steps:
                        raw_ops = [
                            {
                                "operation_name": op.operation_name,
                                "sequence": op.sequence,
                                "status": op.status,
                                "qualified_quantity": op.qualified_quantity,
                            }
                            for op in ops
                        ]
                        operation_steps_map[wo_id] = build_work_order_operation_steps(
                            raw_ops,
                            qty_by_wo.get(wo_id, 0),
                        )

        # 齐套率：读持久化字段；include_readiness=true 时强制重算当前页；缺失值同步补算当前页后返回
        from apps.kuaizhizao.services.work_order_readiness_service import WorkOrderReadinessService

        if include_readiness and work_orders:
            await WorkOrderReadinessService().refresh_work_orders(
                tenant_id, [wo.id for wo in work_orders if wo.id is not None]
            )
            work_orders = await query.offset(skip).limit(limit).order_by(order_clause).all()

        group_ids = list({wo.work_order_group_id for wo in work_orders if wo.work_order_group_id})
        group_code_map: dict[int, str] = {}
        group_name_map: dict[int, str] = {}
        if group_ids:
            from apps.kuaizhizao.models.work_order_group import WorkOrderGroup

            groups = await WorkOrderGroup.filter(tenant_id=tenant_id, id__in=group_ids).only(
                "id", "group_code", "group_name"
            )
            group_code_map = {g.id: g.group_code for g in groups}
            group_name_map = {
                g.id: (g.group_name or "").strip()
                for g in groups
                if (g.group_name or "").strip()
            }

        # 转换为响应格式
        result = []
        result_dicts: list[dict] = []
        wo_ids_for_cap = [wo.id for wo in work_orders if wo.id is not None]
        returnable_by_wo = await self._get_production_return_service().batch_work_orders_have_returnable_picking(
            tenant_id,
            wo_ids_for_cap,
        )
        downstream_by_wo = await self.batch_work_orders_have_revoke_blocking_downstream(
            tenant_id,
            [int(i) for i in wo_ids_for_cap],
        )
        push_progress_by_wo: Dict[int, float] = {}
        if include_downstream_push_progress and work_orders:
            push_progress_by_wo = await self._batch_work_order_downstream_push_progress(
                tenant_id,
                list(work_orders),
            )

        from core.services.approval.audit_record_enricher import audit_enabled_for, enrich_items

        audit_required = await audit_enabled_for(tenant_id, "work_order")

        for wo in work_orders:
            try:
                item_dict = WorkOrderListResponse.model_validate(wo).model_dump()

                if include_operations:
                    item_dict["operations"] = operations_map.get(wo.id, [])

                if include_operation_steps and wo.id is not None:
                    item_dict["operation_steps"] = operation_steps_map.get(wo.id, [])

                # product_id → 工单制造的产品物料 → 该物料档案上的制造模式 / 规格
                item_dict["manufacturing_mode"] = manufacturing_mode_by_product.get(
                    wo.product_id, "fabrication"
                ) if wo.product_id else "fabrication"
                if wo.product_id and wo.product_id in material_spec_by_product:
                    item_dict["material_spec"] = material_spec_by_product[wo.product_id]
                if wo.product_id and wo.product_id in material_by_product:
                    from apps.kuaizhizao.utils.material_unit_utils import build_work_order_unit_fields

                    item_dict.update(build_work_order_unit_fields(material_by_product[wo.product_id], wo))

                if wo.sales_order_id and not item_dict.get("sales_order_code"):
                    snap = so_snapshot_map.get(wo.sales_order_id)
                    if snap:
                        item_dict["sales_order_code"] = snap[0]
                        item_dict["sales_order_name"] = snap[1]

                if wo.work_order_group_id:
                    gid = wo.work_order_group_id
                    item_dict["group_code"] = group_code_map.get(gid)
                    if gid in group_name_map:
                        item_dict["group_name"] = group_name_map[gid]

                item_dict["capabilities"] = derive_work_order_capabilities(
                    wo,
                    has_returnable_picking=returnable_by_wo.get(int(wo.id), False) if wo.id is not None else False,
                    has_downstream_documents=downstream_by_wo.get(int(wo.id), False) if wo.id is not None else False,
                    audit_required=audit_required,
                )
                if wo.id is not None:
                    item_dict["downstream_push_progress"] = push_progress_by_wo.get(int(wo.id), 0.0)

                result_dicts.append(item_dict)
            except Exception as e:
                logger.error(f"处理工单 {wo.id} 数据失败: {str(e)}")
                continue

        if include_scores and result_dicts:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
            await WorkOrderScoreService().attach_scores_to_list_items(tenant_id, result_dicts)

        for item_dict in result_dicts:
            try:
                result.append(WorkOrderListResponse.model_validate(item_dict))
            except Exception as e:
                logger.error(f"工单列表响应校验失败: {str(e)}")
                continue

        result = await enrich_items(
            tenant_id, "work_order", result, audit_enabled=audit_required
        )

        result = await WorkOrderTreeService().attach_tree_children(
            tenant_id,
            result,
            operation_steps_by_wo_id=operation_steps_map if include_operation_steps else None,
            refresh_stale_readiness=include_readiness,
        )

        return result, total

    async def get_work_order_count(
        self,
        tenant_id: int,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        production_mode: Optional[str] = None,
        status: Optional[str] = None,
        workshop_id: Optional[int] = None,
        work_center_id: Optional[int] = None,
        assigned_worker_id: Optional[int] = None,
    ) -> int:
        """
        获取工单总数（用于分页）

        Args:
            tenant_id: 组织ID
            code: 工单编码（模糊搜索）
            name: 工单名称（模糊搜索）
            product_name: 产品名称（模糊搜索）
            production_mode: 生产模式
            status: 工单状态
            workshop_id: 车间ID
            work_center_id: 工作中心ID
            assigned_worker_id: 分配员工ID

        Returns:
            int: 工单总数
        """
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,  # 只查询未删除的工单
            parent_work_order_id__isnull=True,  # 与 list_work_orders 一致：仅计根工单
        )

        # 添加筛选条件（与 list_work_orders 保持一致）
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if production_mode:
            query = query.filter(production_mode=production_mode)
        if status:
            query = query.filter(status=status)
        if workshop_id:
            query = query.filter(workshop_id=workshop_id)
        if work_center_id:
            query = query.filter(work_center_id=work_center_id)
        if assigned_worker_id:
            from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
            wo_ids_primary = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_id=assigned_worker_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            wo_ids_multi = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_ids__contains=assigned_worker_id,
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            wo_id_set = set(wo_ids_primary) | set(wo_ids_multi)
            if wo_id_set:
                query = query.filter(id__in=wo_id_set)
            else:
                query = query.filter(id__in=[])

        return await query.count()

    async def update_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order_data: WorkOrderUpdate,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            work_order_data: 工单更新数据
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        score_recalc_fields = ("priority", "planned_start_date", "planned_end_date")
        tracking_update_fields = (
            "planned_batch_no",
            "confirmed_batch_no",
            "planned_serial_no",
            "confirmed_serial_no",
        )
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            update_data = work_order_data.model_dump(exclude_unset=True)
            if update_data.get("status") == "cancelled":
                assert_work_order_capability(work_order, "cancel")
            old_score_values = {f: getattr(work_order, f, None) for f in score_recalc_fields}

            tracking_patch = {
                field: update_data.pop(field)
                for field in tracking_update_fields
                if field in update_data
            }
            if tracking_patch:
                material = await Material.get_or_none(
                    id=work_order.product_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if material:
                    await WorkOrderTrackingService().apply_manual_tracking_update(
                        tenant_id,
                        work_order,
                        material,
                        tracking_patch,
                    )
                    work_order = await self.get_by_id(
                        tenant_id, work_order_id, raise_if_not_found=True
                    )

            for _dt_key in (
                "planned_start_date",
                "planned_end_date",
                "actual_start_date",
                "actual_end_date",
            ):
                if _dt_key in update_data and update_data[_dt_key] is not None:
                    update_data[_dt_key] = coerce_business_datetime_to_utc(update_data[_dt_key])

            _assert_work_order_planned_dates_unchanged_or_editable(work_order, update_data)

            if "process_route_id" in update_data:
                new_pr_id = update_data.pop("process_route_id")
                old_pr_id = getattr(work_order, "process_route_id", None)
                if new_pr_id != old_pr_id:
                    if work_order.status != "draft":
                        raise BusinessLogicError("仅草稿状态的工单可修改来源工艺路线")
                    rc = await ReportingRecord.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                    ).count()
                    if rc > 0:
                        raise BusinessLogicError("已有报工记录，不能更换来源工艺路线")
                    existing_ops = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                        deleted_at__isnull=True,
                    ).all()
                    if any(getattr(o, "status", None) != "pending" for o in existing_ops):
                        raise BusinessLogicError("存在非待开始工序，不能更换来源工艺路线")
                    if new_pr_id is None:
                        if existing_ops:
                            raise BusinessLogicError("存在工序时不能清空来源工艺路线")
                    else:
                        pr = await ProcessRoute.get_or_none(
                            id=new_pr_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True,
                        )
                        if not pr:
                            raise NotFoundError(f"工艺路线不存在: id={new_pr_id}")
                        seq_data, _jump = (
                            await MaterialProductProcessService.resolve_sequence_for_material(
                                tenant_id,
                                work_order.product_id,
                                pr,
                            )
                        )
                        now = now_utc()
                        for op in existing_ops:
                            op.deleted_at = now
                            await op.save()
                        await self._generate_work_order_operations_from_route(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            process_route=pr,
                            created_by=updated_by,
                            operation_sequence=seq_data,
                        )
                    update_data["process_route_id"] = new_pr_id
                else:
                    update_data["process_route_id"] = new_pr_id

            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=updated_by,
                **update_data
            )

            if update_data.get("status") == "cancelled":
                from apps.kuaizhizao.services.batching_order_service import BatchingOrderService

                await BatchingOrderService().void_open_batching_orders_for_work_order(
                    tenant_id, work_order_id
                )

            response = WorkOrderResponse.model_validate(work_order)
            response = response.model_copy(
                update=WorkOrderTrackingService.tracking_fields_for_response(work_order)
            )

        needs_score_recalc = any(
            f in update_data and update_data.get(f) != old_score_values.get(f)
            for f in score_recalc_fields
        )
        if needs_score_recalc:
            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            await dispatch_work_order_score_recalc(work_order_id, include_kitting=False)

        readiness_recalc_fields = (
            "quantity",
            "product_id",
            "product_code",
            "product_name",
            "variant_attributes",
            "configurable_selections",
            "status",
        )
        if any(f in update_data for f in readiness_recalc_fields):
            from apps.kuaizhizao.services.work_order_readiness_service import (
                dispatch_work_order_readiness_refresh,
            )
            await dispatch_work_order_readiness_refresh(tenant_id, work_order_id)

        return response

    async def batch_update_dates(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
        *,
        bypass_freeze: bool = False,
    ) -> Dict[str, Any]:
        """
        批量更新工单计划日期（甘特图拖拽后持久化）

        Returns:
            updated / skipped_frozen / skipped_freeze_window / failed
        """
        from apps.kuaizhizao.services.scheduling_freeze import freeze_lock_reason
        from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService

        result: Dict[str, Any] = {
            "updated": [],
            "skipped_frozen": [],
            "skipped_freeze_window": [],
            "skipped_not_schedulable": [],
            "failed": [],
        }
        if not updates:
            return result
        constraints = await VisualSchedulingService()._load_constraints(tenant_id)
        freeze_days = int(constraints.get("freeze_horizon_days", 0))
        updated_wo_ids: List[int] = []
        async with in_transaction():
            for item in updates[:50]:
                wo_id = item.work_order_id if hasattr(item, 'work_order_id') else item.get('work_order_id')
                start = item.planned_start_date if hasattr(item, 'planned_start_date') else item.get('planned_start_date')
                end = item.planned_end_date if hasattr(item, 'planned_end_date') else item.get('planned_end_date')
                if not wo_id or not start or not end:
                    continue
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=wo_id)
                if not wo:
                    result["failed"].append({"id": int(wo_id), "reason": "工单不存在"})
                    continue
                if not _is_schedulable_work_order_status(wo.status):
                    wo_id_int = int(wo.id)
                    if wo_id_int not in result["skipped_not_schedulable"]:
                        result["skipped_not_schedulable"].append(wo_id_int)
                    continue
                lock = None if bypass_freeze else freeze_lock_reason(wo, freeze_days)
                if lock == "frozen":
                    result["skipped_frozen"].append(int(wo_id))
                    continue
                if lock == "freeze_window":
                    result["skipped_freeze_window"].append(int(wo_id))
                    continue
                wo.planned_start_date = coerce_business_datetime_to_utc(start)
                wo.planned_end_date = coerce_business_datetime_to_utc(end)
                wo.updated_by = updated_by
                await wo.save()
                updated_wo_ids.append(int(wo_id))
                result["updated"].append(int(wo_id))

        if updated_wo_ids:
            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            for wo_id in updated_wo_ids:
                await dispatch_work_order_score_recalc(wo_id, include_kitting=False)
        return result

    async def batch_update_operation_dates(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
    ) -> Dict[str, Any]:
        """
        批量更新工序计划日期（工序级派工，甘特图拖拽工序后持久化）
        """
        from apps.kuaizhizao.services.scheduling_freeze import freeze_lock_reason, is_planned_start_in_freeze_window
        from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService

        result: Dict[str, Any] = {
            "updated": [],
            "skipped_frozen": [],
            "skipped_freeze_window": [],
            "skipped_not_schedulable": [],
            "failed": [],
        }
        if not updates:
            return result
        constraints = await VisualSchedulingService()._load_constraints(tenant_id)
        freeze_days = int(constraints.get("freeze_horizon_days", 0))
        updated_wo_ids: set[int] = set()
        async with in_transaction():
            for item in updates[:50]:
                op_id = item.operation_id if hasattr(item, 'operation_id') else item.get('operation_id')
                start = item.planned_start_date if hasattr(item, 'planned_start_date') else item.get('planned_start_date')
                end = item.planned_end_date if hasattr(item, 'planned_end_date') else item.get('planned_end_date')
                if not op_id or not start or not end:
                    continue
                op = await WorkOrderOperation.get_or_none(tenant_id=tenant_id, id=op_id)
                if not op:
                    result["failed"].append({"id": int(op_id), "reason": "工序不存在"})
                    continue
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=op.work_order_id)
                if not wo:
                    result["failed"].append({"id": int(op_id), "reason": "工单不存在"})
                    continue
                if not _is_schedulable_work_order_status(wo.status):
                    wo_id_int = int(wo.id)
                    if wo_id_int not in result["skipped_not_schedulable"]:
                        result["skipped_not_schedulable"].append(wo_id_int)
                    continue
                lock = freeze_lock_reason(wo, freeze_days)
                if lock == "frozen":
                    if int(wo.id) not in result["skipped_frozen"]:
                        result["skipped_frozen"].append(int(wo.id))
                    continue
                is_first_schedule = op.planned_start_date is None or op.planned_end_date is None
                if (
                    not is_first_schedule
                    and is_planned_start_in_freeze_window(start, freeze_days)
                ):
                    if int(wo.id) not in result["skipped_freeze_window"]:
                        result["skipped_freeze_window"].append(int(wo.id))
                    continue
                await WorkOrderOperation.filter(tenant_id=tenant_id, id=op_id).update(
                    planned_start_date=coerce_business_datetime_to_utc(start),
                    planned_end_date=coerce_business_datetime_to_utc(end),
                )
                result["updated"].append(int(op_id))
                ops = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=op.work_order_id,
                    deleted_at__isnull=True,
                ).order_by("sequence").all()
                wo_start = min(
                    (o.planned_start_date for o in ops if o.planned_start_date),
                    default=wo.planned_start_date,
                )
                wo_end = max(
                    (o.planned_end_date for o in ops if o.planned_end_date),
                    default=wo.planned_end_date,
                )
                if wo_start and wo_end:
                    await WorkOrder.filter(tenant_id=tenant_id, id=op.work_order_id).update(
                        planned_start_date=wo_start,
                        planned_end_date=wo_end,
                        updated_by=updated_by,
                    )
                    updated_wo_ids.add(int(op.work_order_id))

        if updated_wo_ids:
            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            for wo_id in updated_wo_ids:
                await dispatch_work_order_score_recalc(wo_id, include_kitting=False)
        return result

    async def batch_update_operation_stations(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
    ) -> Dict[str, Any]:
        """批量更新工序指派工位（可视排产跨工位改派）。"""
        from apps.master_data.models.factory import Workstation

        result: Dict[str, Any] = {
            "updated": [],
            "skipped_frozen": [],
            "failed": [],
        }
        if not updates:
            return result
        async with in_transaction():
            for item in updates[:50]:
                op_id = item.operation_id if hasattr(item, "operation_id") else item.get("operation_id")
                station_id = (
                    item.assigned_station_id
                    if hasattr(item, "assigned_station_id")
                    else item.get("assigned_station_id")
                )
                if not op_id or not station_id:
                    continue
                op = await WorkOrderOperation.get_or_none(tenant_id=tenant_id, id=op_id, deleted_at__isnull=True)
                if not op:
                    result["failed"].append({"id": int(op_id), "reason": "工序不存在"})
                    continue
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=op.work_order_id, deleted_at__isnull=True)
                if not wo:
                    result["failed"].append({"id": int(op_id), "reason": "工单不存在"})
                    continue
                if wo.is_frozen:
                    if int(wo.id) not in result["skipped_frozen"]:
                        result["skipped_frozen"].append(int(wo.id))
                    continue
                from apps.kuaizhizao.utils.outsource_operation import occupies_factory_capacity

                if not occupies_factory_capacity(op):
                    result["failed"].append({"id": int(op_id), "reason": "委外工序不占本厂工位，不可改派"})
                    continue
                station = await Workstation.get_or_none(tenant_id=tenant_id, id=int(station_id), deleted_at__isnull=True)
                station_name = station.name if station else f"工位{station_id}"
                await WorkOrderOperation.filter(tenant_id=tenant_id, id=op_id).update(
                    assigned_station_id=int(station_id),
                    assigned_station_name=station_name,
                )
                wo.updated_by = updated_by
                await wo.save(update_fields=["updated_by", "updated_at"])
                result["updated"].append(int(op_id))
        return result

    async def batch_update_operation_assignments(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
    ) -> Dict[str, Any]:
        """批量更新工序派工资源（人员/设备/模具/工装）。"""
        from apps.kuaizhizao.models.equipment import Equipment
        from apps.kuaizhizao.models.mold import Mold
        from apps.kuaizhizao.models.tool import Tool
        from apps.master_data.models.factory import WorkGroup
        from infra.models.user import User

        result: Dict[str, Any] = {
            "updated": [],
            "skipped_frozen": [],
            "failed": [],
        }
        if not updates:
            return result

        user_info = await self.get_user_info(updated_by)
        now = resolve_business_datetime()

        async with in_transaction():
            for item in updates[:50]:
                op_id = item.operation_id if hasattr(item, "operation_id") else item.get("operation_id")
                if not op_id:
                    continue
                op = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id, id=op_id, deleted_at__isnull=True
                )
                if not op:
                    result["failed"].append({"id": int(op_id), "reason": "工序不存在"})
                    continue
                wo = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, id=op.work_order_id, deleted_at__isnull=True
                )
                if not wo:
                    result["failed"].append({"id": int(op_id), "reason": "工单不存在"})
                    continue
                if wo.is_frozen:
                    if int(wo.id) not in result["skipped_frozen"]:
                        result["skipped_frozen"].append(int(wo.id))
                    continue

                patch_fields: Dict[str, Any] = {}
                if hasattr(item, "model_dump"):
                    raw = item.model_dump(exclude_unset=True)
                else:
                    raw = dict(item)

                worker_id = raw.get("assigned_worker_id")
                if worker_id is not None:
                    if int(worker_id) > 0:
                        user = await User.get_or_none(id=int(worker_id), tenant_id=tenant_id)
                        patch_fields["assigned_worker_id"] = int(worker_id)
                        patch_fields["assigned_worker_name"] = (
                            (user.full_name or user.username) if user else f"员工{worker_id}"
                        )
                    else:
                        patch_fields["assigned_worker_id"] = None
                        patch_fields["assigned_worker_name"] = None

                team_id = raw.get("assigned_team_id")
                if team_id is not None:
                    if int(team_id) > 0:
                        team = await WorkGroup.get_or_none(
                            tenant_id=tenant_id, id=int(team_id), deleted_at__isnull=True
                        )
                        patch_fields["assigned_team_id"] = int(team_id)
                        patch_fields["assigned_team_name"] = team.name if team else f"小组{team_id}"
                    else:
                        patch_fields["assigned_team_id"] = None
                        patch_fields["assigned_team_name"] = None

                equipment_id = raw.get("assigned_equipment_id")
                if equipment_id is not None:
                    if int(equipment_id) > 0:
                        eq = await Equipment.get_or_none(
                            tenant_id=tenant_id, id=int(equipment_id), deleted_at__isnull=True
                        )
                        patch_fields["assigned_equipment_id"] = int(equipment_id)
                        patch_fields["assigned_equipment_name"] = eq.name if eq else f"设备{equipment_id}"
                    else:
                        patch_fields["assigned_equipment_id"] = None
                        patch_fields["assigned_equipment_name"] = None

                mold_id = raw.get("assigned_mold_id")
                if mold_id is not None:
                    if int(mold_id) > 0:
                        mold = await Mold.get_or_none(
                            tenant_id=tenant_id, id=int(mold_id), deleted_at__isnull=True
                        )
                        patch_fields["assigned_mold_id"] = int(mold_id)
                        patch_fields["assigned_mold_name"] = mold.name if mold else f"模具{mold_id}"
                    else:
                        patch_fields["assigned_mold_id"] = None
                        patch_fields["assigned_mold_name"] = None

                tool_id = raw.get("assigned_tool_id")
                if tool_id is not None:
                    if int(tool_id) > 0:
                        tool = await Tool.get_or_none(
                            tenant_id=tenant_id, id=int(tool_id), deleted_at__isnull=True
                        )
                        patch_fields["assigned_tool_id"] = int(tool_id)
                        patch_fields["assigned_tool_name"] = tool.name if tool else f"工装{tool_id}"
                    else:
                        patch_fields["assigned_tool_id"] = None
                        patch_fields["assigned_tool_name"] = None

                if not patch_fields:
                    continue

                patch_fields["assigned_at"] = now
                patch_fields["assigned_by"] = updated_by
                patch_fields["assigned_by_name"] = user_info["name"]
                await WorkOrderOperation.filter(tenant_id=tenant_id, id=op_id).update(**patch_fields)
                wo.updated_by = updated_by
                await wo.save(update_fields=["updated_by", "updated_at"])
                result["updated"].append(int(op_id))
        return result

    async def _upsert_delivery_delay_exception(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        *,
        delay_days: int,
        reason: str,
        suggested_action: str,
        status: str,
        handled_by: int,
    ) -> None:
        existing = await DeliveryDelayException.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status__in=["pending", "processing"],
        ).first()
        user_info = await self.get_user_info(handled_by)
        if existing:
            existing.delay_days = delay_days
            existing.delay_reason = reason
            existing.suggested_action = suggested_action
            existing.status = status
            existing.handled_by = handled_by
            existing.handled_by_name = user_info["name"]
            existing.handled_at = resolve_business_datetime()
            await existing.save()
            return
        await DeliveryDelayException.create(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            work_order_code=work_order.code or str(work_order.id),
            planned_end_date=work_order.planned_end_date or resolve_business_datetime(),
            actual_end_date=work_order.actual_end_date,
            delay_days=max(0, int(delay_days)),
            delay_reason=reason,
            alert_level=(
                "critical"
                if delay_days >= 7
                else "high"
                if delay_days >= 3
                else "medium"
                if delay_days >= 1
                else "low"
            ),
            status=status,
            suggested_action=suggested_action,
            handled_by=handled_by,
            handled_by_name=user_info["name"],
            handled_at=resolve_business_datetime(),
        )

    async def _move_work_order_out_of_freeze_window(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        *,
        updated_by: int,
    ) -> bool:
        from apps.kuaizhizao.services.visual_scheduling_service import VisualSchedulingService
        from apps.kuaizhizao.services.scheduling_freeze import (
            freeze_anchor_datetime,
            is_planned_start_in_freeze_window,
        )

        constraints = await VisualSchedulingService()._load_constraints(tenant_id)
        freeze_days = int(constraints.get("freeze_horizon_days", 0))
        start = work_order.planned_start_date
        end = work_order.planned_end_date
        if not start or not end:
            return False
        if not is_planned_start_in_freeze_window(start, freeze_days):
            return False
        anchor = freeze_anchor_datetime(freeze_days)
        duration = max(end - start, timedelta(hours=1))
        new_start = anchor + timedelta(seconds=1)
        new_end = new_start + duration
        work_order.planned_start_date = new_start
        work_order.planned_end_date = new_end
        work_order.updated_by = updated_by
        await work_order.save()
        return True

    async def build_reschedule_forward_proposals(
        self,
        tenant_id: int,
        work_order_ids: List[int],
    ) -> Dict[str, Any]:
        """为逾期工单生成顺延重排提案（不落库）。"""
        from apps.kuaizhizao.services.rolling_schedule_service import RollingScheduleService
        from apps.kuaizhizao.utils.work_order_operation_scheduling import (
            build_operation_time_slots,
            operation_total_hours,
        )

        now = resolve_business_datetime()
        proposals: Dict[str, Any] = {
            "summary": None,
            "warnings": [],
            "work_order_adjustments": [],
            "operation_adjustments": [],
            "operation_station_adjustments": [],
        }
        if not work_order_ids:
            return proposals

        rolling_svc = RollingScheduleService()
        from apps.kuaizhizao.utils.working_time import load_scheduling_work_context
        next_day = await rolling_svc.get_next_workday(tenant_id, now.date())
        _holidays, _work_hours, _overtime = await load_scheduling_work_context(tenant_id, around=next_day)
        anchor_start = datetime.combine(next_day, _work_hours.start)

        wos = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=work_order_ids[:50],
            deleted_at__isnull=True,
        ).all()
        wo_by_id = {int(wo.id): wo for wo in wos}

        for wo_id in work_order_ids[:50]:
            wo = wo_by_id.get(int(wo_id))
            if not wo:
                proposals["warnings"].append(f"工单 {wo_id} 不存在")
                continue
            if wo.status not in {"released", "in_progress"}:
                proposals["warnings"].append(f"工单 {wo.code} 状态不可顺延")
                continue
            if not wo.planned_end_date or wo.planned_end_date >= now:
                proposals["warnings"].append(f"工单 {wo.code} 未逾期，跳过")
                continue
            if wo.is_frozen:
                proposals["warnings"].append(f"工单 {wo.code} 已冻结，跳过")
                continue

            ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=wo.id,
                deleted_at__isnull=True,
            ).order_by("sequence").all()
            pending_ops = [op for op in ops if op.status not in {"completed", "cancelled"}]
            if not pending_ops:
                proposals["warnings"].append(f"工单 {wo.code} 无待排工序")
                continue

            durations = [
                operation_total_hours(op.setup_time, op.standard_time, wo.quantity)
                for op in pending_ops
            ]
            slots = build_operation_time_slots(
                durations,
                planned_start=anchor_start,
                holidays=_holidays,
                work_hours=_work_hours,
                overtime=_overtime,
            )
            for op, (start, end) in zip(pending_ops, slots):
                proposals["operation_adjustments"].append(
                    {
                        "operation_id": int(op.id),
                        "planned_start_date": start.isoformat(),
                        "planned_end_date": end.isoformat(),
                    }
                )
            if slots:
                wo_start = slots[0][0]
                wo_end = slots[-1][1]
                proposals["work_order_adjustments"].append(
                    {
                        "work_order_id": int(wo.id),
                        "planned_start_date": wo_start.isoformat(),
                        "planned_end_date": wo_end.isoformat(),
                    }
                )

        count = len(proposals["work_order_adjustments"])
        proposals["summary"] = f"已为 {count} 张逾期工单生成顺延重排提案（锚点 {next_day}）"
        return proposals

    async def apply_reschedule_forward(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        *,
        handled_by: int,
        reason: str = "可视排产顺延重排",
    ) -> Dict[str, Any]:
        """将逾期工单计划顺延到下一工作日起并落库。"""
        result: Dict[str, Any] = {
            "updated": [],
            "converted_to_exception": [],
            "unfreezed": [],
            "skipped": [],
            "failed": [],
        }
        proposals = await self.build_reschedule_forward_proposals(tenant_id, work_order_ids)
        wo_updates = proposals.get("work_order_adjustments") or []
        op_updates = proposals.get("operation_adjustments") or []
        if not wo_updates and not op_updates:
            return result

        wo_ids_touched = {int(u["work_order_id"]) for u in wo_updates}
        if op_updates:
            op_result = await self.batch_update_operation_dates(
                tenant_id=tenant_id,
                updates=op_updates,
                updated_by=handled_by,
            )
            for fail in op_result.get("failed") or []:
                result["failed"].append(fail)
        if wo_updates:
            wo_result = await self.batch_update_dates(
                tenant_id=tenant_id,
                updates=wo_updates,
                updated_by=handled_by,
            )
            for fail in wo_result.get("failed") or []:
                result["failed"].append(fail)

        now = resolve_business_datetime()
        wos = await WorkOrder.filter(tenant_id=tenant_id, id__in=list(wo_ids_touched)).all()
        for wo in wos:
            delay_days = (now - wo.planned_end_date).days if wo.planned_end_date and wo.planned_end_date < now else 0
            try:
                await self._upsert_delivery_delay_exception(
                    tenant_id,
                    wo,
                    delay_days=delay_days,
                    reason=reason,
                    suggested_action="adjust_plan",
                    status="processing",
                    handled_by=handled_by,
                )
                result["updated"].append(int(wo.id))
            except Exception as exc:
                result["failed"].append({"id": int(wo.id), "reason": str(exc)})
        return result

    async def scheduling_quick_action(
        self,
        tenant_id: int,
        body: WorkOrderSchedulingQuickActionRequest,
        handled_by: int,
    ) -> Dict[str, Any]:
        action = str(body.action or "").strip()
        if action not in {"confirm_delay", "to_exception", "apply_unfreeze", "reschedule_forward"}:
            raise ValidationError("不支持的快捷处置动作")
        result: Dict[str, Any] = {
            "updated": [],
            "converted_to_exception": [],
            "unfreezed": [],
            "skipped": [],
            "failed": [],
        }
        now = resolve_business_datetime()
        ids = [int(i) for i in body.work_order_ids[:50] if int(i) > 0]
        if not ids:
            return result
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).all()
        by_id = {int(wo.id): wo for wo in work_orders}
        for wo_id in ids:
            wo = by_id.get(int(wo_id))
            if not wo:
                result["failed"].append({"id": int(wo_id), "reason": "工单不存在"})
                continue
            if wo.status not in {"released", "in_progress"}:
                result["skipped"].append(int(wo.id))
                continue
            planned_end = wo.planned_end_date
            delay_days = (now - planned_end).days if planned_end and planned_end < now else 0
            reason = body.reason or "可视排产快捷处置"
            try:
                if action == "reschedule_forward":
                    fwd = await self.apply_reschedule_forward(
                        tenant_id,
                        [int(wo.id)],
                        handled_by=handled_by,
                        reason=reason,
                    )
                    if fwd["updated"]:
                        result["updated"].extend(fwd["updated"])
                    elif fwd["failed"]:
                        result["failed"].extend(fwd["failed"])
                    else:
                        result["skipped"].append(int(wo.id))
                    continue
                if action == "to_exception":
                    await self._upsert_delivery_delay_exception(
                        tenant_id,
                        wo,
                        delay_days=delay_days,
                        reason=reason,
                        suggested_action="expedite",
                        status="processing",
                        handled_by=handled_by,
                    )
                    result["converted_to_exception"].append(int(wo.id))
                    continue
                if action == "apply_unfreeze":
                    if wo.is_frozen:
                        wo.is_frozen = False
                        wo.updated_by = handled_by
                        await wo.save(update_fields=["is_frozen", "updated_by", "updated_at"])
                        result["unfreezed"].append(int(wo.id))
                    else:
                        result["skipped"].append(int(wo.id))
                        continue
                await self._upsert_delivery_delay_exception(
                    tenant_id,
                    wo,
                    delay_days=delay_days,
                    reason=reason,
                    suggested_action="adjust_plan",
                    status="processing",
                    handled_by=handled_by,
                )
                moved = False
                if body.auto_move_out_of_freeze_window and not wo.is_frozen:
                    moved = await self._move_work_order_out_of_freeze_window(
                        tenant_id,
                        wo,
                        updated_by=handled_by,
                    )
                if moved:
                    result["updated"].append(int(wo.id))
                else:
                    result["skipped"].append(int(wo.id))
            except Exception as exc:
                result["failed"].append({"id": int(wo.id), "reason": str(exc)})
        return result

    async def delete_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        删除工单（软删除）

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许删除的工单状态
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            split_parent_id = work_order.parent_work_order_id
            split_child_ops_template: List[WorkOrderOperation] = []
            if split_parent_id is not None:
                split_child_ops_template = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).order_by("sequence").all()

            # 已拆分主工单：无子单时可删；capability 默认禁删 split，此处单独放行
            if (work_order.status or "") == "split" and work_order.parent_work_order_id is None:
                child_count = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    parent_work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).count()
                if child_count > 0:
                    raise ValidationError("已拆分主工单存在子工单，不能删除。请先删除全部拆分工单或使用撤销拆分")
            else:
                assert_work_order_capability(work_order, "delete")

            if work_order.parent_work_order_id is not None:
                if work_order.status == "released":
                    if work_order.actual_start_date or (
                        work_order.completed_quantity and work_order.completed_quantity > 0
                    ):
                        raise ValidationError("已开始执行的拆分工单不能删除")
                elif work_order.status not in ["draft", "cancelled"]:
                    raise ValidationError("只能删除草稿、已取消或未执行的拆分工单")
            elif (work_order.status or "") == "split":
                pass  # 无子单校验已在上方完成
            elif work_order.status == "released":
                if work_order.actual_start_date or (
                    work_order.completed_quantity and work_order.completed_quantity > 0
                ):
                    raise ValidationError("已开始执行的工单不能删除")
            elif work_order.status not in ["draft", "cancelled"]:
                raise ValidationError("只能删除草稿、已取消或未执行的工单")

            # 检查是否有报工记录（包括待审核的）
            reporting_count = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id
            ).count()
            
            if reporting_count > 0:
                raise ValidationError("工单存在相关的报工记录，不允许删除")

            now = now_utc()

            from apps.kuaizhizao.services.batching_order_service import BatchingOrderService

            await BatchingOrderService().void_open_batching_orders_for_work_order(
                tenant_id, work_order_id
            )

            # 级联软删除工单工序
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).update(deleted_at=now)

            # 软删除工单
            await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id
            ).update(deleted_at=now)

            if split_parent_id is not None:
                await self._remove_split_document_relation(
                    tenant_id,
                    parent_id=int(split_parent_id),
                    child_id=int(work_order_id),
                )
                await self._restore_split_parent_if_no_children(
                    tenant_id,
                    parent_work_order_id=int(split_parent_id),
                    template_ops=split_child_ops_template,
                    restored_by=work_order.updated_by or work_order.created_by or 0,
                    restore_status_hint=work_order.status,
                )

    async def check_material_shortage(
        self,
        tenant_id: int,
        work_order_id: int,
        warehouse_id: Optional[int] = None
    ) -> dict:
        """
        检查工单缺料情况

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            warehouse_id: 仓库ID（可选，如果为None则查询所有仓库）

        Returns:
            dict: 缺料检测结果，包含：
            - has_shortage: 是否有缺料
            - shortage_items: 缺料明细列表
            - total_shortage_count: 缺料物料总数
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

        # 获取BOM物料需求（配置件时传入 variant_attributes，配置位时传入 configurable_selections）
        try:
            variant_attrs = getattr(work_order, "variant_attributes", None)
            cfg_selections = getattr(work_order, "configurable_selections", None)
            if cfg_selections and isinstance(cfg_selections, dict):
                try:
                    cfg_selections = {str(k): int(v) for k, v in cfg_selections.items() if v is not None}
                except (TypeError, ValueError):
                    cfg_selections = None
            # 与领料同口径：只校验一阶物料（自制/委外子件走各自工单，不拆子 BOM），
            # 否则半成品及其原材料被双重计入需求，出现虚假缺料
            material_requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=work_order.product_id,
                required_quantity=float(work_order.quantity),
                only_approved=True,
                variant_attributes=variant_attrs,
                configurable_selections=cfg_selections,
                for_kitting_analysis=True,
            )
        except NotFoundError:
            # 如果没有BOM，返回无缺料
            logger.warning(f"工单 {work_order.code} 的产品 {work_order.product_id} 没有BOM，跳过缺料检测")
            return {
                "has_shortage": False,
                "shortage_items": [],
                "total_shortage_count": 0,
                "work_order_id": work_order_id,
                "work_order_code": work_order.code or "",
                "work_order_name": work_order.name or "",
            }

        shortage_items = []

        # 检查每个物料的需求和库存
        # 下达缺料：服务/委外/虚拟件及发料 none 不校验厂内库存
        # （服务无库存；委外由供应商供给，未入库不阻断下达）
        from apps.kuaizhizao.utils.issue_method_resolver import is_kitting_inventory_material

        for requirement in material_requirements:
            if not is_kitting_inventory_material(
                getattr(requirement, "issue_method", None),
                getattr(requirement, "component_type", None),
            ):
                continue
            # 获取可用库存
            available_quantity = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=requirement.component_id,
                warehouse_id=warehouse_id
            )
            
            # 计算缺料数量
            shortage_quantity = max(Decimal(0), Decimal(str(requirement.net_requirement)) - available_quantity)
            
            if shortage_quantity > 0:
                shortage_items.append({
                    "material_id": requirement.component_id,
                    "material_code": requirement.component_code,
                    "material_name": requirement.component_name,
                    "required_quantity": float(requirement.net_requirement),
                    "available_quantity": float(available_quantity),
                    "shortage_quantity": float(shortage_quantity),
                    "unit": requirement.unit
                })

        return {
            "has_shortage": len(shortage_items) > 0,
            "shortage_items": shortage_items,
            "total_shortage_count": len(shortage_items),
            "work_order_id": work_order_id,
            "work_order_code": work_order.code or "",
            "work_order_name": work_order.name or "",
        }

    async def submit_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        submitted_by: int,
    ) -> WorkOrderResponse:
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        status = str(work_order.status or "").strip()
        if status not in ("draft", "草稿"):
            raise BusinessLogicError(f"当前状态不可提交审核: {status or '-'}")
        review = str(work_order.review_status or "").strip()
        if review == "待审核":
            return await self.get_work_order_by_id(tenant_id, work_order_id)

        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "work_order"
        )
        if not audit_required:
            submitter_name = await self.get_user_name(submitted_by)
            await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
                review_status="已通过",
                reviewer_id=submitted_by,
                reviewer_name=submitter_name,
                review_time=resolve_business_datetime(),
                updated_by=submitted_by,
            )
            return await self.get_work_order_by_id(tenant_id, work_order_id)

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="work_order",
            entity_type="work_order",
            entity_id=work_order.id,
            entity_uuid=str(work_order.uuid),
            title=f"生产工单审批: {work_order.code}",
            content=f"产品: {work_order.product_name}, 数量: {work_order.quantity}",
        )
        if not instance:
            raise BusinessLogicError(
                "生产工单审核已开启但未找到可用的审批流程，请在配置中心检查 work_order 审批流程是否已激活"
            )
        await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
            review_status="待审核",
            updated_by=submitted_by,
        )
        return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def approve_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        approver_id: int,
    ) -> WorkOrderResponse:
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        status = str(work_order.status or "").strip()
        review = str(work_order.review_status or "").strip()
        if status not in ("draft", "草稿") or review != "待审核":
            raise BusinessLogicError(
                f"只能审核待审核的草稿工单，当前: status={status or '-'}, review={review or '-'}"
            )
        approver_name = await self.get_user_name(approver_id)
        await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
            review_status="已通过",
            reviewer_id=approver_id,
            reviewer_name=approver_name,
            review_time=resolve_business_datetime(),
            updated_by=approver_id,
        )
        return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def reject_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> WorkOrderResponse:
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        status = str(work_order.status or "").strip()
        review = str(work_order.review_status or "").strip()
        if status not in ("draft", "草稿") or review != "待审核":
            raise BusinessLogicError(
                f"只能驳回待审核的草稿工单，当前: status={status or '-'}, review={review or '-'}"
            )
        await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
            review_status="已驳回",
            review_remarks=rejection_reason,
            updated_by=approver_id,
        )
        return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def withdraw_work_order_submit(
        self,
        tenant_id: int,
        work_order_id: int,
        operator_id: int,
    ) -> WorkOrderResponse:
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        status = str(work_order.status or "").strip()
        review = str(work_order.review_status or "").strip()
        if status not in ("draft", "草稿") or review != "待审核":
            raise BusinessLogicError(
                f"只能撤回待审核的草稿工单，当前: status={status or '-'}, review={review or '-'}"
            )
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="work_order",
            entity_id=work_order_id,
            operator_id=operator_id,
        )
        await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
            review_status="草稿",
            updated_by=operator_id,
        )
        return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def revoke_work_order_approval(
        self,
        tenant_id: int,
        work_order_id: int,
        operator_id: int,
    ) -> WorkOrderResponse:
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        status = str(work_order.status or "").strip()
        review = str(work_order.review_status or "").strip()
        if status not in ("draft", "草稿") or review not in ("已通过", "审核通过", "approved"):
            raise BusinessLogicError(
                f"仅已通过审核且未下达的工单可撤销审核，当前: status={status or '-'}, review={review or '-'}"
            )
        audit_required = await BusinessConfigService().check_audit_required(
            tenant_id, "work_order"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_review = "待审核" if landing == "pending" else "草稿"

        async def _do_revoke() -> WorkOrderResponse:
            await WorkOrder.filter(tenant_id=tenant_id, id=work_order_id).update(
                review_status=target_review,
                reviewer_id=None,
                reviewer_name=None,
                review_time=None,
                updated_by=operator_id,
            )
            return await self.get_work_order_by_id(tenant_id, work_order_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="work_order",
            entity_id=work_order_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def release_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        released_by: int,
        check_shortage: bool = True
    ) -> WorkOrderResponse:
        """
        下达工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            released_by: 下达人ID
            check_shortage: 是否在下达前检查缺料（默认：True）

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许下达的工单状态
            BusinessLogicError: 存在缺料时抛出（如果check_shortage=True）
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            audit_required = await BusinessConfigService().check_audit_required(
                tenant_id, "work_order"
            )
            assert_work_order_capability(work_order, "release", audit_required=audit_required)

            if (work_order.status or "") == "split":
                raise BusinessLogicError("已拆分主工单不可下达，请将剩余数量拆分为子工单后由子工单执行")

            if work_order.status != 'draft':
                raise ValidationError("只能下达草稿状态的工单")

            # 检查缺料（按参数开关 + 缺料拦截级别在“下达”阶段是否生效）
            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if check_shortage and _material_shortage_block_applies(block_level, "release"):
                shortage_result = await self.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items") or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        f"工单存在缺料，无法下达。缺料物料：{shortage_materials}"
                        + (f"等{total_shortage_count}种物料" if total_shortage_count > 3 else "")
                        + f"。当前受参数 parameters.work_order.material_shortage_block_level={block_level} 控制"
                    )

            # 更新状态
            material = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if material:
                tracking_service = WorkOrderTrackingService()
                work_order = await tracking_service.allocate_on_release(
                    tenant_id, work_order, material
                )

            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=released_by,
                status='released'
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束"创建"节点
                await timing_service.record_node_end(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    node_code="created",
                    operator_id=released_by,
                )
                # 开始"下达"节点
                released_by_info = await self.get_user_info(released_by)
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    document_code=work_order.code,
                    node_name="下达",
                    node_code="released",
                    operator_id=released_by,
                    operator_name=released_by_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单下达节点时间失败: {e}")

            await self._ensure_planned_outsource_drafts(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                created_by=released_by,
            )

            return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def _ensure_planned_outsource_drafts(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
    ) -> None:
        """下达时：计划委外工序若尚无有效委外单则自动建草稿。"""
        from apps.kuaizhizao.models.outsource_order import OutsourceOrder
        from apps.kuaizhizao.services.outsource_service import OutsourceService
        from apps.kuaizhizao.utils.outsource_operation import OUTSOURCE_KIND_PLANNED
        from apps.master_data.models.supplier import Supplier

        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
            outsource_kind=OUTSOURCE_KIND_PLANNED,
        ).order_by("sequence").all()
        if not ops:
            return

        existing_op_ids = set(
            await OutsourceOrder.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                work_order_operation_id__in=[op.id for op in ops],
                deleted_at__isnull=True,
            )
            .exclude(status="cancelled")
            .values_list("work_order_operation_id", flat=True)
        )

        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        outsource_svc = OutsourceService()
        pending_ops = [op for op in ops if op.id not in existing_op_ids]
        missing_supplier: List[str] = []
        ready: List[tuple] = []
        for op in pending_ops:
            supplier_id = op.default_outsource_supplier_id
            if not supplier_id:
                missing_supplier.append(op.operation_name or str(op.id))
                continue
            supplier = await Supplier.filter(
                tenant_id=tenant_id,
                id=int(supplier_id),
                deleted_at__isnull=True,
                is_active=True,
            ).first()
            if not supplier:
                missing_supplier.append(op.operation_name or str(op.id))
                continue
            qty = Decimal(str(work_order.quantity or 0)) - Decimal(str(op.completed_quantity or 0))
            if qty <= 0:
                continue
            ready.append((op, supplier, qty))
        if missing_supplier:
            raise ValidationError(
                "计划委外工序缺少有效默认供应商，无法下达："
                + "、".join(missing_supplier[:5])
                + ("等" if len(missing_supplier) > 5 else "")
            )
        for op, supplier, qty in ready:
            if not op.default_outsource_supplier_name:
                op.default_outsource_supplier_name = supplier.name
                await op.save(update_fields=["default_outsource_supplier_name", "updated_at"])
            lead = int(op.outsource_lead_time_days or 1)
            start = op.planned_start_date
            end = op.planned_end_date
            if start and not end:
                from datetime import timedelta

                end = start + timedelta(days=max(lead, 0))
            await outsource_svc.create_outsource_order_from_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                work_order_operation_id=int(op.id),
                supplier_id=int(supplier.id),
                outsource_quantity=qty,
                created_by=created_by,
                planned_start_date=start,
                planned_end_date=end,
                remarks="计划工序委外（下达自动创建）",
            )

    async def update_work_order_status(
        self,
        tenant_id: int,
        work_order_id: int,
        status: str,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单状态

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            status: 新状态
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息
        """
        work_order = await self.update_with_user(
            tenant_id=tenant_id,
            record_id=work_order_id,
            updated_by=updated_by,
            status=status
        )
        from apps.kuaizhizao.services.work_order_readiness_service import (
            dispatch_work_order_readiness_refresh,
        )

        await dispatch_work_order_readiness_refresh(tenant_id, work_order_id)
        return WorkOrderResponse.model_validate(work_order)

    async def check_delayed_work_orders(
        self,
        tenant_id: int,
        days_threshold: int = 0,
        status: Optional[str] = None
    ) -> List[dict]:
        """
        检查延期工单

        Args:
            tenant_id: 组织ID
            days_threshold: 延期天数阈值（默认0，即只要超过计划结束日期就算延期）
            status: 工单状态过滤（可选）

        Returns:
            List[dict]: 延期工单列表，每个元素包含：
            - work_order_id: 工单ID
            - work_order_code: 工单编码
            - work_order_name: 工单名称
            - planned_end_date: 计划结束日期
            - actual_end_date: 实际结束日期
            - delay_days: 延期天数
            - status: 工单状态
        """
        # 两侧必须同为站点墙钟 naive；不可把 UTC aware 的 resolve_business_datetime()
        # 直接与剥掉 tz 后的 planned_end 比较（会 TypeError → 500）。
        now = _normalize_naive_local_datetime(resolve_business_datetime())
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            planned_end_date__isnull=False,
        ).exclude(status__in=list(WORK_ORDER_DELAY_EXCLUDED_STATUSES))

        if status:
            query = query.filter(status=status)

        work_orders = await query.all()
        delayed_orders = []

        for wo in work_orders:
            if not wo.planned_end_date:
                continue
            planned_end = _normalize_naive_local_datetime(wo.planned_end_date)
            if planned_end >= now:
                continue

            if wo.actual_end_date:
                actual_end = _normalize_naive_local_datetime(wo.actual_end_date)
                delay_days = (actual_end - planned_end).days
                if delay_days <= 0:
                    continue
            else:
                delay_days = (now - planned_end).days
                if delay_days < 0:
                    continue
                if delay_days == 0:
                    delay_days = 1

            if days_threshold > 0 and delay_days <= days_threshold:
                continue

            delayed_orders.append({
                "work_order_id": wo.id,
                "work_order_code": wo.code,
                "work_order_name": wo.name,
                "product_name": wo.product_name,
                "planned_end_date": wo.planned_end_date,
                "actual_end_date": wo.actual_end_date,
                "delay_days": delay_days,
                "status": wo.status,
                "priority": wo.priority,
            })

        # 按延期天数降序排序
        delayed_orders.sort(key=lambda x: x["delay_days"], reverse=True)
        return delayed_orders

    async def analyze_delay_reasons(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None
    ) -> dict:
        """
        分析延期原因

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID（可选，如果为None则分析所有延期工单）

        Returns:
            dict: 延期原因分析结果，包含：
            - total_delayed: 延期工单总数
            - delay_reasons: 延期原因统计
            - work_orders: 延期工单详情列表
        """
        if work_order_id:
            # 分析单个工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            delayed_orders = await self.check_delayed_work_orders(
                tenant_id=tenant_id,
                status=work_order.status
            )
            # 过滤出指定工单
            delayed_orders = [wo for wo in delayed_orders if wo["work_order_id"] == work_order_id]
        else:
            # 分析所有延期工单
            delayed_orders = await self.check_delayed_work_orders(tenant_id=tenant_id)

        # 分析延期原因
        delay_reasons = {
            "material_shortage": 0,  # 缺料
            "capacity_shortage": 0,  # 产能不足
            "quality_issue": 0,  # 质量问题
            "planning_issue": 0,  # 计划问题
            "other": 0  # 其他
        }

        # TODO: 根据实际业务逻辑分析延期原因
        # 这里可以根据工单的关联数据（如缺料记录、报工记录、检验记录等）来判断延期原因
        for order in delayed_orders:
            # 简化实现：根据工单状态和延期天数推断原因
            if order["status"] == "released":
                # 已下达但未开始，可能是缺料或产能问题
                delay_reasons["material_shortage"] += 1
            elif order["status"] == "in_progress":
                # 进行中但延期，可能是产能或质量问题
                if order["delay_days"] > 7:
                    delay_reasons["capacity_shortage"] += 1
                else:
                    delay_reasons["planning_issue"] += 1
            else:
                delay_reasons["other"] += 1

        return {
            "total_delayed": len(delayed_orders),
            "delay_reasons": delay_reasons,
            "work_orders": delayed_orders
        }

    async def split_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        split_data: WorkOrderSplitRequest,
        created_by: int
    ) -> WorkOrderSplitResponse:
        """
        拆分工单

        支持按数量拆分。按工序拆分功能暂未实现。

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            split_data: 拆分数据
            created_by: 创建人ID

        Returns:
            WorkOrderSplitResponse: 拆分结果

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已报工不能拆分）
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "split", False):
                raise BusinessLogicError("当前组织未开启工单拆分能力，请在参数设置中开启“工单拆分”")

            # 获取原工单
            original_work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            is_follow_up_split = (original_work_order.status or "") == "split"
            remaining_qty: Optional[Decimal] = None

            if is_follow_up_split:
                remaining_qty = await self.compute_split_remaining_quantity(tenant_id, work_order_id)
                if remaining_qty <= 0:
                    raise BusinessLogicError(
                        "主工单无剩余数量可拆分，请删除拆分工单释放数量后再新建子工单"
                    )
            elif original_work_order.status not in ['draft', 'released']:
                raise BusinessLogicError(
                    f"只能拆分草稿、已下达或已拆分（有剩余数量）的工单，当前状态：{original_work_order.status}"
                )

            # 检查是否已报工（只能拆分未报工部分；已拆分主工单本身不可报工）
            if not is_follow_up_split:
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    status='approved',
                    deleted_at__isnull=True
                ).all()

                if reporting_records:
                    total_reported = sum(Decimal(str(r.qualified_quantity)) for r in reporting_records)
                    if total_reported > 0:
                        raise BusinessLogicError(
                            f"工单已有报工记录（已报工数量：{total_reported}），不能拆分。只能拆分未报工的工单。"
                        )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            split_work_orders = []
            next_split_idx = await self._next_split_child_sequence(
                tenant_id, work_order_id, original_work_order.code
            )
            quantity_budget = remaining_qty if is_follow_up_split else original_work_order.quantity

            if split_data.split_type == 'quantity':
                # 按数量拆分
                if split_data.split_quantities:
                    # 指定每个拆分工单的数量
                    quantities = split_data.split_quantities
                    total_split_quantity = sum(quantities)

                    if total_split_quantity > quantity_budget:
                        budget_label = "剩余数量" if is_follow_up_split else "原工单数量"
                        raise ValidationError(
                            f"拆分工单数量总和（{total_split_quantity}）不能大于{budget_label}（{quantity_budget}）"
                        )

                    if not is_follow_up_split and total_split_quantity < original_work_order.quantity:
                        raise ValidationError(
                            f"拆分工单数量总和（{total_split_quantity}）必须等于原工单数量（{original_work_order.quantity}）"
                        )

                    if is_follow_up_split and total_split_quantity <= 0:
                        raise ValidationError("拆分数量必须大于0")

                    child_status = "released" if is_follow_up_split else original_work_order.status

                    for offset, quantity in enumerate(quantities):
                        idx = next_split_idx + offset
                        if quantity <= 0:
                            raise ValidationError(f"拆分数量必须大于0，第{idx}个拆分工单数量：{quantity}")

                        split_code = f"{original_work_order.code}-{idx:03d}"

                        split_work_order = await WorkOrder.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            code=split_code,
                            name=f"{original_work_order.name}-拆分{idx}",
                            parent_work_order_id=work_order_id,
                            product_id=original_work_order.product_id,
                            product_code=original_work_order.product_code,
                            product_name=original_work_order.product_name,
                            quantity=quantity,
                            production_mode=original_work_order.production_mode,
                            sales_order_id=original_work_order.sales_order_id,
                            sales_order_code=original_work_order.sales_order_code,
                            sales_order_name=original_work_order.sales_order_name,
                            workshop_id=original_work_order.workshop_id,
                            workshop_name=original_work_order.workshop_name,
                            work_center_id=original_work_order.work_center_id,
                            work_center_name=original_work_order.work_center_name,
                            status=child_status,
                            priority=original_work_order.priority,
                            planned_start_date=original_work_order.planned_start_date,
                            planned_end_date=original_work_order.planned_end_date,
                            remarks=split_data.remarks or f"从工单{original_work_order.code}拆分",
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        split_work_orders.append(split_work_order)

                elif split_data.split_count:
                    if is_follow_up_split:
                        if split_data.split_count < 1:
                            raise ValidationError("拆分数量必须大于0")
                    elif split_data.split_count <= 1:
                        raise ValidationError("拆分数量必须大于1")

                    split_quantity = quantity_budget / Decimal(str(split_data.split_count))

                    if split_quantity * split_data.split_count != quantity_budget:
                        budget_label = "剩余数量" if is_follow_up_split else "原工单数量"
                        raise ValidationError(
                            f"{budget_label}（{quantity_budget}）不能被拆分数（{split_data.split_count}）整除"
                        )

                    for offset in range(split_data.split_count):
                        idx = next_split_idx + offset
                        split_code = f"{original_work_order.code}-{idx:03d}"

                        split_work_order = await WorkOrder.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            code=split_code,
                            name=f"{original_work_order.name}-拆分{idx}",
                            parent_work_order_id=work_order_id,
                            product_id=original_work_order.product_id,
                            product_code=original_work_order.product_code,
                            product_name=original_work_order.product_name,
                            quantity=split_quantity,
                            production_mode=original_work_order.production_mode,
                            sales_order_id=original_work_order.sales_order_id,
                            sales_order_code=original_work_order.sales_order_code,
                            sales_order_name=original_work_order.sales_order_name,
                            workshop_id=original_work_order.workshop_id,
                            workshop_name=original_work_order.workshop_name,
                            work_center_id=original_work_order.work_center_id,
                            work_center_name=original_work_order.work_center_name,
                            status='released' if is_follow_up_split else original_work_order.status,
                            priority=original_work_order.priority,
                            planned_start_date=original_work_order.planned_start_date,
                            planned_end_date=original_work_order.planned_end_date,
                            remarks=split_data.remarks or f"从工单{original_work_order.code}拆分",
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        split_work_orders.append(split_work_order)
                else:
                    raise ValidationError("按数量拆分时必须提供split_quantities或split_count")
            
            elif split_data.split_type == 'operation':
                # 按工序拆分（TODO: 需要工序模型支持，暂时返回错误）
                raise ValidationError("按工序拆分功能暂未实现，请使用按数量拆分")
            else:
                raise ValidationError(f"不支持的拆分类型：{split_data.split_type}")

            await self._provision_split_work_order_operations(
                tenant_id=tenant_id,
                parent_work_order=original_work_order,
                split_work_orders=split_work_orders,
                is_follow_up_split=is_follow_up_split,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            # 更新原工单状态为已拆分（拆分后原工单仅作追溯容器，子工单继续执行）
            original_work_order.status = 'split'
            original_work_order.updated_by = created_by
            original_work_order.updated_by_name = user_info["name"]
            await original_work_order.save()

            # 建立原工单→拆分工单的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                for split_wo in split_work_orders:
                    try:
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=original_work_order.id,
                                source_code=original_work_order.code,
                                source_name=original_work_order.name,
                                target_type="work_order",
                                target_id=split_wo.id,
                                target_code=split_wo.code,
                                target_name=split_wo.name,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单拆分",
                            ),
                            created_by=created_by,
                        )
                    except BusinessLogicError:
                        pass  # 关联已存在，忽略
            except Exception as e:
                logger.warning("建立工单拆分关联失败: %s", e)

            logger.info(f"工单 {original_work_order.code} 拆分为 {len(split_work_orders)} 个工单")

            return WorkOrderSplitResponse(
                original_work_order_id=original_work_order.id,
                original_work_order_code=original_work_order.code,
                split_work_orders=[WorkOrderResponse.model_validate(wo) for wo in split_work_orders],
                total_count=len(split_work_orders),
            )

    async def _resolve_split_operation_template_ops(
        self,
        tenant_id: int,
        parent_work_order_id: int,
        *,
        exclude_work_order_ids: Optional[Iterable[int]] = None,
    ) -> List[WorkOrderOperation]:
        """拆分子工单工序模板：优先主工单工序，否则取已有兄弟子工单工序。"""
        parent_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=parent_work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()
        if parent_ops:
            return parent_ops

        sibling_query = WorkOrder.filter(
            tenant_id=tenant_id,
            parent_work_order_id=parent_work_order_id,
            deleted_at__isnull=True,
        )
        exclude_ids = [int(i) for i in (exclude_work_order_ids or []) if i is not None]
        if exclude_ids:
            sibling_query = sibling_query.exclude(id__in=exclude_ids)
        sibling = await sibling_query.order_by("code").first()
        if sibling is None:
            return []
        return await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=sibling.id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()

    async def _copy_work_order_operations(
        self,
        tenant_id: int,
        *,
        source_ops: List[WorkOrderOperation],
        target_work_order: WorkOrder,
        created_by: int,
        created_by_name: str,
    ) -> List[WorkOrderOperation]:
        """将模板工序复制到目标工单（进度清零，供拆分子工单独立报工）。"""
        if not source_ops or target_work_order.id is None:
            return []

        existing_rows = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=target_work_order.id,
        ).all()
        existing_by_sequence = {row.sequence: row for row in existing_rows}

        created_ops: List[WorkOrderOperation] = []
        for op in source_ops:
            existing = existing_by_sequence.get(op.sequence)
            if existing is not None:
                if existing.deleted_at is not None:
                    existing.deleted_at = None
                    existing.status = "pending"
                    existing.completed_quantity = Decimal("0")
                    existing.qualified_quantity = Decimal("0")
                    existing.unqualified_quantity = Decimal("0")
                    await existing.save(
                        update_fields=[
                            "deleted_at",
                            "status",
                            "completed_quantity",
                            "qualified_quantity",
                            "unqualified_quantity",
                            "updated_at",
                        ]
                    )
                    created_ops.append(existing)
                continue

            new_op = await WorkOrderOperation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=target_work_order.id,
                work_order_code=target_work_order.code,
                operation_id=op.operation_id,
                operation_code=op.operation_code,
                operation_name=op.operation_name,
                sequence=op.sequence,
                workshop_id=op.workshop_id,
                workshop_name=op.workshop_name,
                work_center_id=op.work_center_id,
                work_center_name=op.work_center_name,
                standard_time=op.standard_time,
                setup_time=op.setup_time,
                reporting_type=op.reporting_type,
                allow_jump=op.allow_jump,
                is_node_operation=op.is_node_operation,
                over_report_mode=op.over_report_mode,
                over_report_value=op.over_report_value,
                assigned_worker_id=op.assigned_worker_id,
                assigned_worker_name=op.assigned_worker_name,
                assigned_team_id=op.assigned_team_id,
                assigned_team_name=op.assigned_team_name,
                assigned_station_id=op.assigned_station_id,
                assigned_station_name=op.assigned_station_name,
                assigned_equipment_id=op.assigned_equipment_id,
                assigned_equipment_name=op.assigned_equipment_name,
                assigned_mold_id=op.assigned_mold_id,
                assigned_mold_name=op.assigned_mold_name,
                assigned_tool_id=op.assigned_tool_id,
                assigned_tool_name=op.assigned_tool_name,
                outsource_kind=getattr(op, "outsource_kind", None) or "none",
                outsource_lead_time_days=getattr(op, "outsource_lead_time_days", None),
                default_outsource_supplier_id=getattr(op, "default_outsource_supplier_id", None),
                default_outsource_supplier_name=getattr(op, "default_outsource_supplier_name", None),
                status="pending",
                completed_quantity=Decimal("0"),
                qualified_quantity=Decimal("0"),
                unqualified_quantity=Decimal("0"),
                created_by=created_by,
                created_by_name=created_by_name,
            )
            existing_by_sequence[op.sequence] = new_op
            created_ops.append(new_op)

        if created_ops:
            await self.compute_and_apply_operation_planned_times(
                tenant_id, target_work_order, created_ops, created_by
            )
        return created_ops

    async def backfill_split_child_operations(self, tenant_id: int, split_work_order: WorkOrder) -> bool:
        """为历史拆分工单补复制工序（幂等）。"""
        if split_work_order.id is None or split_work_order.parent_work_order_id is None:
            return False

        template_ops = await self._resolve_split_operation_template_ops(
            tenant_id,
            split_work_order.parent_work_order_id,
            exclude_work_order_ids=[split_work_order.id],
        )
        if not template_ops:
            return False

        template_sequences = {op.sequence for op in template_ops}
        active_sequences = set(
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=split_work_order.id,
                deleted_at__isnull=True,
            ).values_list("sequence", flat=True)
        )
        if template_sequences.issubset(active_sequences):
            return False

        try:
            created = await self._copy_work_order_operations(
                tenant_id,
                source_ops=template_ops,
                target_work_order=split_work_order,
                created_by=split_work_order.created_by or 0,
                created_by_name=split_work_order.created_by_name or "系统",
            )
        except IntegrityError:
            logger.warning(
                "拆分工单 {} 补工序并发冲突，跳过（tenant={}）",
                split_work_order.id,
                tenant_id,
            )
            return False
        return bool(created)

    async def ensure_split_children_have_operations(
        self,
        tenant_id: int,
        split_rows: Iterable[WorkOrder],
    ) -> None:
        for row in split_rows:
            if row.id is None or row.parent_work_order_id is None:
                continue
            await self.backfill_split_child_operations(tenant_id, row)

    async def _provision_split_work_order_operations(
        self,
        tenant_id: int,
        *,
        parent_work_order: WorkOrder,
        split_work_orders: List[WorkOrder],
        is_follow_up_split: bool,
        created_by: int,
        created_by_name: str,
    ) -> None:
        """拆分时为每个子工单复制独立工序，主工单工序在首次拆分后归档（软删）。"""
        if not split_work_orders or parent_work_order.id is None:
            return

        template_ops = await self._resolve_split_operation_template_ops(
            tenant_id,
            parent_work_order.id,
            exclude_work_order_ids=[wo.id for wo in split_work_orders if wo.id is not None],
        )
        if not template_ops:
            logger.warning(
                "工单 %s 拆分未找到可复制的工序模板，子工单需后续补全",
                parent_work_order.code,
            )
            return

        for split_wo in split_work_orders:
            await self._copy_work_order_operations(
                tenant_id,
                source_ops=template_ops,
                target_work_order=split_wo,
                created_by=created_by,
                created_by_name=created_by_name,
            )

        if not is_follow_up_split:
            now = now_utc()
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=parent_work_order.id,
                deleted_at__isnull=True,
            ).update(deleted_at=now)

    async def _remove_split_document_relation(
        self,
        tenant_id: int,
        *,
        parent_id: int,
        child_id: int,
    ) -> None:
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="work_order",
            source_id=parent_id,
            target_type="work_order",
            target_id=child_id,
            relation_desc="工单拆分",
        ).delete()

    async def _assert_split_child_revocable(self, tenant_id: int, child: WorkOrder) -> None:
        if child.id is None:
            raise ValidationError("拆分工单无效")
        if child.status == "released":
            if child.actual_start_date or (
                child.completed_quantity and child.completed_quantity > 0
            ):
                raise ValidationError(
                    f"拆分工单 {child.code} 已开始执行，不能撤销拆分"
                )
        elif child.status not in ["draft", "cancelled"]:
            raise ValidationError(
                f"拆分工单 {child.code} 当前状态不可撤销（仅草稿/已取消/未执行的已下达）"
            )
        reporting_count = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=child.id,
        ).count()
        if reporting_count > 0:
            raise ValidationError(
                f"拆分工单 {child.code} 存在报工记录，不能撤销拆分"
            )

    async def _restore_split_parent_if_no_children(
        self,
        tenant_id: int,
        *,
        parent_work_order_id: int,
        template_ops: Optional[List[WorkOrderOperation]] = None,
        restored_by: int = 0,
        restore_status_hint: Optional[str] = None,
    ) -> bool:
        """若主工单已无拆分子单，恢复为可执行状态并还原工序。"""
        parent = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=parent_work_order_id,
            deleted_at__isnull=True,
        )
        if parent is None or (parent.status or "") != "split":
            return False

        remaining = await WorkOrder.filter(
            tenant_id=tenant_id,
            parent_work_order_id=parent_work_order_id,
            deleted_at__isnull=True,
        ).count()
        if remaining > 0:
            return False

        restore_status = "released"
        hint = (restore_status_hint or "").strip()
        if hint in ("draft", "草稿"):
            restore_status = "draft"
        elif hint in ("released", "已下达"):
            restore_status = "released"

        archived_ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=parent_work_order_id,
            deleted_at__isnull=False,
        ).all()
        if archived_ops:
            for op in archived_ops:
                op.deleted_at = None
                op.status = "pending"
                op.completed_quantity = Decimal("0")
                op.qualified_quantity = Decimal("0")
                op.unqualified_quantity = Decimal("0")
                await op.save(
                    update_fields=[
                        "deleted_at",
                        "status",
                        "completed_quantity",
                        "qualified_quantity",
                        "unqualified_quantity",
                        "updated_at",
                    ]
                )
        elif template_ops:
            user_info = await self.get_user_info(restored_by) if restored_by else {
                "name": "系统",
            }
            await self._copy_work_order_operations(
                tenant_id,
                source_ops=template_ops,
                target_work_order=parent,
                created_by=restored_by or 0,
                created_by_name=user_info.get("name") or "系统",
            )

        parent.status = restore_status
        parent.updated_by = restored_by or parent.updated_by
        if restored_by:
            try:
                user_info = await self.get_user_info(restored_by)
                parent.updated_by_name = user_info.get("name") or parent.updated_by_name
            except Exception:
                pass
        await parent.save(update_fields=["status", "updated_by", "updated_by_name", "updated_at"])
        logger.info(
            "工单 %s 拆分已全部撤销，恢复状态为 %s",
            parent.code,
            restore_status,
        )
        return True

    async def unsplit_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        updated_by: int,
    ) -> WorkOrderResponse:
        """
        撤销拆分：删除全部未执行的拆分子工单，并恢复主工单状态与工序。
        """
        async with in_transaction():
            parent = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            if parent.parent_work_order_id is not None:
                raise BusinessLogicError("只能对拆分主工单执行撤销拆分")
            if (parent.status or "") != "split":
                raise BusinessLogicError("仅已拆分主工单可撤销拆分")

            children = await WorkOrder.filter(
                tenant_id=tenant_id,
                parent_work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).order_by("code").all()

            template_ops: List[WorkOrderOperation] = []
            for child in children:
                await self._assert_split_child_revocable(tenant_id, child)
                if not template_ops and child.id is not None:
                    template_ops = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=child.id,
                        deleted_at__isnull=True,
                    ).order_by("sequence").all()

            now = now_utc()
            from apps.kuaizhizao.services.batching_order_service import BatchingOrderService

            batching_svc = BatchingOrderService()
            restore_status_hint = (
                "draft"
                if any((child.status or "") == "draft" for child in children)
                else "released"
            )
            for child in children:
                if child.id is None:
                    continue
                await batching_svc.void_open_batching_orders_for_work_order(
                    tenant_id, child.id
                )
                await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=child.id,
                    deleted_at__isnull=True,
                ).update(deleted_at=now)
                await WorkOrder.filter(
                    tenant_id=tenant_id,
                    id=child.id,
                ).update(deleted_at=now)
                await self._remove_split_document_relation(
                    tenant_id,
                    parent_id=work_order_id,
                    child_id=int(child.id),
                )

            restored = await self._restore_split_parent_if_no_children(
                tenant_id,
                parent_work_order_id=work_order_id,
                template_ops=template_ops,
                restored_by=updated_by,
                restore_status_hint=restore_status_hint,
            )
            if not restored:
                raise BusinessLogicError("撤销拆分失败：主工单未能恢复")

            parent = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            return WorkOrderResponse.model_validate(parent)

    async def _resolve_manufacturing_mode(self, tenant_id: int, product_id: Optional[int]) -> str:
        """product_id 为工单制造对象对应物料 id；制造模式定义在该物料 source_config，与 get_work_order_by_id 一致。"""
        if not product_id:
            return "fabrication"
        product = await Material.get_or_none(
            id=product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if product and product.source_config and isinstance(product.source_config, dict):
            return product.source_config.get("manufacturing_mode") or "fabrication"
        return "fabrication"

    async def get_work_order_operations(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        include_meta: bool = False,
    ) -> Union[List[WorkOrderOperationResponse], Dict[str, Any]]:
        """
        获取工单工序列表（含物料汇总，供工序卡片人机料法展示）

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            include_meta: 为 True 时返回 {"manufacturing_mode", "operations"}，减少列表行展开时的二次 HTTP。

        Returns:
            工序列表，或带 manufacturing_mode 的字典（include_meta=True 时）
        """
        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        plan_qty = float(work_order.quantity or 1)

        from apps.kuaizhizao.services.reporting_service import sync_work_order_operations_completion
        from apps.kuaizhizao.models.outsource_order import OutsourceOrder
        from apps.kuaizhizao.models.inspection_plan import InspectionPlan
        from apps.kuaizhizao.services.operation_transfer_service import (
            build_operation_policy_cache,
            count_pending_process_inspections,
            load_process_inspections_by_operation,
            pending_process_inspection_codes,
            resolve_operation_transfer_qualified,
            resolve_process_inspection_card_status,
            resolve_process_inspection_link_id,
            sum_process_inspection_quality_quantities,
        )

        # 展开前并行拉辅助数据；完成态 sync / IPQC 补建仍串行（有写依赖）
        pickings_task = ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status="已领料",
            deleted_at__isnull=True,
        ).all()
        scrap_task = ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=["draft", "confirmed"],
            deleted_at__isnull=True,
        ).all()
        pickings, scrap_records = await asyncio.gather(pickings_task, scrap_task)

        picked_material_count = 0
        if pickings:
            picking_ids = [p.id for p in pickings]
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id__in=picking_ids,
            ).all()
            material_ids = {
                it.material_id
                for it in items
                if it.material_id and (float(it.picked_quantity or 0) > 0)
            }
            picked_material_count = len(material_ids)

        scrap_by_op: Dict[Any, Decimal] = {}
        for sr in scrap_records:
            k = sr.operation_id
            scrap_by_op[k] = scrap_by_op.get(k, Decimal("0")) + (sr.scrap_quantity or Decimal("0"))

        await sync_work_order_operations_completion(tenant_id, work_order_id)
        # 不再在展开工序时扫描补建过程检验（严重拖慢工序卡加载）。
        # 过程检：报工生效时自动建；成品检：入库前 ensure + 工单手工下推。
        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence").all()

        if not operations and work_order.parent_work_order_id is not None:
            await self.backfill_split_child_operations(tenant_id, work_order)
            operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).order_by('sequence').all()

        master_op_ids = [op.operation_id for op in operations if op.operation_id is not None]
        op_ids = [op.operation_id for op in operations]

        (
            defect_by_master_op,
            sop_by_master_op_id,
            default_snap_by_master,
            outsource_rows,
            policy_cache,
            inspections_by_op,
        ) = await asyncio.gather(
            batch_get_operation_defect_types_via_table(master_op_ids),
            _batch_sop_for_master_operations(
                tenant_id,
                product_id=getattr(work_order, "product_id", None),
                master_operation_ids=op_ids,
            ),
            _batch_default_operators_snapshots_by_master_operation_id(tenant_id, op_ids),
            OutsourceOrder.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).exclude(status="cancelled").all(),
            build_operation_policy_cache(tenant_id, op_ids),
            load_process_inspections_by_operation(tenant_id, work_order_id),
        )
        outsource_by_op_id = {row.work_order_operation_id: row for row in outsource_rows}

        plan_ids = {
            int(plan_id)
            for (_mode, plan_id, _src) in policy_cache.values()
            if plan_id is not None
        }
        plan_label_by_id: Dict[int, str] = {}
        default_process_plan_label: Optional[str] = None
        if plan_ids:
            plans = await InspectionPlan.filter(
                tenant_id=tenant_id,
                id__in=list(plan_ids),
                deleted_at__isnull=True,
            ).all()
            for plan in plans:
                label = str(plan.plan_name or plan.plan_code or "检验方案").strip() or "检验方案"
                plan_label_by_id[int(plan.id)] = label
        if any(mode == "plan" for mode, _pid, _src in policy_cache.values()):
            missing_labels = any(
                mode == "plan" and (plan_id is None or int(plan_id) not in plan_label_by_id)
                for mode, plan_id, _src in policy_cache.values()
            )
            if missing_labels:
                fallback_plan = await InspectionPlan.filter(
                    tenant_id=tenant_id,
                    plan_type="process",
                    deleted_at__isnull=True,
                    is_active=True,
                ).order_by("-created_at").first()
                if fallback_plan:
                    default_process_plan_label = (
                        str(fallback_plan.plan_name or fallback_plan.plan_code or "检验方案").strip()
                        or "检验方案"
                    )
                else:
                    default_process_plan_label = "检验方案"

        prev_transfer = Decimal(str(plan_qty))
        result = []
        for idx, op in enumerate(operations):
            defect_types_raw = defect_by_master_op.get(op.operation_id, [])
            defect_types = [DefectTypeMinimal(uuid=dt["uuid"], code=dt["code"], name=dt["name"]) for dt in defect_types_raw]
            op_data = {f: getattr(op, f, None) for f in WorkOrderOperationResponse.model_fields if hasattr(op, f)}
            op_data["defect_types"] = defect_types
            worker_ids = _parse_assigned_worker_ids(
                op_data.get("assigned_worker_ids"),
                op_data.get("assigned_worker_id"),
            )
            op_data["assigned_worker_ids"] = worker_ids
            if worker_ids and not op_data.get("assigned_worker_id"):
                op_data["assigned_worker_id"] = worker_ids[0]

            qualified = op.qualified_quantity or Decimal("0")
            master_op_id = int(op.operation_id) if op.operation_id is not None else 0
            mode, plan_id, _ = policy_cache.get(master_op_id, ("none", None, "default_none"))
            op_inspections = inspections_by_op.get(master_op_id, [])

            transfer_qualified = await resolve_operation_transfer_qualified(
                tenant_id,
                work_order_id,
                op,
                policy_cache=policy_cache,
                inspections_by_op=inspections_by_op,
            )
            qc_pending = Decimal("0")
            if mode == "plan":
                qc_pending = max(Decimal("0"), qualified - transfer_qualified)

            op_data["inspection_mode"] = mode
            if mode == "plan":
                if plan_id is not None and int(plan_id) in plan_label_by_id:
                    op_data["inspection_plan_label"] = plan_label_by_id[int(plan_id)]
                else:
                    op_data["inspection_plan_label"] = default_process_plan_label or "检验方案"
            else:
                op_data["inspection_plan_label"] = None
            op_data["transfer_qualified_quantity"] = transfer_qualified
            op_data["qc_pending_quantity"] = qc_pending if mode == "plan" else None
            op_data["process_inspection_pending_count"] = (
                count_pending_process_inspections(op_inspections) if mode == "plan" else None
            )
            op_data["process_inspection_pending_codes"] = (
                pending_process_inspection_codes(op_inspections) if mode == "plan" else []
            )
            op_data["process_inspection_status"] = (
                await resolve_process_inspection_card_status(
                    tenant_id,
                    op_inspections,
                    reported_qualified=qualified,
                )
                if mode == "plan"
                else None
            )
            op_data["process_inspection_id"] = (
                resolve_process_inspection_link_id(op_inspections) if mode == "plan" else None
            )
            if mode == "plan":
                insp_q, insp_u = sum_process_inspection_quality_quantities(op_inspections)
                op_data["inspection_qualified_quantity"] = insp_q
                op_data["inspection_unqualified_quantity"] = insp_u
            else:
                op_data["inspection_qualified_quantity"] = None
                op_data["inspection_unqualified_quantity"] = None

            # 物料剩余：上道可转下道 - 本道已消耗。
            # 方案质检已检验后：消耗 = 完成 − 检验不合格（不合格不占上道转入，可补报；
            # 已报未检仍占用，避免补报后额度虚高）。
            completed = op.completed_quantity or Decimal("0")
            if mode == "plan":
                insp_q = Decimal(str(op_data.get("inspection_qualified_quantity") or 0))
                insp_u = Decimal(str(op_data.get("inspection_unqualified_quantity") or 0))
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
            op_data["material_remaining"] = material_remaining

            op_data["material_scrap_qty"] = scrap_by_op.get(op.operation_id)

            if idx == 0 and picked_material_count > 0:
                op_data["material_picked_count"] = picked_material_count

            next_op = operations[idx + 1] if idx + 1 < len(operations) else None
            op_data["next_op_planned_qty"] = transfer_qualified
            op_data["next_op_has_reporting"] = bool(next_op and (next_op.completed_quantity or 0) > 0) if next_op else None

            sop = sop_by_master_op_id.get(op.operation_id)
            if sop:
                op_data["sop_id"] = sop.id
                op_data["sop_uuid"] = getattr(sop, "uuid", None)
                op_data["sop_name"] = sop.name

            op_data["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, op)
            op_data["default_operators"] = default_snap_by_master.get(op.operation_id, [])

            outsource_order = outsource_by_op_id.get(op.id)
            kind = getattr(op, "outsource_kind", None) or "none"
            op_data["outsource_kind"] = kind
            op_data["outsource_lead_time_days"] = getattr(op, "outsource_lead_time_days", None)
            op_data["default_outsource_supplier_id"] = getattr(op, "default_outsource_supplier_id", None)
            op_data["default_outsource_supplier_name"] = getattr(op, "default_outsource_supplier_name", None)
            if outsource_order:
                op_data["is_outsourced"] = True
                op_data["outsource_supplier_name"] = outsource_order.supplier_name or op_data.get(
                    "default_outsource_supplier_name"
                )
                op_data["outsource_order_code"] = outsource_order.code
            else:
                op_data["is_outsourced"] = kind != "none"
                if kind != "none":
                    op_data["outsource_supplier_name"] = op_data.get("default_outsource_supplier_name")
                else:
                    op_data["outsource_supplier_name"] = None
                op_data["outsource_order_code"] = None

            prev_transfer = transfer_qualified
            result.append(WorkOrderOperationResponse.model_validate(op_data))
        if include_meta:
            mm = await self._resolve_manufacturing_mode(tenant_id, work_order.product_id)
            # sync 后回写列表行：状态 / 完工进度 / 工序步骤（避免列表仍显示已完成）
            from apps.kuaizhizao.services.work_order_operation_steps import (
                build_work_order_operation_steps,
            )

            step_raw = []
            for op, op_resp in zip(operations, result):
                transfer = getattr(op_resp, "transfer_qualified_quantity", None)
                step_raw.append(
                    {
                        "operation_name": op.operation_name,
                        "sequence": op.sequence,
                        "status": op.status,
                        "qualified_quantity": float(op.qualified_quantity or 0),
                        "transfer_qualified_quantity": (
                            float(transfer) if transfer is not None else None
                        ),
                    }
                )
            planned = float(work_order.quantity or 0)
            last_transfer = 0.0
            if result:
                t = getattr(result[-1], "transfer_qualified_quantity", None)
                last_transfer = float(t or 0)
            push_progress = 0.0
            if planned > 0:
                pct = (last_transfer / planned) * 100.0
                push_progress = max(0.0, min(100.0, round(pct, 1)))
            return {
                "manufacturing_mode": mm,
                "operations": result,
                "status": work_order.status,
                "downstream_push_progress": push_progress,
                "operation_steps": build_work_order_operation_steps(step_raw, planned),
            }
        return result

    async def refresh_work_order_operation_transfer_state(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """过程检验放行/变更后：按检验有效合格重算工序与工单完成态。"""
        from apps.kuaizhizao.services.reporting_service import sync_work_order_operations_completion

        await sync_work_order_operations_completion(tenant_id, work_order_id)

    async def update_work_order_operations(
        self,
        tenant_id: int,
        work_order_id: int,
        operations_data: WorkOrderOperationsUpdateRequest,
        updated_by: int
    ) -> list[WorkOrderOperationResponse]:
        """
        更新工单工序

        支持工序的增删改和顺序调整。已报工的工序不允许修改。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operations_data: 工序数据
            updated_by: 更新人ID

        Returns:
            list[WorkOrderOperationResponse]: 更新后的工单工序列表

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已报工工序不能修改）
        """
        async with in_transaction():
            # 获取原工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单状态（允许修改草稿、已下达或执行中的工单）
            # 执行中的工单只能修改未报工的工序
            if work_order.status not in ['draft', 'released', 'in_progress']:
                raise BusinessLogicError(f"只能修改草稿、已下达或执行中状态的工单工序，当前状态：{work_order.status}")

            # 获取现有工序
            existing_operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).all()

            # 检查已报工的工序（审核报工或已有完成数量）
            reported_operation_ids = set()
            for op in existing_operations:
                has_approved = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    status="approved",
                    deleted_at__isnull=True,
                ).filter(
                    Q(operation_id=op.operation_id) | Q(operation_id=op.id)
                ).exists()
                completed_qty = op.completed_quantity or Decimal("0")
                if has_approved or completed_qty > 0:
                    reported_operation_ids.add(op.id)

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            from apps.kuaizhizao.services.over_report_rules import (
                OVER_REPORT_NONE,
                merge_over_report_layers,
                tuple_from_model,
                normalize_over_report_mode,
                to_decimal,
            )

            material_row = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            mat_t = tuple_from_model(material_row)
            route_empty = (OVER_REPORT_NONE, Decimal("0"))
            wo_head_t = tuple_from_model(work_order)

            existing_by_id = {op.id: op for op in existing_operations}
            matched_existing_ids: set[int] = set()
            matched_rows: list[tuple[Any, Optional[WorkOrderOperation], int]] = []
            for idx, op_data in enumerate(operations_data.operations, 1):
                existing_op = _match_existing_work_order_operation(
                    op_data,
                    existing_operations,
                    matched_existing_ids,
                )
                if existing_op is not None:
                    matched_existing_ids.add(existing_op.id)
                matched_rows.append((op_data, existing_op, idx))

            for op in existing_operations:
                if op.id in reported_operation_ids and op.id not in matched_existing_ids:
                    raise BusinessLogicError(
                        f"工序 {op.operation_name} 已有报工记录，不能删除"
                    )

            # 先软删未匹配的未报工工序，避免新建/重排时 sequence 冲突
            for op_id in _work_order_operation_ids_to_remove(
                existing_operations,
                reported_operation_ids,
                matched_existing_ids,
            ):
                await _soft_delete_work_order_operation_row(
                    existing_by_id[op_id],
                    updated_by,
                    user_info["name"],
                )

            # 暂存仍保留行的 sequence，避免重排/新增时唯一约束冲突（含已报工行）
            for op in existing_operations:
                if op.deleted_at is not None:
                    continue
                op.sequence = 1_000_000 + op.id
                await op.save(update_fields=["sequence"])

            updated_operation_ids: set[int] = set()

            # 处理工序更新和新增（顺序以列表下标为准）
            for op_data, existing_op, target_sequence in matched_rows:
                if existing_op:
                    # 已报工：仅允许随清单重排序号，不允许改工序内容
                    if existing_op.id in reported_operation_ids:
                        if _reported_work_order_operation_content_changed(existing_op, op_data):
                            raise BusinessLogicError(
                                f"工序 {existing_op.operation_name} 已有报工记录，不能修改"
                            )
                        existing_op.sequence = target_sequence
                        existing_op.updated_by = updated_by
                        existing_op.updated_by_name = user_info["name"]
                        await existing_op.save(
                            update_fields=[
                                "sequence",
                                "updated_by",
                                "updated_by_name",
                                "updated_at",
                            ]
                        )
                        updated_operation_ids.add(existing_op.id)
                        continue

                    op_id_changed = existing_op.operation_id != op_data.operation_id
                    # 更新工序信息
                    existing_op.operation_id = op_data.operation_id
                    existing_op.operation_code = op_data.operation_code
                    existing_op.operation_name = op_data.operation_name
                    existing_op.sequence = target_sequence
                    existing_op.workshop_id = op_data.workshop_id
                    existing_op.workshop_name = op_data.workshop_name
                    existing_op.work_center_id = op_data.work_center_id
                    existing_op.work_center_name = op_data.work_center_name
                    existing_op.planned_start_date = op_data.planned_start_date
                    existing_op.planned_end_date = op_data.planned_end_date
                    existing_op.standard_time = op_data.standard_time
                    existing_op.setup_time = op_data.setup_time
                    existing_op.remarks = op_data.remarks
                    master_op = None
                    if op_id_changed:
                        master_op = await Operation.get_or_none(
                            tenant_id=tenant_id,
                            id=op_data.operation_id,
                            deleted_at__isnull=True,
                        )
                    if getattr(op_data, "reporting_type", None) is not None:
                        existing_op.reporting_type = op_data.reporting_type or "quantity"
                    elif op_id_changed and master_op:
                        existing_op.reporting_type = master_op.reporting_type or "quantity"
                    existing_op.allow_jump = False
                    if getattr(op_data, "is_node_operation", None) is not None:
                        existing_op.is_node_operation = bool(op_data.is_node_operation)
                    elif op_id_changed:
                        existing_op.is_node_operation = False
                    fs_or = getattr(op_data, "model_fields_set", set()) or set()
                    if fs_or & {"over_report_mode", "over_report_value"}:
                        existing_op.over_report_mode = normalize_over_report_mode(
                            getattr(op_data, "over_report_mode", None)
                        )
                        existing_op.over_report_value = to_decimal(getattr(op_data, "over_report_value", None))
                    elif op_id_changed and master_op:
                        orm, orv = merge_over_report_layers(
                            mat_t,
                            tuple_from_model(master_op),
                            route_empty,
                            route_empty,
                            False,
                            wo_head_t,
                            (OVER_REPORT_NONE, Decimal("0")),
                            False,
                        )
                        existing_op.over_report_mode = orm
                        existing_op.over_report_value = orv
                    existing_op.updated_by = updated_by
                    existing_op.updated_by_name = user_info["name"]
                    await existing_op.save()
                    updated_operation_ids.add(existing_op.id)
                else:
                    # 创建新工序（报工类型、跳转、节点自工序档案继承）
                    master_op = await Operation.get_or_none(
                        tenant_id=tenant_id,
                        id=op_data.operation_id,
                        deleted_at__isnull=True,
                    )
                    reporting_type = op_data.reporting_type if getattr(op_data, "reporting_type", None) is not None else None
                    if reporting_type is None:
                        reporting_type = (master_op.reporting_type or "quantity") if master_op else "quantity"
                    allow_jump_new = False
                    is_node_new = (
                        bool(op_data.is_node_operation)
                        if getattr(op_data, "is_node_operation", None) is not None
                        else False
                    )
                    fs_new = getattr(op_data, "model_fields_set", set()) or set()
                    line_explicit = bool(fs_new & {"over_report_mode", "over_report_value"})
                    if line_explicit:
                        line_t = (
                            normalize_over_report_mode(getattr(op_data, "over_report_mode", None)),
                            to_decimal(getattr(op_data, "over_report_value", None)),
                        )
                    else:
                        line_t = (OVER_REPORT_NONE, Decimal("0"))
                    orm, orv = merge_over_report_layers(
                        mat_t,
                        tuple_from_model(master_op),
                        route_empty,
                        route_empty,
                        False,
                        wo_head_t,
                        line_t,
                        line_explicit,
                    )
                    new_op = await WorkOrderOperation.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        work_order_id=work_order_id,
                        work_order_code=work_order.code,
                        operation_id=op_data.operation_id,
                        operation_code=op_data.operation_code,
                        operation_name=op_data.operation_name,
                        sequence=target_sequence,
                        workshop_id=op_data.workshop_id,
                        workshop_name=op_data.workshop_name,
                        work_center_id=op_data.work_center_id,
                        work_center_name=op_data.work_center_name,
                        planned_start_date=op_data.planned_start_date,
                        planned_end_date=op_data.planned_end_date,
                        standard_time=op_data.standard_time,
                        setup_time=op_data.setup_time,
                        reporting_type=reporting_type,
                        allow_jump=allow_jump_new,
                        is_node_operation=is_node_new,
                        over_report_mode=orm,
                        over_report_value=orv,
                        status='pending',
                        remarks=op_data.remarks,
                        created_by=updated_by,
                        created_by_name=user_info["name"],
                    )
                    updated_operation_ids.add(new_op.id)

            # 工序清单变更不回写工单头计划时间：头表计划开始/结束由工单更新或排程写入。
            # 若此处用工序计划结束覆盖头表，编辑工单计划时间后会被旧工序时间冲掉。

            logger.info(f"工单 {work_order.code} 的工序已更新")

            # 返回更新后的工序列表
            return await self.get_work_order_operations(tenant_id, work_order_id)

    async def dispatch_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        dispatch_data: WorkOrderOperationDispatch,
        dispatched_by: int
    ) -> WorkOrderOperationResponse:
        """
        派工工单工序

        分配工序给具体的人员或设备。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operation_id: 工单工序ID
            dispatch_data: 派工数据
            dispatched_by: 派工人ID

        Returns:
            WorkOrderOperationResponse: 更新后的工单工序
        """
        async with in_transaction():
            # 获取工单工序
            work_order_operation = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                id=operation_id,
                deleted_at__isnull=True
            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}")

            # 获取派工人信息
            user_info = await self.get_user_info(dispatched_by)

            # 更新派工信息（车间/工作中心仅当请求体显式包含对应字段时更新，兼容旧客户端）
            dispatch_patch = dispatch_data.model_dump(exclude_unset=True)
            if "workshop_id" in dispatch_patch or "workshop_name" in dispatch_patch:
                work_order_operation.workshop_id = dispatch_data.workshop_id
                work_order_operation.workshop_name = dispatch_data.workshop_name
            if "work_center_id" in dispatch_patch or "work_center_name" in dispatch_patch:
                work_order_operation.work_center_id = dispatch_data.work_center_id
                work_order_operation.work_center_name = dispatch_data.work_center_name
            if (
                "assigned_worker_ids" in dispatch_patch
                or "assigned_worker_id" in dispatch_patch
                or "assigned_worker_name" in dispatch_patch
            ):
                if "assigned_worker_ids" in dispatch_patch:
                    worker_ids = _parse_assigned_worker_ids(dispatch_data.assigned_worker_ids)
                elif dispatch_data.assigned_worker_id is not None:
                    worker_ids = _parse_assigned_worker_ids(None, dispatch_data.assigned_worker_id)
                else:
                    worker_ids = []
                (
                    resolved_ids,
                    primary_id,
                    joined_name,
                ) = await _resolve_assigned_worker_fields(tenant_id, worker_ids)
                work_order_operation.assigned_worker_ids = resolved_ids
                work_order_operation.assigned_worker_id = primary_id
                work_order_operation.assigned_worker_name = joined_name
            work_order_operation.assigned_team_id = dispatch_data.assigned_team_id
            work_order_operation.assigned_team_name = dispatch_data.assigned_team_name
            work_order_operation.assigned_station_id = dispatch_data.assigned_station_id
            work_order_operation.assigned_station_name = dispatch_data.assigned_station_name
            work_order_operation.assigned_equipment_id = dispatch_data.assigned_equipment_id
            work_order_operation.assigned_equipment_name = dispatch_data.assigned_equipment_name
            work_order_operation.assigned_mold_id = dispatch_data.assigned_mold_id
            work_order_operation.assigned_mold_name = dispatch_data.assigned_mold_name
            work_order_operation.assigned_tool_id = dispatch_data.assigned_tool_id
            work_order_operation.assigned_tool_name = dispatch_data.assigned_tool_name
            if work_order_operation.assigned_team_id:
                from apps.master_data.models.factory import WorkGroup

                team = await WorkGroup.get_or_none(
                    tenant_id=tenant_id,
                    id=int(work_order_operation.assigned_team_id),
                    deleted_at__isnull=True,
                )
                if team and (team.name or "").strip():
                    work_order_operation.assigned_team_name = team.name
            else:
                work_order_operation.assigned_team_name = None
            work_order_operation.assigned_at = resolve_business_datetime()
            work_order_operation.assigned_by = dispatched_by
            work_order_operation.assigned_by_name = user_info["name"]
            
            if dispatch_data.remarks:
                work_order_operation.remarks = dispatch_data.remarks

            await work_order_operation.save()

            logger.info(f"工单 {work_order_operation.work_order_code} 的工序 {work_order_operation.operation_name} 已派工")

            wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=work_order_operation.work_order_id,
                deleted_at__isnull=True,
            )
            if not wo:
                raise NotFoundError("工单不存在")
            op_payload = {
                f: getattr(work_order_operation, f, None)
                for f in WorkOrderOperationResponse.model_fields
                if hasattr(work_order_operation, f)
            }
            worker_ids = _parse_assigned_worker_ids(
                op_payload.get("assigned_worker_ids"),
                op_payload.get("assigned_worker_id"),
            )
            op_payload["assigned_worker_ids"] = worker_ids
            if worker_ids and not op_payload.get("assigned_worker_id"):
                op_payload["assigned_worker_id"] = worker_ids[0]
            op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(wo, work_order_operation)
            dmap = await _batch_default_operators_snapshots_by_master_operation_id(
                tenant_id, [work_order_operation.operation_id]
            )
            op_payload["default_operators"] = dmap.get(work_order_operation.operation_id, [])
            return WorkOrderOperationResponse.model_validate(op_payload)

    async def start_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        started_by: int
    ) -> WorkOrderOperationResponse:
        """
        开始工单工序

        将工序状态从 pending 更新为 in_progress，并记录实际开始时间。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operation_id: 工单工序ID（不是工序模板的ID）
            started_by: 开始人ID

        Returns:
            WorkOrderOperationResponse: 更新后的工单工序

        Raises:
            NotFoundError: 工单或工序不存在
            BusinessLogicError: 业务逻辑错误（如工序状态不正确）
        """
        async with in_transaction():
            # 获取工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 冻结态禁止开工
            if getattr(work_order, "is_frozen", False):
                raise BusinessLogicError(f"工单已冻结，不能开工。冻结原因：{getattr(work_order, 'freeze_reason', None) or '无'}")

            await self.assert_confirmed_picking_before_operation_start_if_required(
                tenant_id, work_order_id, action_label="开工"
            )

            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if _material_shortage_block_applies(block_level, "operation_start"):
                shortage_result = await self.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items") or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        "工单存在缺料，无法开工。缺料物料："
                        + shortage_materials
                        + (
                            f"等{total_shortage_count}种物料"
                            if total_shortage_count > 3
                            else ""
                        )
                        + f"。当前受参数 parameters.work_order.material_shortage_block_level={block_level} 控制"
                    )

            # 检查工单状态
            if (work_order.status or "") == "split":
                raise BusinessLogicError("已拆分主工单不可开工，请将剩余数量拆分为子工单后由子工单执行")

            if work_order.status not in ['released', 'in_progress']:
                raise BusinessLogicError("需要先下达工单才能开工")

            # 获取工单工序
            work_order_operation = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                id=operation_id,
                deleted_at__isnull=True
            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}")

            # 检查工序状态
            if work_order_operation.status != 'pending':
                op_status_labels = {
                    'pending': '待开工',
                    'in_progress': '进行中',
                    'processing': '进行中',
                    'paused': '已暂停',
                    'completed': '已完成',
                }
                status = work_order_operation.status or ''
                if status in ('in_progress', 'processing'):
                    raise BusinessLogicError('当前工序已在进行中，无需再次开工')
                if status == 'paused':
                    raise BusinessLogicError('当前工序已暂停，请先恢复后再继续')
                if status == 'completed':
                    raise BusinessLogicError('当前工序已完成，无法再次开工')
                label = op_status_labels.get(status, status)
                raise BusinessLogicError(f'只能开工「待开工」状态的工序，当前为「{label}」')

            # 检查跳转规则：工单或工序任一方允许跳转则放宽；节点工序在允许跳转时仍不可跳过
            from apps.kuaizhizao.services.operation_jump_rules import (
                effective_allow_jump,
                validate_start_respects_node_operations,
            )

            allow_jump = effective_allow_jump(work_order, work_order_operation)

            if not allow_jump:
                # 只检查上一道工序：上道须有可转下道数量（方案质检须检验放行）
                previous_operations = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    sequence__lt=work_order_operation.sequence,
                    deleted_at__isnull=True
                ).order_by('-sequence').limit(1).all()

                if previous_operations:
                    from apps.kuaizhizao.services.operation_jump_rules import qualified_transfer_quantity_async

                    prev_op = previous_operations[0]
                    prev_transfer = await qualified_transfer_quantity_async(
                        tenant_id, work_order_id, prev_op
                    )
                    if prev_transfer <= 0:
                        raise BusinessLogicError(
                            f"前序工序「{prev_op.operation_name}」尚无可转下道合格数量，不能开始当前工序"
                        )
            else:
                await validate_start_respects_node_operations(
                    tenant_id, work_order_id, work_order_operation
                )

            # 获取开始人信息
            user_info = await self.get_user_info(started_by)

            # 更新工序状态
            work_order_operation.status = 'in_progress'
            work_order_operation.actual_start_date = resolve_business_datetime()
            work_order_operation.updated_by = started_by
            work_order_operation.updated_by_name = user_info["name"]
            await work_order_operation.save()

            # 如果工单状态是 released，更新为 in_progress
            if work_order.status == 'released':
                work_order.status = 'in_progress'
                work_order.actual_start_date = work_order.actual_start_date or resolve_business_datetime()
                work_order.updated_by = started_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()

            op_payload = {
                f: getattr(work_order_operation, f, None)
                for f in WorkOrderOperationResponse.model_fields
                if hasattr(work_order_operation, f)
            }
            worker_ids = _parse_assigned_worker_ids(
                op_payload.get("assigned_worker_ids"),
                op_payload.get("assigned_worker_id"),
            )
            op_payload["assigned_worker_ids"] = worker_ids
            if worker_ids and not op_payload.get("assigned_worker_id"):
                op_payload["assigned_worker_id"] = worker_ids[0]
            op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, work_order_operation)
            dmap = await _batch_default_operators_snapshots_by_master_operation_id(
                tenant_id, [work_order_operation.operation_id]
            )
            op_payload["default_operators"] = dmap.get(work_order_operation.operation_id, [])
            return WorkOrderOperationResponse.model_validate(op_payload)

    async def freeze_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        freeze_data: WorkOrderFreezeRequest,
        frozen_by: int
    ) -> WorkOrderResponse:
        """
        冻结工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            freeze_data: 冻结数据（包含冻结原因）
            frozen_by: 冻结人ID

        Returns:
            WorkOrderResponse: 冻结后的工单信息

        Raises:
            NotFoundError: 工单不存在
            BusinessLogicError: 工单已冻结或状态不允许冻结
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            assert_work_order_capability(work_order, "freeze")

            # 检查工单是否已冻结
            if work_order.is_frozen:
                raise BusinessLogicError("工单已冻结，不能重复冻结")

            # 获取冻结人信息
            user_info = await self.get_user_info(frozen_by)

            # 更新冻结信息
            work_order.is_frozen = True
            work_order.freeze_reason = freeze_data.freeze_reason
            work_order.frozen_at = resolve_business_datetime()
            work_order.frozen_by = frozen_by
            work_order.frozen_by_name = user_info["name"]
            work_order.updated_by = frozen_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 已冻结，原因：{freeze_data.freeze_reason}")

            return WorkOrderResponse.model_validate(work_order)

    async def unfreeze_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        unfreeze_data: WorkOrderUnfreezeRequest,
        unfrozen_by: int
    ) -> WorkOrderResponse:
        """
        解冻工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            unfreeze_data: 解冻数据（可选解冻原因）
            unfrozen_by: 解冻人ID

        Returns:
            WorkOrderResponse: 解冻后的工单信息

        Raises:
            NotFoundError: 工单不存在
            BusinessLogicError: 工单未冻结
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            assert_work_order_capability(work_order, "unfreeze")

            # 检查工单是否已冻结
            if not work_order.is_frozen:
                raise BusinessLogicError("工单未冻结，不能解冻")

            # 获取解冻人信息
            user_info = await self.get_user_info(unfrozen_by)

            # 清除冻结信息（保留冻结历史记录，可通过freeze_reason等字段查看）
            work_order.is_frozen = False
            # 保留freeze_reason、frozen_at、frozen_by等字段作为历史记录
            work_order.updated_by = unfrozen_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 已解冻")

            return WorkOrderResponse.model_validate(work_order)

    async def set_work_order_priority(
        self,
        tenant_id: int,
        work_order_id: int,
        priority_data: WorkOrderPriorityRequest,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        设置工单优先级

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            priority_data: 优先级数据
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 优先级值无效
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "priority", False):
                raise BusinessLogicError("当前组织未开启工单优先级能力，请在参数设置中开启“工单优先级”")

            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            assert_work_order_capability(work_order, "set_priority")

            # 验证优先级值
            valid_priorities = ['low', 'normal', 'high', 'urgent']
            if priority_data.priority not in valid_priorities:
                raise ValidationError(f"优先级值无效，必须是以下之一：{', '.join(valid_priorities)}")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新优先级
            work_order.priority = priority_data.priority
            work_order.updated_by = updated_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 优先级已设置为 {priority_data.priority}")

            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            await dispatch_work_order_score_recalc(work_order_id, include_kitting=False)

            return WorkOrderResponse.model_validate(work_order)

    async def batch_set_work_order_priority(
        self,
        tenant_id: int,
        batch_data: WorkOrderBatchPriorityRequest,
        updated_by: int
    ) -> List[WorkOrderResponse]:
        """
        批量设置工单优先级

        Args:
            tenant_id: 组织ID
            batch_data: 批量优先级数据
            updated_by: 更新人ID

        Returns:
            List[WorkOrderResponse]: 更新后的工单信息列表

        Raises:
            ValidationError: 优先级值无效或工单ID列表为空
            NotFoundError: 部分工单不存在
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "priority", False):
                raise BusinessLogicError("当前组织未开启工单优先级能力，请在参数设置中开启“工单优先级”")

            # 验证优先级值
            valid_priorities = ['low', 'normal', 'high', 'urgent']
            if batch_data.priority not in valid_priorities:
                raise ValidationError(f"优先级值无效，必须是以下之一：{', '.join(valid_priorities)}")

            if not batch_data.work_order_ids:
                raise ValidationError("工单ID列表不能为空")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 批量更新工单优先级
            updated_work_orders = []
            for work_order_id in batch_data.work_order_ids:
                work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
                work_order.priority = batch_data.priority
                work_order.updated_by = updated_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()
                updated_work_orders.append(WorkOrderResponse.model_validate(work_order))

            logger.info(f"批量设置 {len(updated_work_orders)} 个工单的优先级为 {batch_data.priority}")

            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            for work_order_id in batch_data.work_order_ids:
                await dispatch_work_order_score_recalc(work_order_id, include_kitting=False)

            return updated_work_orders

    @staticmethod
    def _work_order_progress_percent(planned: Decimal, effective_completed: Decimal) -> float:
        qty = float(planned or 0)
        if qty <= 0:
            return 0.0
        return round(float(effective_completed or 0) / qty * 100, 2)

    @staticmethod
    async def _resolve_work_order_effective_completed_quantity(
        tenant_id: int,
        wo: WorkOrder,
    ) -> Decimal:
        """
        工单作为半成品供给时的有效完工量：末道工序可转下道/可入库合格。
        方案质检未放行前为 0，不得按报工完成数计入上游齐套。
        """
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=int(wo.id),
            deleted_at__isnull=True,
        ).all()
        if not operations:
            return Decimal("0")
        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        from apps.kuaizhizao.services.operation_transfer_service import (
            resolve_operation_transfer_qualified,
        )

        return await resolve_operation_transfer_qualified(
            tenant_id, int(wo.id), last_op
        )

    async def _build_kitting_related_work_order_summary(
        self,
        tenant_id: int,
        wo: WorkOrder,
        *,
        effective_completed: Optional[Decimal] = None,
    ) -> KittingRelatedWorkOrderSummary:
        planned = Decimal(str(wo.quantity or 0))
        completed = (
            effective_completed
            if effective_completed is not None
            else await self._resolve_work_order_effective_completed_quantity(tenant_id, wo)
        )
        return KittingRelatedWorkOrderSummary(
            work_order_id=int(wo.id),
            work_order_code=wo.code or str(wo.id),
            status=str(wo.status or ""),
            quantity=planned,
            completed_quantity=completed,
            progress_percent=self._work_order_progress_percent(planned, completed),
            planned_end_date=wo.planned_end_date,
        )

    @staticmethod
    def _outsource_work_order_progress_percent(owo: OutsourceWorkOrder) -> float:
        qty = float(owo.quantity or 0)
        if qty <= 0:
            return 0.0
        return round(float(owo.received_quantity or 0) / qty * 100, 2)

    @staticmethod
    def _build_kitting_related_outsource_work_order_summary(
        owo: OutsourceWorkOrder,
    ) -> KittingRelatedOutsourceWorkOrderSummary:
        return KittingRelatedOutsourceWorkOrderSummary(
            outsource_work_order_id=int(owo.id),
            outsource_work_order_code=owo.code or str(owo.id),
            status=str(owo.status or ""),
            quantity=Decimal(str(owo.quantity or 0)),
            received_quantity=Decimal(str(owo.received_quantity or 0)),
            progress_percent=WorkOrderService._outsource_work_order_progress_percent(owo),
            supplier_name=owo.supplier_name,
            planned_end_date=owo.planned_end_date,
        )

    _KITTING_PO_TERMINAL_STATUSES = frozenset(
        {
            DocumentStatus.CANCELLED.value,
            DocumentStatus.CLOSED.value,
            DocumentStatus.COMPLETED.value,
            DocumentStatus.REJECTED.value,
            "已取消",
            "已关闭",
            "已完成",
            "已驳回",
            "cancelled",
            "closed",
            "completed",
            "rejected",
        }
    )
    _KITTING_PR_TERMINAL_STATUSES = frozenset(
        {
            DocumentStatus.CANCELLED.value,
            DocumentStatus.REJECTED.value,
            DocumentStatus.FULL_CONVERTED.value,
            "已取消",
            "已驳回",
            "全部转单",
            "cancelled",
            "rejected",
            "FULL_CONVERTED",
        }
    )

    @classmethod
    async def _load_material_open_purchase_map(
        cls,
        tenant_id: int,
        material_ids: List[int],
    ) -> Dict[int, Dict[str, Any]]:
        """
        按物料聚合未结采购订单 / 未转单采购申请（供齐套面板展示供给进度）。
        返回 material_id -> {po?: {...}, pr?: {...}}
        """
        from apps.kuaizhizao.models.purchase_order import (
            PurchaseOrderItem,
            effective_po_item_outstanding,
        )
        from apps.kuaizhizao.models.purchase_requisition import (
            PurchaseRequisition,
            PurchaseRequisitionItem,
        )
        from apps.kuaizhizao.constants import normalize_status

        result: Dict[int, Dict[str, Any]] = {int(mid): {} for mid in material_ids if mid}
        if not result:
            return result

        ids = list(result.keys())

        po_items = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id__in=ids,
            deleted_at__isnull=True,
        ).prefetch_related("order")

        for item in po_items:
            order = getattr(item, "order", None)
            if order is None or getattr(order, "deleted_at", None) is not None:
                continue
            st = str(order.status or "").strip()
            if st in cls._KITTING_PO_TERMINAL_STATUSES or normalize_status(st) in {
                DocumentStatus.CANCELLED.value,
                DocumentStatus.CLOSED.value,
                DocumentStatus.COMPLETED.value,
                DocumentStatus.REJECTED.value,
            }:
                continue
            outstanding = effective_po_item_outstanding(item)
            if outstanding <= 0:
                continue
            mid = int(item.material_id)
            ordered = Decimal(str(item.ordered_quantity or 0))
            received = Decimal(str(item.received_quantity or 0))
            bucket = result.setdefault(mid, {})
            prev = bucket.get("po")
            # 优先展示未到货量更大的行；同等则取较新订单
            if prev and Decimal(str(prev["outstanding_quantity"])) >= outstanding:
                continue
            item_due = getattr(item, "required_date", None)
            order_due = getattr(order, "delivery_date", None)
            bucket["po"] = {
                "document_id": int(order.id),
                "document_code": str(order.order_code or order.id),
                "ordered_quantity": ordered,
                "received_quantity": received,
                "outstanding_quantity": outstanding,
                "expected_date": item_due or order_due,
            }

        pr_items = await PurchaseRequisitionItem.filter(
            tenant_id=tenant_id,
            material_id__in=ids,
            purchase_order_id__isnull=True,
        ).all()
        if pr_items:
            req_ids = {int(i.requisition_id) for i in pr_items if i.requisition_id}
            reqs = await PurchaseRequisition.filter(
                tenant_id=tenant_id,
                id__in=list(req_ids),
                deleted_at__isnull=True,
            ).all()
            req_map = {int(r.id): r for r in reqs}
            for item in pr_items:
                req = req_map.get(int(item.requisition_id))
                if not req:
                    continue
                st = str(req.status or "").strip()
                if st in cls._KITTING_PR_TERMINAL_STATUSES or normalize_status(st) in {
                    DocumentStatus.CANCELLED.value,
                    DocumentStatus.REJECTED.value,
                    DocumentStatus.FULL_CONVERTED.value,
                }:
                    continue
                qty = Decimal(str(item.quantity or 0))
                if qty <= 0:
                    continue
                mid = int(item.material_id)
                bucket = result.setdefault(mid, {})
                prev = bucket.get("pr")
                if prev and Decimal(str(prev["outstanding_quantity"])) >= qty:
                    continue
                item_due = getattr(item, "required_date", None)
                req_due = getattr(req, "required_date", None)
                bucket["pr"] = {
                    "document_id": int(req.id),
                    "document_code": str(req.requisition_code or req.id),
                    "ordered_quantity": qty,
                    "received_quantity": Decimal("0"),
                    "outstanding_quantity": qty,
                    "expected_date": item_due or req_due,
                }

        return result

    @classmethod
    def _coerce_kitting_expected_datetime(cls, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        if isinstance(value, datetime):
            return value
        if hasattr(value, "year") and hasattr(value, "month") and hasattr(value, "day"):
            # date → datetime（本地日历日，无时区）
            return datetime(value.year, value.month, value.day)
        return None

    @classmethod
    def _resolve_kitting_supply_progress(
        cls,
        *,
        source_type: Optional[str],
        required_qty: Decimal,
        total_available: Decimal,
        has_related_production: bool,
        open_purchase: Optional[Dict[str, Any]],
    ) -> Optional[KittingSupplyProgress]:
        """自制/委外有关联工单时不填；其余按库存 → 采购订单 → 采购申请 → 待请购。"""
        if has_related_production:
            return None

        if total_available >= required_qty and required_qty > 0:
            return KittingSupplyProgress(status="stock_covered")

        open_purchase = open_purchase or {}
        po = open_purchase.get("po")
        if po:
            ordered = Decimal(str(po["ordered_quantity"]))
            received = Decimal(str(po["received_quantity"]))
            outstanding = Decimal(str(po["outstanding_quantity"]))
            pct = 0.0
            if ordered > 0:
                pct = round(float(received / ordered) * 100, 2)
            status = "receiving" if received > 0 else "purchasing"
            return KittingSupplyProgress(
                status=status,
                ordered_quantity=ordered,
                received_quantity=received,
                outstanding_quantity=outstanding,
                progress_percent=pct,
                document_type="purchase_order",
                document_id=int(po["document_id"]),
                document_code=str(po["document_code"]),
                expected_date=cls._coerce_kitting_expected_datetime(po.get("expected_date")),
            )

        pr = open_purchase.get("pr")
        if pr:
            qty = Decimal(str(pr["ordered_quantity"]))
            return KittingSupplyProgress(
                status="purchase_requisition",
                ordered_quantity=qty,
                received_quantity=Decimal("0"),
                outstanding_quantity=Decimal(str(pr["outstanding_quantity"])),
                progress_percent=0.0,
                document_type="purchase_requisition",
                document_id=int(pr["document_id"]),
                document_code=str(pr["document_code"]),
                expected_date=cls._coerce_kitting_expected_datetime(pr.get("expected_date")),
            )

        if source_type == SOURCE_TYPE_BUY and required_qty > total_available:
            return KittingSupplyProgress(status="awaiting_purchase")

        return None

    async def remind_warehouse_batching(
        self,
        tenant_id: int,
        work_order_id: int,
        recipient_user_uuids: list[str],
        remarks: Optional[str],
        created_by: int,
    ) -> dict:
        """
        提醒仓库线边备料：生成/同步线边备料草稿，并向指定用户发送站内信。
        生产侧不跳转仓储作业页；仓库在物料中心处理备料单。
        """
        from apps.kuaizhizao.schemas.batching_order import PullFromWorkOrderRequest
        from apps.kuaizhizao.services.batching_order_service import BatchingOrderService
        from core.schemas.message_template import SendMessageRequest
        from core.services.messaging.message_service import MessageService
        from infra.models.user import User

        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
        )
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        uuids = [str(u).strip() for u in (recipient_user_uuids or []) if str(u).strip()]
        if not uuids:
            raise ValidationError("请至少选择一位仓库提醒对象")

        users = await User.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        if not users:
            raise NotFoundError("提醒对象不存在或已停用")

        batching_svc = BatchingOrderService()
        order = await batching_svc.pull_from_work_order(
            tenant_id=tenant_id,
            request_data=PullFromWorkOrderRequest(
                work_order_id=work_order_id,
                allow_existing_draft=True,
                remarks=remarks or "工单齐套面板：提醒仓库线边备料",
            ),
            created_by=created_by,
        )

        creator = await User.get_or_none(id=created_by, deleted_at__isnull=True)
        creator_name = (
            (getattr(creator, "full_name", None) or getattr(creator, "username", None) or "")
            if creator
            else ""
        )
        subject = f"线边备料提醒：{wo.code}"
        content_parts = [
            f"工单 {wo.code} 需要线边备料（主仓→线边，非正式发料）。",
            f"产品：{wo.product_name or wo.product_code or '—'}",
            f"线边备料单：{order.code}",
        ]
        if creator_name:
            content_parts.append(f"发起人：{creator_name}")
        if remarks and str(remarks).strip():
            content_parts.append(f"备注：{str(remarks).strip()}")
        content_parts.append("请到「仓储管理 → 物料中心 → 线边备料执行」处理。")
        content = "\n".join(content_parts)

        variables = {
            "message_category": "process",
            "trigger_document": "work_order",
            "trigger_action": "remind_batching",
            "detail_path": "/apps/kuaizhizao/warehouse-management/batching-center",
            "work_order_id": str(wo.id),
            "batching_order_id": str(order.id),
            "work_order_code": wo.code or str(wo.id),
            "product_name": wo.product_name or wo.product_code or "—",
            "batching_order_code": order.code or "",
            "remarks": (remarks or "").strip() or "—",
        }

        notified = 0
        seen_ids: set[int] = set()
        for user in users:
            if user.id in seen_ids:
                continue
            seen_ids.add(user.id)
            try:
                await MessageService.send_message(
                    tenant_id=tenant_id,
                    request=SendMessageRequest(
                        type="internal",
                        recipient=str(user.id),
                        subject=subject,
                        content=content,
                        variables=variables,
                    ),
                )
                notified += 1
            except Exception as exc:
                logger.warning(
                    "线边备料提醒站内信失败 tenant={} user={}: {}",
                    tenant_id,
                    user.id,
                    exc,
                )

        # 配置中心规则中的默认仓库人员（与弹窗选人合并去重）
        from apps.kuaizhizao.services.kuaizhizao_business_notification import (
            ACTION_REMIND_BATCHING,
            DOC_WORK_ORDER,
            dispatch_kuaizhizao_notification,
        )

        rule_sent = await dispatch_kuaizhizao_notification(
            tenant_id,
            trigger_document=DOC_WORK_ORDER,
            trigger_action=ACTION_REMIND_BATCHING,
            variables=variables,
            context={"creator_user_id": created_by},
        )
        notified += rule_sent

        if notified <= 0:
            raise BusinessLogicError("备料任务已生成，但站内信发送失败，请稍后重试或联系管理员")

        return {
            "success": True,
            "message": f"已提醒 {notified} 人，并生成线边备料任务 {order.code}",
            "notified_count": notified,
            "batching_order_id": order.id,
            "batching_order_code": order.code,
        }

    async def get_work_order_kitting_analysis(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> WorkOrderKittingAnalysisResponse:
        """
        获取工单齐套性分析

        逻辑：
        1. 展开 BOM 需求
        2. 统计已领料数量
        3. 获取实时库位库存（主仓 + 线边仓）
        4. 计算齐套状态
        """
        from tortoise.functions import Sum

        # 1. 获取工单
        wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        # 2. 从 BOM 计算物料需求
        try:
            requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=wo.product_id,
                required_quantity=float(wo.quantity),
                only_approved=True,
                variant_attributes=wo.variant_attributes,
                configurable_selections=wo.configurable_selections,
                for_kitting_analysis=True,
            )
        except Exception as e:
            logger.warning(f"BOM 展开失败: {e}")
            requirements = []

        if not requirements:
            return WorkOrderKittingAnalysisResponse(
                work_order_id=work_order_id,
                work_order_code=wo.code,
                kitting_rate=Decimal("0"),
                status="no_bom",
                items=[]
            )

        # 3. 聚合分析
        analysis_items = []
        applicable_count = 0
        fully_kitted_count = 0

        from apps.kuaizhizao.utils.issue_method_resolver import (
            is_kitting_rate_material,
            resolve_issue_method,
        )

        # 正式发料领料单 ID（排除历史叫料「主仓→线边」备料转移型，避免与线边库存双计）
        from apps.kuaizhizao.utils.picking_posting import filter_gi_picking_ids

        all_pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        picking_id_list = filter_gi_picking_ids(all_pickings)

        component_wos: Dict[int, WorkOrder] = {}
        component_owos: Dict[int, OutsourceWorkOrder] = {}
        if wo.work_order_group_id:
            child_rows = await WorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=wo.work_order_group_id,
                bom_parent_work_order_id=wo.id,
                deleted_at__isnull=True,
            ).all()
            component_wos = {int(r.product_id): r for r in child_rows if r.product_id}
            outsource_rows = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=wo.work_order_group_id,
                bom_parent_work_order_id=wo.id,
                deleted_at__isnull=True,
            ).all()
            component_owos = {int(r.product_id): r for r in outsource_rows if r.product_id}

        # 半成品供给：按末道检验放行量预计算（未检完不得计入上游齐套）
        component_wo_effective: Dict[int, Decimal] = {}
        for child_wo in component_wos.values():
            component_wo_effective[int(child_wo.id)] = (
                await self._resolve_work_order_effective_completed_quantity(
                    tenant_id, child_wo
                )
            )

        buy_or_open_ids = [
            int(req.component_id)
            for req in requirements
            if req.component_id
            and (
                getattr(req, "component_type", None) == SOURCE_TYPE_BUY
                or int(req.component_id) not in component_wos
            )
            and getattr(req, "component_type", None) != SOURCE_TYPE_OUTSOURCE
        ]
        open_purchase_map = await self._load_material_open_purchase_map(
            tenant_id, buy_or_open_ids
        )

        for req in requirements:
            source_type = getattr(req, "component_type", None)
            resolved_issue = resolve_issue_method(
                getattr(req, "issue_method", None),
                source_type,
            )
            kitting_applicable = is_kitting_rate_material(
                getattr(req, "issue_method", None),
                source_type,
            )
            required_qty = Decimal(str(req.gross_requirement))

            if not kitting_applicable:
                mid = int(req.component_id)
                supply_progress = self._resolve_kitting_supply_progress(
                    source_type=source_type,
                    required_qty=required_qty,
                    total_available=Decimal("0"),
                    has_related_production=False,
                    open_purchase=open_purchase_map.get(mid),
                )
                analysis_items.append(MaterialKittingItem(
                    material_id=req.component_id,
                    material_code=req.component_code,
                    material_name=req.component_name,
                    material_unit=req.unit,
                    source_type=source_type,
                    issue_method=resolved_issue,
                    kitting_applicable=False,
                    required_quantity=required_qty,
                    picked_quantity=Decimal("0"),
                    shortage_quantity=Decimal("0"),
                    main_warehouse_available=Decimal("0"),
                    line_side_available=Decimal("0"),
                    status="not_applicable",
                    locations=[],
                    supply_progress=supply_progress,
                ))
                continue

            applicable_count += 1

            # 3.1 正式发料数量（已确认领料明细；不含配料/叫料备料）
            if not picking_id_list:
                picked_qty = Decimal("0")
            else:
                agg_rows = await ProductionPickingItem.filter(
                    tenant_id=tenant_id,
                    picking_id__in=picking_id_list,
                    material_id=req.component_id,
                    status__in=["已领料", "已确认", "picked", "confirmed"],
                ).annotate(total=Sum("picked_quantity")).values("total")
                raw_total = (agg_rows[0]["total"] if agg_rows else None) or 0
                picked_qty = Decimal(str(raw_total))

            # 3.2 获取实时库位分布
            locations_data = await get_material_detailed_locations(tenant_id, req.component_id)
            locations: List[MaterialLocationInfo] = []
            for loc in locations_data:
                try:
                    qv = loc.get("quantity")
                    locations.append(
                        MaterialLocationInfo(
                            warehouse_id=int(loc.get("warehouse_id") or 0),
                            warehouse_name=str(loc.get("warehouse_name") or ""),
                            batch_no=loc.get("batch_no"),
                            quantity=Decimal(str(qv)) if qv is not None else Decimal("0"),
                            storage_location_code=loc.get("storage_location_code"),
                        )
                    )
                except Exception as exc:
                    logger.warning(f"齐套分析库位行解析跳过: {loc} err={exc}")

            # 3.3 计算按仓库类型的汇总库存（按 warehouse_type，不再用「线边位」标签推断）
            main_warehouse_qty = Decimal("0")
            line_side_qty = Decimal("0")
            for loc in locations_data:
                try:
                    q = Decimal(str(loc.get("quantity") or 0))
                except Exception:
                    q = Decimal("0")
                wh_type = str(loc.get("warehouse_type") or "normal")
                if wh_type == "line_side":
                    line_side_qty += q
                else:
                    main_warehouse_qty += q

            required_qty = Decimal(str(req.gross_requirement))
            shortage_qty = required_qty - picked_qty
            if shortage_qty < 0:
                shortage_qty = Decimal("0")

            related_summary: Optional[KittingRelatedWorkOrderSummary] = None
            wo_supply = Decimal("0")
            if source_type in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE):
                child_wo = component_wos.get(int(req.component_id))
                if child_wo:
                    effective = component_wo_effective.get(
                        int(child_wo.id), Decimal("0")
                    )
                    related_summary = await self._build_kitting_related_work_order_summary(
                        tenant_id,
                        child_wo,
                        effective_completed=effective,
                    )
                    wo_supply = effective

            related_outsource: Optional[KittingRelatedOutsourceWorkOrderSummary] = None
            owo_supply = Decimal("0")
            if source_type == SOURCE_TYPE_OUTSOURCE:
                child_owo = component_owos.get(int(req.component_id))
                if child_owo:
                    related_outsource = self._build_kitting_related_outsource_work_order_summary(
                        child_owo
                    )
                    # 委外已收货量计入齐套（草稿/未收货为 0，不得虚高齐套率）
                    owo_supply = Decimal(str(child_owo.received_quantity or 0))

            # 3.4 齐套可用：正式发料 + 线边 + 主仓 + 半成品有效完工 + 委外已收货
            # work_order_supply_quantity 仅自制/可配置有效完工：委外已收货在主仓，须走线边备料，
            # 不得计入「线边就绪」否则收货后永远不下推配料。
            total_available = (
                picked_qty + line_side_qty + main_warehouse_qty + wo_supply + owo_supply
            )
            shortage_qty = required_qty - total_available
            if shortage_qty < 0:
                shortage_qty = Decimal("0")
            
            if total_available >= required_qty:
                item_status = "fully_kitted"
                fully_kitted_count += 1
            elif total_available > picked_qty:
                item_status = "partial"
            else:
                item_status = "shortage"

            mid = int(req.component_id)
            supply_progress = self._resolve_kitting_supply_progress(
                source_type=source_type,
                required_qty=required_qty,
                total_available=total_available,
                has_related_production=(
                    related_summary is not None or related_outsource is not None
                ),
                open_purchase=open_purchase_map.get(mid),
            )

            analysis_items.append(MaterialKittingItem(
                material_id=req.component_id,
                material_code=req.component_code,
                material_name=req.component_name,
                material_unit=req.unit,
                source_type=source_type,
                issue_method=resolved_issue,
                kitting_applicable=True,
                required_quantity=required_qty,
                picked_quantity=picked_qty,
                shortage_quantity=shortage_qty,
                main_warehouse_available=main_warehouse_qty,
                line_side_available=line_side_qty,
                status=item_status,
                locations=locations,
                related_work_order=related_summary,
                work_order_supply_quantity=wo_supply,
                related_outsource_work_order=related_outsource,
                supply_progress=supply_progress,
            ))

        # 4. 汇总（服务/虚拟不计；库存件 + 委外子件计入齐套率）
        if applicable_count <= 0:
            kitting_rate = Decimal("100")
            overall_status = "fully_kitted"
        else:
            kitting_rate = Decimal(str(round(fully_kitted_count / applicable_count * 100, 2)))
            overall_status = "fully_kitted"
            if kitting_rate < 100:
                overall_status = "partial" if kitting_rate > 0 else "shortage"

        response = WorkOrderKittingAnalysisResponse(
            work_order_id=work_order_id,
            work_order_code=wo.code,
            kitting_rate=kitting_rate,
            status=overall_status,
            items=analysis_items
        )
        try:
            from apps.kuaizhizao.services.work_order_readiness_service import (
                persist_kitting_analysis_result,
            )

            await persist_kitting_analysis_result(tenant_id, work_order_id, response)
        except Exception as exc:
            logger.warning(f"齐套分析结果持久化失败 wo={work_order_id}: {exc}")
        return response

    async def merge_work_orders(
        self,
        tenant_id: int,
        merge_data: WorkOrderMergeRequest,
        created_by: int
    ) -> WorkOrderMergeResponse:
        """
        合并工单

        Args:
            tenant_id: 组织ID
            merge_data: 合并数据
            created_by: 创建人ID

        Returns:
            WorkOrderMergeResponse: 合并结果

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单不存在
            BusinessLogicError: 业务逻辑错误（如不能合并）
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "merge", False):
                raise BusinessLogicError("当前组织未开启工单合并能力，请在参数设置中开启“工单合并”")

            if len(merge_data.work_order_ids) < 2:
                raise ValidationError("至少需要2个工单才能合并")

            # 获取所有要合并的工单
            work_orders = []
            for work_order_id in merge_data.work_order_ids:
                work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
                work_orders.append(work_order)

            # 验证合并规则1：只能合并相同产品的工单
            first_product_id = work_orders[0].product_id
            for work_order in work_orders[1:]:
                if work_order.product_id != first_product_id:
                    raise BusinessLogicError(f"只能合并相同产品的工单，工单 {work_order.code} 的产品与第一个工单不同")

            # 验证合并规则2：只能合并相同状态的工单（draft/released）
            first_status = work_orders[0].status
            if first_status not in ['draft', 'released']:
                raise BusinessLogicError(f"只能合并草稿或已下达状态的工单，第一个工单状态为：{first_status}")
            
            for work_order in work_orders[1:]:
                if work_order.status != first_status:
                    raise BusinessLogicError(f"只能合并相同状态的工单，工单 {work_order.code} 的状态与第一个工单不同")

            # 验证合并规则3：不能合并已报工的工单
            for work_order in work_orders:
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    status='approved',
                    deleted_at__isnull=True
                ).all()
                if reporting_records:
                    total_reported = sum(Decimal(str(r.qualified_quantity)) for r in reporting_records)
                    if total_reported > 0:
                        raise BusinessLogicError(f"工单 {work_order.code} 已有报工记录（已报工数量：{total_reported}），不能合并")

            # 验证合并规则4：不能合并已冻结的工单
            for work_order in work_orders:
                if work_order.is_frozen:
                    raise BusinessLogicError(f"工单 {work_order.code} 已冻结，不能合并")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算合并后的数量（累加）
            total_quantity = sum(work_order.quantity for work_order in work_orders)

            # 生成合并后工单编码
            today = today_site_str()
            merged_code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="WORK_ORDER_CODE",
                prefix=f"WO{today}"
            )

            # 构建原工单编码列表（用于备注和响应）
            original_codes = [wo.code for wo in work_orders]
            original_ids = [wo.id for wo in work_orders]

            # 构建合并备注
            merge_remarks = f"由工单 {', '.join(original_codes)} 合并而成"
            if merge_data.remarks:
                merge_remarks = f"{merge_remarks}。{merge_data.remarks}"

            # 创建合并后的工单（以第一个工单的信息为基础）
            first_work_order = work_orders[0]
            merged_work_order = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=merged_code,
                name=f"{first_work_order.name}（合并）",
                product_id=first_work_order.product_id,
                product_code=first_work_order.product_code,
                product_name=first_work_order.product_name,
                quantity=total_quantity,
                production_mode=first_work_order.production_mode,
                sales_order_id=first_work_order.sales_order_id,
                sales_order_code=first_work_order.sales_order_code,
                sales_order_name=first_work_order.sales_order_name,
                workshop_id=first_work_order.workshop_id,
                workshop_name=first_work_order.workshop_name,
                work_center_id=first_work_order.work_center_id,
                work_center_name=first_work_order.work_center_name,
                status=first_status,
                priority=first_work_order.priority,
                planned_start_date=first_work_order.planned_start_date,
                planned_end_date=first_work_order.planned_end_date,
                remarks=merge_remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新原工单状态为cancelled
            for work_order in work_orders:
                work_order.status = 'cancelled'
                work_order.updated_by = created_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()

            # 建立原工单→合并工单 的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                for work_order in work_orders:
                    try:
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order.id,
                                source_code=work_order.code,
                                source_name=work_order.name,
                                target_type="work_order",
                                target_id=merged_work_order.id,
                                target_code=merged_work_order.code,
                                target_name=merged_work_order.name,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单合并",
                            ),
                            created_by=created_by,
                        )
                    except Exception as wo_rel_e:
                        logger.warning("创建工单合并单据关联失败(工单%s): %s", work_order.code, wo_rel_e)
            except Exception as e:
                logger.warning("创建工单合并单据关联失败: %s", e)

            logger.info(f"成功合并 {len(work_orders)} 个工单（{', '.join(original_codes)}）为新工单 {merged_code}")

            return WorkOrderMergeResponse(
                merged_work_order=WorkOrderResponse.model_validate(merged_work_order),
                original_work_order_ids=original_ids,
                original_work_order_codes=original_codes,
            )

    async def batch_work_orders_have_revoke_blocking_downstream(
        self,
        tenant_id: int,
        work_order_ids: list[int],
    ) -> dict[int, bool]:
        """批量判断工单是否存在阻止撤回的下游单据。"""
        ids = [int(i) for i in work_order_ids if i is not None]
        if not ids:
            return {}
        blocked: set[int] = set()

        report_ids = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id__in=ids,
            deleted_at__isnull=True,
        ).values_list("work_order_id", flat=True)
        blocked.update(int(i) for i in report_ids)

        from apps.kuaizhizao.models.production_picking import ProductionPicking
        from apps.kuaizhizao.models.production_return import ProductionReturn
        from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
        from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
        from apps.kuaizhizao.models.outsource_order import OutsourceOrder

        for model, extra_exclude in (
            (ProductionPicking, True),
            (ProductionReturn, True),
            (FinishedGoodsReceipt, True),
            (SemiFinishedGoodsReceipt, True),
        ):
            q = model.filter(
                tenant_id=tenant_id,
                work_order_id__in=ids,
                deleted_at__isnull=True,
            )
            if extra_exclude:
                q = q.exclude(status__in=["已作废", "cancelled"])
            found = await q.values_list("work_order_id", flat=True)
            blocked.update(int(i) for i in found)

        outsource_ids = await OutsourceOrder.filter(
            tenant_id=tenant_id,
            work_order_id__in=ids,
            deleted_at__isnull=True,
        ).exclude(status="cancelled").values_list("work_order_id", flat=True)
        blocked.update(int(i) for i in outsource_ids)

        return {wid: wid in blocked for wid in ids}

    async def _assert_work_order_revoke_no_downstream(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> None:
        """撤回前下游单据硬校验（具体原因文案）。"""
        if await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).exists():
            raise BusinessLogicError("工单已有报工记录，不允许撤回。只能撤回未报工的工单。")

        from apps.kuaizhizao.models.production_picking import ProductionPicking
        from apps.kuaizhizao.models.production_return import ProductionReturn
        from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
        from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
        from apps.kuaizhizao.models.outsource_order import OutsourceOrder

        downstream_checks = [
            (
                ProductionPicking.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exclude(status__in=["已作废", "cancelled"]).exists(),
                "工单已有生产领料单，不允许撤回",
            ),
            (
                ProductionReturn.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exclude(status__in=["已作废", "cancelled"]).exists(),
                "工单已有生产退料单，不允许撤回",
            ),
            (
                FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exclude(status__in=["已作废", "cancelled"]).exists(),
                "工单已有成品入库单，不允许撤回",
            ),
            (
                SemiFinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exclude(status__in=["已作废", "cancelled"]).exists(),
                "工单已有半成品入库单，不允许撤回",
            ),
            (
                OutsourceOrder.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exclude(status="cancelled").exists(),
                "工单已有委外单，不允许撤回",
            ),
        ]
        for exists_query, message in downstream_checks:
            if await exists_query:
                raise BusinessLogicError(message)

    async def revoke_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        revoked_by: int
    ) -> WorkOrderResponse:
        """
        撤回工单（从已下达或指定结束状态撤回为草稿状态）

        撤回条件：
        - 工单状态为 'released'（已下达）或 'completed'（已完成且为指定结束）
        - 工单没有产生过报工记录及领料/入库等下游单据

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            revoked_by: 撤回人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许撤回的工单状态
            BusinessLogicError: 工单已有报工记录，不允许撤回
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 状态/完工数量门禁 + 下游单据硬校验（具体文案）
            assert_work_order_capability(work_order, "revoke", has_downstream_documents=False)
            await self._assert_work_order_revoke_no_downstream(tenant_id, work_order_id)

            # 保存原始状态用于节点时间记录
            original_status = work_order.status

            # 更新状态为草稿，并重置实际执行时间
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=revoked_by,
                status='draft',
                manually_completed=False,  # 清除指定结束标记
                actual_start_date=None,
                actual_end_date=None
            )

            # 同步重置所有工序的状态和时间
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id
            ).update(
                status='pending',
                actual_start_date=None,
                actual_end_date=None,
                completed_quantity=0,
                qualified_quantity=0,
                unqualified_quantity=0
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束"下达"节点（如果存在）
                if original_status == 'released':
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code="released",
                        operator_id=revoked_by,
                    )
                elif original_status == 'completed':
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code="completed",
                        operator_id=revoked_by,
                    )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单撤回节点时间失败: {e}")

            from apps.kuaizhizao.services.batching_order_service import BatchingOrderService

            await BatchingOrderService().void_open_batching_orders_for_work_order(
                tenant_id, work_order_id
            )

            logger.info(f"工单 {work_order.code} 已撤回为草稿状态")
            return WorkOrderResponse.model_validate(work_order)

    async def manually_complete_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        completed_by: int,
        *,
        confirmed_batch_no: Optional[str] = None,
        confirmed_serial_no: Optional[str] = None,
    ) -> WorkOrderResponse:
        """
        指定结束工单

        将工单状态改为已完成，并标记为指定结束。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            completed_by: 完成人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许指定结束的工单状态
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            previous_status = str(getattr(work_order, "status", "") or "")

            # 检查工单状态：不能对已取消/已拆分的工单指定结束
            if previous_status in ('cancelled', 'split'):
                raise ValidationError("已取消或已拆分的工单不能指定结束")

            # 仅允许对已下达/执行中的工单做指定结束；草稿及其他异常状态应先规范到可执行状态。
            allowed_statuses = {"released", "in_progress", "completed"}
            if previous_status not in allowed_statuses:
                raise ValidationError("只能对已下达或进行中的工单指定结束")

            # 如果已经是已完成状态，直接返回
            if previous_status == 'completed':
                return await self.get_work_order_by_id(tenant_id, work_order_id)

            material = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if material and (work_order.tracking_mode or "none") != "none":
                tracking_service = WorkOrderTrackingService()
                if confirmed_serial_no:
                    await tracking_service.check_serial_modification_allowed(
                        tenant_id, work_order_id
                    )
                work_order = await tracking_service.confirm_tracking(
                    tenant_id,
                    work_order,
                    material,
                    confirmed_batch_no=confirmed_batch_no,
                    confirmed_serial_no=confirmed_serial_no,
                )

            # 更新状态为已完成，并标记为指定结束
            from datetime import datetime
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=completed_by,
                status='completed',
                manually_completed=True,
                actual_end_date=resolve_business_datetime()  # 设置实际结束时间
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束当前节点（如果存在）
                if previous_status in ['released', 'in_progress']:
                    current_node = 'released' if previous_status == 'released' else 'in_progress'
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code=current_node,
                        operator_id=completed_by,
                    )
                # 开始"完成"节点
                completed_by_info = await self.get_user_info(completed_by)
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    document_code=work_order.code,
                    node_name="完成",
                    node_code="completed",
                    operator_id=completed_by,
                    operator_name=completed_by_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单指定结束节点时间失败: {e}")

            logger.info(f"工单 {work_order.code} 已指定结束")
            return await self.get_work_order_by_id(tenant_id, work_order_id)

    async def confirm_work_order_tracking(
        self,
        tenant_id: int,
        work_order_id: int,
        updated_by: int,
        *,
        confirmed_batch_no: Optional[str] = None,
        confirmed_serial_no: Optional[str] = None,
    ) -> WorkOrderResponse:
        """完工前/完工时确认批号序列号（不改工单状态）。"""
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        if (work_order.status or "") == "split":
            raise BusinessLogicError("已拆分主工单不可直接确认追踪号，请在子工单上操作")

        material = await Material.get_or_none(
            id=work_order.product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not material:
            raise ValidationError("工单产品物料不存在")

        tracking_service = WorkOrderTrackingService()
        if confirmed_serial_no:
            await tracking_service.check_serial_modification_allowed(tenant_id, work_order_id)
        await tracking_service.confirm_tracking(
            tenant_id,
            work_order,
            material,
            confirmed_batch_no=confirmed_batch_no,
            confirmed_serial_no=confirmed_serial_no,
        )
        return await self.get_work_order_by_id(tenant_id, work_order_id)
