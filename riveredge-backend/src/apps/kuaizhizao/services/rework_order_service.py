"""
返工单业务服务模块

提供返工单相关的业务逻辑处理，包括CRUD操作、从工单创建返工单等。

Author: Luigi Lu
Date: 2026-01-05
"""

import uuid
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from decimal import Decimal

from core.utils.timezone_utils import resolve_business_datetime, today_site_str

from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService

from infra.models.user import User

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.rework_order_operation import ReworkOrderOperation
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.schemas.rework_order import (
    ReworkOrderCreate,
    ReworkOrderUpdate,
    ReworkOrderResponse,
    ReworkOrderListResponse,
    ReworkOrderFromWorkOrderRequest,
    ReworkOrderOperationItem,
    ReworkReportingCreate,
    ReworkReportingOptionItem,
    ReworkReportingOptionsResponse,
    ReworkAdvanceNextRequest,
    ReworkRequestCompleteRequest,
    ReworkQualityReleaseRequest,
    ReworkCloseRequest,
    ReworkCancelRequest,
    ReworkHoldRequest,
)
from apps.kuaizhizao.schemas.reporting_record import ReportingRecordResponse
from apps.kuaizhizao.services.document_action_policy.rework_order import (
    capability_kwargs_from_context,
    derive_rework_order_capabilities,
)
from apps.kuaizhizao.services.rework_order_workflow import (
    activate_operation_link,
    advance_next_operation,
    after_rework_report_approved,
    build_operation_items,
    cancel_rework_order,
    close_rework_order,
    compute_capability_context,
    hold_rework_order,
    quality_release,
    release_rework_order,
    request_completion,
    resume_rework_order,
    sync_route_on_create,
    complete_operation_link,
    sync_link_quantities_from_reports,
)
from apps.kuaizhizao.utils.rework_order_constants import (
    ROUTING_MODE_DYNAMIC,
    ROUTING_MODE_PREDEFINED,
    TERMINAL_REWORK_ORDER_STATUSES,
)
from loguru import logger


REWORK_ORDER_SORTABLE_FIELDS = frozenset({
    "code",
    "product_code",
    "product_name",
    "quantity",
    "rework_type",
    "status",
    "planned_start_date",
    "planned_end_date",
    "actual_start_date",
    "actual_end_date",
    "created_at",
    "updated_at",
})


def _dec(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0")


class ReworkOrderService(AppBaseService[ReworkOrder]):
    """
    返工单服务类

    处理返工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReworkOrder)
        self.business_config_service = BusinessConfigService()

    async def _sum_operation_display_unqualified(
        self,
        tenant_id: int,
        work_order_id: int,
        operations: List[WorkOrderOperation],
    ) -> Decimal:
        """与工序卡一致的不合格合计（方案质检取检验不合格）。"""
        from apps.kuaizhizao.services.operation_transfer_service import (
            build_operation_policy_cache,
            load_process_inspections_by_operation,
            resolve_operation_display_unqualified,
        )

        if not operations:
            return Decimal("0")
        master_ids = [
            int(op.operation_id) for op in operations if op.operation_id is not None
        ]
        policy_cache = await build_operation_policy_cache(tenant_id, master_ids)
        inspections_by_op = await load_process_inspections_by_operation(
            tenant_id, work_order_id
        )
        total = Decimal("0")
        for op in operations:
            total += await resolve_operation_display_unqualified(
                tenant_id,
                work_order_id,
                op,
                policy_cache=policy_cache,
                inspections_by_op=inspections_by_op,
            )
        return total

    async def _sum_existing_rework_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        start_work_order_operation_id: Optional[int] = None,
    ) -> Decimal:
        qs = ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).exclude(status="cancelled")
        if start_work_order_operation_id is not None:
            qs = qs.filter(start_work_order_operation_id=start_work_order_operation_id)
        rows = await qs.all()
        return sum(Decimal(str(row.quantity or 0)) for row in rows)

    async def _compute_reworkable_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        original_work_order: WorkOrder,
        *,
        start_work_order_operation_id: Optional[int] = None,
    ) -> Decimal:
        """可返工数量 = 不合格数量（指定工序或全工单）− 未取消返工单已占用数量。"""
        _ = original_work_order
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if start_work_order_operation_id is not None:
            source_ops = [
                op for op in operations if op.id == start_work_order_operation_id
            ]
            if not source_ops:
                return Decimal("0")
        else:
            source_ops = operations

        unqualified = await self._sum_operation_display_unqualified(
            tenant_id, work_order_id, source_ops
        )
        already = await self._sum_existing_rework_quantity(
            tenant_id,
            work_order_id,
            start_work_order_operation_id=start_work_order_operation_id,
        )
        reworkable = unqualified - already
        return reworkable if reworkable > 0 else Decimal("0")

    async def preview_rework_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        start_work_order_operation_id: Optional[int] = None,
    ) -> dict:
        original_work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not original_work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).all()
        if start_work_order_operation_id is not None:
            source_ops = [
                op for op in operations if op.id == start_work_order_operation_id
            ]
        else:
            source_ops = operations

        unqualified = await self._sum_operation_display_unqualified(
            tenant_id, work_order_id, source_ops
        )
        already = await self._sum_existing_rework_quantity(
            tenant_id,
            work_order_id,
            start_work_order_operation_id=start_work_order_operation_id,
        )
        reworkable = await self._compute_reworkable_quantity(
            tenant_id,
            work_order_id,
            original_work_order,
            start_work_order_operation_id=start_work_order_operation_id,
        )
        return {
            "reworkable_quantity": reworkable,
            "unqualified_quantity": unqualified,
            "already_rework_quantity": already,
            "start_work_order_operation_id": start_work_order_operation_id,
        }

    async def _validate_rework_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        original_work_order: WorkOrder,
        quantity: Decimal,
        *,
        start_work_order_operation_id: Optional[int] = None,
    ) -> None:
        if quantity <= 0:
            raise ValidationError("返工数量必须大于 0")
        reworkable = await self._compute_reworkable_quantity(
            tenant_id,
            work_order_id,
            original_work_order,
            start_work_order_operation_id=start_work_order_operation_id,
        )
        if quantity > reworkable:
            raise ValidationError(
                f"返工数量({quantity})不能超过可返工数量({reworkable})"
            )

    async def _validate_rework_operation_ids(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_ids: Optional[List[int]],
    ) -> None:
        if not operation_ids:
            return
        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            id__in=operation_ids,
            deleted_at__isnull=True,
        ).all()
        found_ids = {op.id for op in ops}
        missing = [op_id for op_id in operation_ids if op_id not in found_ids]
        if missing:
            raise ValidationError(f"工序不属于该工单或不存在: {missing}")

    async def _resolve_start_work_order_operation_id(
        self,
        tenant_id: int,
        work_order_id: int,
        explicit_start_id: Optional[int],
    ) -> int:
        if explicit_start_id is not None:
            await self._validate_rework_operation_ids(tenant_id, work_order_id, [explicit_start_id])
            return explicit_start_id
        first_op = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "id").first()
        if not first_op or first_op.id is None:
            raise ValidationError("原工单没有工序，无法创建返工单")
        return first_op.id

    async def _sync_start_operation_link(
        self,
        tenant_id: int,
        rework_order_id: int,
        start_work_order_operation_id: int,
        *,
        routing_mode: str = ROUTING_MODE_DYNAMIC,
        predefined_operation_ids: Optional[List[int]] = None,
        quantity: Optional[Decimal] = None,
    ) -> None:
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id, id=rework_order_id, deleted_at__isnull=True
        )
        qty = quantity if quantity is not None else _dec(rework_order.quantity if rework_order else 0)
        await sync_route_on_create(
            tenant_id,
            rework_order_id,
            routing_mode=routing_mode,
            start_work_order_operation_id=start_work_order_operation_id,
            predefined_operation_ids=predefined_operation_ids,
            quantity=qty,
        )

    async def _enrich_rework_order_response(
        self,
        tenant_id: int,
        resp: ReworkOrderResponse | ReworkOrderListResponse,
        rework_order: ReworkOrder,
    ) -> None:
        ctx = await compute_capability_context(tenant_id, rework_order)
        caps = derive_rework_order_capabilities(
            rework_order,
            **capability_kwargs_from_context(ctx),
        )
        resp.capabilities = caps
        if isinstance(resp, ReworkOrderResponse):
            items = await build_operation_items(tenant_id, rework_order)
            resp.rework_operations = [ReworkOrderOperationItem.model_validate(i) for i in items]
            if rework_order.verification_required or rework_order.verification_inspection_id:
                resp.verification_inspection_type = (
                    "finished_goods_inspection"
                    if rework_order.source_inspection_id
                    else "process_inspection"
                )
            # heal 可能改写 verification_inspection_id，回填最新值
            resp.verification_inspection_id = rework_order.verification_inspection_id

    async def _get_rework_operations(
        self, tenant_id: int, rework_order_id: int
    ) -> List[ReworkOrderOperationItem]:
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id,
            id=rework_order_id,
            deleted_at__isnull=True,
        )
        if not rework_order:
            return []
        items = await build_operation_items(tenant_id, rework_order)
        return [ReworkOrderOperationItem.model_validate(i) for i in items]

    async def _load_original_work_order_code_map(
        self,
        tenant_id: int,
        original_work_order_ids: List[int],
    ) -> dict[int, str]:
        unique_ids = [wo_id for wo_id in dict.fromkeys(original_work_order_ids) if wo_id]
        if not unique_ids:
            return {}
        rows = await WorkOrder.filter(
            tenant_id=tenant_id,
            id__in=unique_ids,
            deleted_at__isnull=True,
        ).values("id", "code")
        return {row["id"]: row["code"] for row in rows}

    @staticmethod
    def _attach_original_work_order_code(
        resp: ReworkOrderResponse | ReworkOrderListResponse,
        code_map: dict[int, str],
        original_work_order_id: Optional[int],
    ) -> None:
        if original_work_order_id and original_work_order_id in code_map:
            resp.original_work_order_code = code_map[original_work_order_id]

    async def _create_rework_document_relation(
        self,
        tenant_id: int,
        original_work_order_id: int,
        rework_order: ReworkOrder,
        created_by: int,
    ) -> None:
        """在返工单已提交后建立单据关联，避免与主事务嵌套 in_transaction 导致挂起。"""
        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            original_work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=original_work_order_id,
                deleted_at__isnull=True,
            )
            if not original_work_order:
                return
            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="work_order",
                    source_id=original_work_order_id,
                    source_code=original_work_order.code,
                    source_name=original_work_order.name,
                    target_type="rework_order",
                    target_id=rework_order.id,
                    target_code=rework_order.code,
                    target_name=rework_order.product_name,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="工单创建返工单",
                ),
                created_by=created_by,
            )
        except BusinessLogicError:
            pass  # 关联已存在，忽略
        except Exception as e:
            logger.warning("建立工单→返工单关联失败: %s", e)

    async def create_rework_order(
        self,
        tenant_id: int,
        rework_order_data: ReworkOrderCreate,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        创建返工单

        Args:
            tenant_id: 组织ID
            rework_order_data: 返工单创建数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "rework_order")
        if not is_enabled:
            raise BusinessLogicError("返工工单节点未启用，无法创建返工工单")

        # 编码生成、校验、用户信息查询均放在事务外，避免长事务与嵌套事务
        if not rework_order_data.code:
            today = today_site_str()
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="REWORK_ORDER_CODE",
                prefix=f"返工-{today}"
            )
        else:
            code = rework_order_data.code
            existing = await ReworkOrder.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True
            ).first()
            if existing:
                raise ValidationError(f"返工单编码 {code} 已存在")

        user_info = await self.get_user_info(created_by)

        original_work_order = None
        if rework_order_data.original_work_order_id:
            original_work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=rework_order_data.original_work_order_id,
                deleted_at__isnull=True
            )
            if not original_work_order:
                raise NotFoundError(f"原工单不存在: {rework_order_data.original_work_order_id}")

        start_work_order_operation_id = None
        predefined_operation_ids = None
        routing_mode = (rework_order_data.routing_mode or ROUTING_MODE_DYNAMIC).upper()
        if routing_mode not in (ROUTING_MODE_DYNAMIC, ROUTING_MODE_PREDEFINED):
            raise ValidationError(f"无效的路线模式: {rework_order_data.routing_mode}")

        if rework_order_data.original_work_order_id:
            if routing_mode == ROUTING_MODE_PREDEFINED:
                predefined_operation_ids = list(rework_order_data.predefined_operation_ids or [])
                if len(predefined_operation_ids) < 1:
                    raise ValidationError("预设路线至少需指定一道工序")
                await self._validate_rework_operation_ids(
                    tenant_id,
                    rework_order_data.original_work_order_id,
                    predefined_operation_ids,
                )
                start_work_order_operation_id = predefined_operation_ids[0]
            else:
                start_work_order_operation_id = await self._resolve_start_work_order_operation_id(
                    tenant_id,
                    rework_order_data.original_work_order_id,
                    rework_order_data.start_work_order_operation_id,
                )

        async with in_transaction():
            rework_order = await ReworkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                original_work_order_id=rework_order_data.original_work_order_id,
                original_work_order_uuid=rework_order_data.original_work_order_uuid,
                start_work_order_operation_id=start_work_order_operation_id,
                routing_mode=routing_mode,
                verification_required=bool(rework_order_data.verification_required),
                source_inspection_id=rework_order_data.source_inspection_id,
                product_id=rework_order_data.product_id,
                product_code=rework_order_data.product_code,
                product_name=rework_order_data.product_name,
                quantity=rework_order_data.quantity,
                rework_reason=rework_order_data.rework_reason,
                rework_type=rework_order_data.rework_type,
                route_id=rework_order_data.route_id,
                route_name=rework_order_data.route_name,
                status="draft",
                planned_start_date=rework_order_data.planned_start_date,
                planned_end_date=rework_order_data.planned_end_date,
                work_center_id=rework_order_data.work_center_id,
                work_center_name=rework_order_data.work_center_name,
                operator_id=rework_order_data.operator_id,
                operator_name=rework_order_data.operator_name,
                cost=Decimal("0"),
                remarks=rework_order_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            if start_work_order_operation_id is not None:
                await self._sync_start_operation_link(
                    tenant_id,
                    rework_order.id,
                    start_work_order_operation_id,
                    routing_mode=routing_mode,
                    predefined_operation_ids=predefined_operation_ids,
                    quantity=rework_order_data.quantity,
                )

        if rework_order_data.original_work_order_id:
            await self._create_rework_document_relation(
                tenant_id,
                rework_order_data.original_work_order_id,
                rework_order,
                created_by,
            )

        resp = ReworkOrderResponse.model_validate(rework_order)
        await self._enrich_rework_order_response(tenant_id, resp, rework_order)
        if original_work_order:
            resp.original_work_order_code = original_work_order.code
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        resp.lifecycle = get_rework_order_lifecycle(rework_order)
        if rework_order_data.original_work_order_id and original_work_order:
            from apps.kuaizhizao.services.kuaizhizao_business_notification import (
                ACTION_REWORKED,
                DOC_WORK_ORDER,
                dispatch_kuaizhizao_notification,
            )

            try:
                await dispatch_kuaizhizao_notification(
                    tenant_id,
                    trigger_document=DOC_WORK_ORDER,
                    trigger_action=ACTION_REWORKED,
                    variables={
                        "work_order_code": original_work_order.code or str(original_work_order.id),
                        "rework_order_code": rework_order.code or str(rework_order.id),
                        "product_name": rework_order.product_name or "—",
                        "quantity": str(rework_order.quantity or ""),
                        "rework_reason": rework_order.rework_reason or "—",
                        "detail_path": (
                            f"/apps/kuaizhizao/production-execution/work-orders?highlight="
                            f"{original_work_order.id}"
                        ),
                        "work_order_id": str(original_work_order.id),
                    },
                    context={"creator_user_id": original_work_order.created_by},
                )
            except Exception as exc:
                logger.warning(
                    "工单转返工消息提醒失败 tenant={} wo={}: {}",
                    tenant_id,
                    original_work_order.id,
                    exc,
                )
        return resp

    async def create_rework_order_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        request_data: ReworkOrderFromWorkOrderRequest,
        created_by: int
    ) -> ReworkOrderResponse:
        """
        从工单创建返工单

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            request_data: 创建返工单请求数据
            created_by: 创建人ID

        Returns:
            ReworkOrderResponse: 创建的返工单信息

        Raises:
            NotFoundError: 原工单不存在
            ValidationError: 数据验证失败
        """
        # 勿在此处再包 in_transaction：create_rework_order 内部已有事务，嵌套会导致 PostgreSQL 挂起
        original_work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        )
        if not original_work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        if original_work_order.status not in ["completed", "in_progress"]:
            raise BusinessLogicError(f"只有已完成或进行中的工单才能创建返工单，当前工单状态: {original_work_order.status}")

        existing_count = await ReworkOrder.filter(
            tenant_id=tenant_id,
            original_work_order_id=work_order_id,
            deleted_at__isnull=True
        ).count()
        sequence = existing_count + 1

        code = await self.generate_code(
            tenant_id=tenant_id,
            code_type="REWORK_ORDER_CODE",
            prefix=f"返工-{original_work_order.code}-{sequence:03d}"
        )

        start_op_id = request_data.start_work_order_operation_id
        if (
            start_op_id is None
            and request_data.predefined_operation_ids
            and len(request_data.predefined_operation_ids) > 0
        ):
            start_op_id = request_data.predefined_operation_ids[0]

        if request_data.quantity is not None:
            quantity = request_data.quantity
        else:
            quantity = await self._compute_reworkable_quantity(
                tenant_id,
                work_order_id,
                original_work_order,
                start_work_order_operation_id=start_op_id,
            )
            if quantity <= 0:
                raise ValidationError("该工单已无可返工数量")

        await self._validate_rework_quantity(
            tenant_id,
            work_order_id,
            original_work_order,
            quantity,
            start_work_order_operation_id=start_op_id,
        )
        if request_data.start_work_order_operation_id is not None:
            await self._validate_rework_operation_ids(
                tenant_id,
                work_order_id,
                [request_data.start_work_order_operation_id],
            )

        rework_order_data = ReworkOrderCreate(
            code=code,
            original_work_order_id=work_order_id,
            original_work_order_uuid=original_work_order.uuid,
            product_id=original_work_order.product_id,
            product_code=original_work_order.product_code,
            product_name=original_work_order.product_name,
            quantity=quantity,
            rework_reason=request_data.rework_reason,
            rework_type=request_data.rework_type,
            routing_mode=request_data.routing_mode,
            verification_required=request_data.verification_required,
            route_id=request_data.route_id,
            planned_start_date=request_data.planned_start_date,
            planned_end_date=request_data.planned_end_date,
            work_center_id=request_data.work_center_id or original_work_order.work_center_id,
            work_center_name=original_work_order.work_center_name if not request_data.work_center_id else None,
            start_work_order_operation_id=request_data.start_work_order_operation_id,
            predefined_operation_ids=request_data.predefined_operation_ids,
            remarks=request_data.remarks,
        )

        return await self.create_rework_order(
            tenant_id=tenant_id,
            rework_order_data=rework_order_data,
            created_by=created_by
        )

    async def get_rework_order_by_id(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> ReworkOrderResponse:
        """
        根据ID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        resp = ReworkOrderResponse.model_validate(rework_order)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        resp.lifecycle = get_rework_order_lifecycle(rework_order)
        await self._enrich_rework_order_response(tenant_id, resp, rework_order)
        if rework_order.original_work_order_id:
            code_map = await self._load_original_work_order_code_map(
                tenant_id, [rework_order.original_work_order_id]
            )
            self._attach_original_work_order_code(
                resp, code_map, rework_order.original_work_order_id
            )
        return resp

    async def get_rework_order_by_uuid(
        self,
        tenant_id: int,
        rework_order_uuid: str
    ) -> ReworkOrderResponse:
        """
        根据UUID获取返工单

        Args:
            tenant_id: 组织ID
            rework_order_uuid: 返工单UUID

        Returns:
            ReworkOrderResponse: 返工单信息

        Raises:
            NotFoundError: 返工单不存在
        """
        rework_order = await ReworkOrder.get_or_none(
            tenant_id=tenant_id,
            uuid=rework_order_uuid,
            deleted_at__isnull=True
        )
        if not rework_order:
            raise NotFoundError(f"返工单不存在: {rework_order_uuid}")
        resp = ReworkOrderResponse.model_validate(rework_order)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        resp.lifecycle = get_rework_order_lifecycle(rework_order)
        await self._enrich_rework_order_response(tenant_id, resp, rework_order)
        if rework_order.original_work_order_id:
            code_map = await self._load_original_work_order_code_map(
                tenant_id, [rework_order.original_work_order_id]
            )
            self._attach_original_work_order_code(
                resp, code_map, rework_order.original_work_order_id
            )
        return resp

    async def list_rework_orders(
        self,
        tenant_id: int,
        current_user: Optional[User] = None,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        original_work_order_id: Optional[int] = None,
        original_work_order_code: Optional[str] = None,
        product_name: Optional[str] = None,
        status: Optional[str] = None,
        rework_type: Optional[str] = None,
        keyword: Optional[str] = None,
        planned_start_from: Optional[date] = None,
        planned_start_to: Optional[date] = None,
        created_start_date: Optional[date] = None,
        created_end_date: Optional[date] = None,
        order_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取返工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 返工单编码（模糊搜索）
            original_work_order_id: 原工单ID
            product_name: 产品名称（模糊搜索）
            status: 返工单状态
            rework_type: 返工类型

        Returns:
            List[ReworkOrderListResponse]: 返工单列表
        """
        query = ReworkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        from apps.kuaizhizao.services.kuaizhizao_data_scope import apply_kuaizhizao_list_scope

        query = await apply_kuaizhizao_list_scope(
            query,
            tenant_id=tenant_id,
            current_user=current_user,
            resource="kuaizhizao:rework-order",
        )

        # 应用过滤条件
        kw = (keyword or "").strip()
        if kw:
            query = query.filter(
                Q(code__icontains=kw)
                | Q(product_name__icontains=kw)
                | Q(product_code__icontains=kw)
            )
        c = (code or "").strip()
        if c:
            query = query.filter(code__icontains=c)
        if original_work_order_id:
            query = query.filter(original_work_order_id=original_work_order_id)
        owc = (original_work_order_code or "").strip()
        if owc:
            matching_ids = await WorkOrder.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__icontains=owc,
            ).values_list("id", flat=True)
            query = query.filter(original_work_order_id__in=list(matching_ids))
        pn = (product_name or "").strip()
        if pn:
            query = query.filter(product_name__icontains=pn)
        if status:
            query = query.filter(status=status)
        if rework_type:
            query = query.filter(rework_type=rework_type)
        if planned_start_from is not None:
            query = query.filter(planned_start_date__gte=planned_start_from)
        if planned_start_to is not None:
            query = query.filter(planned_start_date__lte=planned_start_to)
        if created_start_date is not None:
            query = query.filter(created_at__gte=datetime.combine(created_start_date, time.min))
        if created_end_date is not None:
            query = query.filter(created_at__lte=datetime.combine(created_end_date, time.max))

        total = await query.count()
        order_clause = order_by if order_by else "-created_at"
        rework_orders = await query.offset(skip).limit(limit).order_by(order_clause)
        from apps.kuaizhizao.services.document_lifecycle_service import get_rework_order_lifecycle
        original_ids = [
            ro.original_work_order_id for ro in rework_orders if ro.original_work_order_id
        ]
        code_map = await self._load_original_work_order_code_map(tenant_id, original_ids)
        result = []
        for ro in rework_orders:
            resp = ReworkOrderListResponse.model_validate(ro)
            resp.lifecycle = get_rework_order_lifecycle(ro)
            await self._enrich_rework_order_response(tenant_id, resp, ro)
            self._attach_original_work_order_code(resp, code_map, ro.original_work_order_id)
            result.append(resp)
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True,
        }

    async def update_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int,
        rework_order_data: ReworkOrderUpdate,
        updated_by: int
    ) -> ReworkOrderResponse:
        """
        更新返工单

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID
            rework_order_data: 返工单更新数据
            updated_by: 更新人ID

        Returns:
            ReworkOrderResponse: 更新后的返工单信息

        Raises:
            NotFoundError: 返工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            if rework_order.status != "draft":
                raise BusinessLogicError("仅草稿态返工单允许修改")

            user_info = await self.get_user_info(updated_by)

            update_data = rework_order_data.model_dump(exclude_unset=True)
            update_data.pop("status", None)
            update_data["updated_by"] = updated_by
            update_data["updated_by_name"] = user_info["name"]

            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(**update_data)

            if "start_work_order_operation_id" in update_data or "predefined_operation_ids" in update_data:
                start_id = update_data.get("start_work_order_operation_id") or rework_order.start_work_order_operation_id
                routing_mode = update_data.get("routing_mode") or rework_order.routing_mode
                predefined_ids = update_data.get("predefined_operation_ids")
                if rework_order.original_work_order_id and start_id is not None:
                    if predefined_ids:
                        await self._validate_rework_operation_ids(
                            tenant_id,
                            rework_order.original_work_order_id,
                            predefined_ids,
                        )
                    else:
                        await self._validate_rework_operation_ids(
                            tenant_id,
                            rework_order.original_work_order_id,
                            [start_id],
                        )
                    await self._sync_start_operation_link(
                        tenant_id,
                        rework_order_id,
                        start_id,
                        routing_mode=routing_mode,
                        predefined_operation_ids=predefined_ids,
                        quantity=update_data.get("quantity", rework_order.quantity),
                    )

            # 返回更新后的返工单
            updated_rework_order = await self.get_rework_order_by_id(tenant_id, rework_order_id)
            return updated_rework_order

    async def delete_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int
    ) -> bool:
        """
        删除返工单（软删除）

        Args:
            tenant_id: 组织ID
            rework_order_id: 返工单ID

        Returns:
            bool: 删除是否成功

        Raises:
            NotFoundError: 返工单不存在
            BusinessLogicError: 已完成的返工单不允许删除
        """
        async with in_transaction():
            # 获取返工单
            rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)

            if rework_order.status not in ("draft", "cancelled"):
                if rework_order.status == "released":
                    has_reports = await ReportingRecord.filter(
                        tenant_id=tenant_id,
                        rework_order_id=rework_order_id,
                        deleted_at__isnull=True,
                    ).exists()
                    if has_reports:
                        raise BusinessLogicError("已有报工记录的返工单不允许删除")
                elif rework_order.status not in TERMINAL_REWORK_ORDER_STATUSES:
                    raise BusinessLogicError("当前状态的返工单不允许删除")

            # 软删除
            await ReworkOrder.filter(
                tenant_id=tenant_id,
                id=rework_order_id
            ).update(deleted_at=resolve_business_datetime())

            return True

    async def _get_rework_reporting_summary(
        self,
        tenant_id: int,
        rework_order: ReworkOrder,
    ) -> tuple[bool, Decimal, Decimal]:
        reports = await ReportingRecord.filter(
            tenant_id=tenant_id,
            rework_order_id=rework_order.id,
            deleted_at__isnull=True,
            status__in=["pending", "approved"],
        ).all()
        has_start_report = any(
            r.operation_id == rework_order.start_work_order_operation_id for r in reports
        )
        total_qualified = sum(
            Decimal(str(r.qualified_quantity or 0))
            for r in reports
            if r.status == "approved"
        )
        remaining = max(Decimal("0"), Decimal(str(rework_order.quantity or 0)) - total_qualified)
        return has_start_report, total_qualified, remaining

    async def get_rework_reporting_options(
        self,
        tenant_id: int,
        rework_order_id: int,
    ) -> ReworkReportingOptionsResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        ctx = await compute_capability_context(tenant_id, rework_order)
        caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
        from apps.kuaizhizao.services.document_action_policy.rework_order import assert_rework_order_capability
        assert_rework_order_capability(rework_order, "execute", caps)

        if not rework_order.original_work_order_id:
            raise BusinessLogicError("返工单未关联原工单，无法报工")

        current_link = ctx["current_link"]
        if not current_link and rework_order.status == "released" and ctx["links"]:
            # 下达后指针偶发丢失时，按起始工序行自愈激活
            start_link = ctx["links"][0]
            actor_id = int(rework_order.updated_by or rework_order.created_by or 0)
            actor_name = (
                rework_order.updated_by_name
                or rework_order.created_by_name
                or ""
            )
            await activate_operation_link(
                tenant_id,
                rework_order,
                start_link,
                input_quantity=_dec(rework_order.quantity),
                actor_id=actor_id,
                actor_name=actor_name,
            )
            ctx = await compute_capability_context(tenant_id, rework_order)
            current_link = ctx["current_link"]
        if not current_link:
            if ctx.get("awaiting_route_decision"):
                raise BusinessLogicError("当前工序已完成，请选择下一工序或申请完修")
            raise BusinessLogicError("当前无激活工序，请先下达或选择下一工序")

        ops = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        ).order_by("sequence", "id").all()

        reports = await ReportingRecord.filter(
            tenant_id=tenant_id,
            rework_order_id=rework_order_id,
            deleted_at__isnull=True,
            status__in=["pending", "approved"],
        ).all()
        reported_by_op: dict[int, Decimal] = {}
        qualified_by_op: dict[int, Decimal] = {}
        for record in reports:
            op_id = record.operation_id
            reported_by_op[op_id] = reported_by_op.get(op_id, Decimal("0")) + _dec(record.reported_quantity)
            if record.status == "approved":
                qualified_by_op[op_id] = qualified_by_op.get(op_id, Decimal("0")) + _dec(record.qualified_quantity)

        await sync_link_quantities_from_reports(tenant_id, current_link)
        remaining = max(Decimal("0"), _dec(current_link.input_quantity) - _dec(current_link.qualified_quantity))
        current_op = next((op for op in ops if op.id == current_link.work_order_operation_id), None)

        operation_items: List[ReworkReportingOptionItem] = []
        for op in ops:
            if op.id is None:
                continue
            selectable = op.id == current_link.work_order_operation_id
            operation_items.append(
                ReworkReportingOptionItem(
                    work_order_operation_id=op.id,
                    operation_code=op.operation_code,
                    operation_name=op.operation_name,
                    sequence=op.sequence,
                    is_start_operation=op.id == rework_order.start_work_order_operation_id,
                    is_current_operation=selectable,
                    reported_quantity=reported_by_op.get(op.id, Decimal("0")),
                    qualified_quantity=qualified_by_op.get(op.id, Decimal("0")),
                    selectable=selectable,
                )
            )

        return ReworkReportingOptionsResponse(
            rework_order_id=rework_order.id,
            rework_order_code=rework_order.code,
            routing_mode=rework_order.routing_mode,
            rework_quantity=rework_order.quantity,
            current_work_order_operation_id=current_link.work_order_operation_id,
            current_operation_name=current_op.operation_name if current_op else None,
            remaining_input_quantity=remaining,
            total_qualified_quantity=_dec(current_link.qualified_quantity),
            operations=operation_items,
        )

    async def create_rework_reporting(
        self,
        tenant_id: int,
        rework_order_id: int,
        reporting_data: ReworkReportingCreate,
        reported_by: int,
    ) -> ReportingRecordResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        ctx = await compute_capability_context(tenant_id, rework_order)
        caps = derive_rework_order_capabilities(rework_order, **capability_kwargs_from_context(ctx))
        from apps.kuaizhizao.services.document_action_policy.rework_order import assert_rework_order_capability
        assert_rework_order_capability(rework_order, "execute", caps)

        current_link = ctx["current_link"]
        if not current_link:
            if ctx.get("awaiting_route_decision"):
                raise BusinessLogicError("当前工序已完成，请选择下一工序或申请完修")
            raise BusinessLogicError("当前无激活工序，无法报工")
        if reporting_data.work_order_operation_id != current_link.work_order_operation_id:
            raise BusinessLogicError("报工必须落在当前激活工序上")

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"原工单不存在: {rework_order.original_work_order_id}")

        work_order_operation = await WorkOrderOperation.get_or_none(
            tenant_id=tenant_id,
            id=reporting_data.work_order_operation_id,
            work_order_id=rework_order.original_work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order_operation:
            raise ValidationError("所选工序不属于原工单或不存在")

        await sync_link_quantities_from_reports(tenant_id, current_link)
        reported_qty = _dec(reporting_data.reported_quantity)
        qualified_qty = _dec(reporting_data.qualified_quantity)
        unqualified_qty = _dec(reporting_data.unqualified_quantity)
        if reported_qty <= 0:
            raise ValidationError("报工数量必须大于 0")
        if qualified_qty + unqualified_qty != reported_qty:
            raise ValidationError("合格数量 + 不合格数量必须等于报工数量")
        remaining = max(Decimal("0"), _dec(current_link.input_quantity) - _dec(current_link.qualified_quantity))
        if qualified_qty > remaining:
            raise BusinessLogicError(f"当前工序合格数量不能超过剩余投入数量（{remaining}）")

        wh = _dec(reporting_data.work_hours)
        if wh < 0:
            raise ValidationError("报工工时不能为负数")

        user_info = await self.get_user_info(reported_by)
        recorder_name = user_info.get("name")

        reporting_audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "reporting_record"
        )
        biz_config = await self.business_config_service.get_business_config(tenant_id)
        reporting_params = biz_config.get("parameters", {}).get("reporting", {})
        auto_approve = reporting_params.get("auto_approve", False)
        should_auto_approve = (not reporting_audit_required) or bool(auto_approve)

        status = "pending"
        approved_at = None
        approved_by = None
        approved_by_name = None
        if should_auto_approve:
            status = "approved"
            approved_at = resolve_business_datetime()
            approved_by = reported_by
            approved_by_name = recorder_name or reporting_data.worker_name

        async with in_transaction():
            # WorkOrder.name 可为 null；ReportingRecord.work_order_name 非空，须有展示名
            trusted_work_order_name = (
                (work_order.name or "").strip()
                or (work_order.product_name or "").strip()
                or (work_order.code or "").strip()
                or f"WO-{work_order.id}"
            )
            reporting_record = await ReportingRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=work_order.id,
                rework_order_id=rework_order.id,
                rework_order_operation_id=current_link.id,
                work_order_code=work_order.code or f"WO-{work_order.id}",
                work_order_name=trusted_work_order_name,
                operation_id=work_order_operation.id,
                operation_code=work_order_operation.operation_code,
                operation_name=work_order_operation.operation_name,
                worker_id=reporting_data.worker_id,
                worker_name=reporting_data.worker_name,
                recorded_by=int(reported_by),
                recorded_by_name=recorder_name,
                reported_quantity=reported_qty,
                qualified_quantity=qualified_qty,
                unqualified_quantity=unqualified_qty,
                work_hours=wh,
                status=status,
                reported_at=reporting_data.reported_at,
                remarks=reporting_data.remarks,
                approved_at=approved_at,
                approved_by=approved_by,
                approved_by_name=approved_by_name,
            )

            if status == "approved":
                await after_rework_report_approved(
                    tenant_id,
                    rework_order.id,
                    current_link.id,
                    actor_id=reported_by,
                    actor_name=recorder_name or "",
                )
            elif rework_order.status == "released":
                rework_order.status = "in_progress"
                rework_order.actual_start_date = rework_order.actual_start_date or resolve_business_datetime()
                rework_order.updated_by = reported_by
                rework_order.updated_by_name = recorder_name
                await rework_order.save()

        return ReportingRecordResponse.model_validate(reporting_record)

    async def release_rework_order(self, tenant_id: int, rework_order_id: int, released_by: int) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(released_by)
        await release_rework_order(
            tenant_id,
            rework_order,
            released_by=released_by,
            released_by_name=user_info["name"],
            get_user_info=self.get_user_info,
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def advance_rework_next_operation(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkAdvanceNextRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await advance_next_operation(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def request_rework_completion(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkRequestCompleteRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await request_completion(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def quality_release_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkQualityReleaseRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await quality_release(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def close_rework_order(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkCloseRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await close_rework_order(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def cancel_rework_order_flow(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkCancelRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await cancel_rework_order(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def hold_rework_order_flow(
        self,
        tenant_id: int,
        rework_order_id: int,
        request: ReworkHoldRequest,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await hold_rework_order(
            tenant_id,
            rework_order,
            request,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    async def resume_rework_order_flow(
        self,
        tenant_id: int,
        rework_order_id: int,
        actor_id: int,
    ) -> ReworkOrderResponse:
        rework_order = await self.get_by_id(tenant_id, rework_order_id, raise_if_not_found=True)
        user_info = await self.get_user_info(actor_id)
        await resume_rework_order(
            tenant_id,
            rework_order,
            actor_id=actor_id,
            actor_name=user_info["name"],
        )
        return await self.get_rework_order_by_id(tenant_id, rework_order_id)

    @staticmethod
    async def on_rework_reporting_approved(
        tenant_id: int,
        reporting_record: ReportingRecord,
        approved_by: int,
        approved_by_name: str,
    ) -> None:
        if not reporting_record.rework_order_id or not reporting_record.rework_order_operation_id:
            return
        await after_rework_report_approved(
            tenant_id,
            reporting_record.rework_order_id,
            reporting_record.rework_order_operation_id,
            actor_id=approved_by,
            actor_name=approved_by_name,
        )
