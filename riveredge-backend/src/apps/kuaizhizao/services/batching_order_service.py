"""
配料单业务服务模块

提供配料单相关的业务逻辑处理，包括从工单生成配料单、确认配料等。
配料：按工单或计划，从主仓/线边仓拣选物料并按 BOM 配好，供产线使用。

Author: Luigi Lu
Date: 2026-02-28
"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from decimal import Decimal

from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.batching_order import BatchingOrder, BatchingOrderItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.batching_order import (
    BatchingOrderCreate,
    BatchingOrderUpdate,
    BatchingOrderResponse,
    BatchingOrderListResponse,
    BatchingOrderItemCreate,
    BatchingOrderItemResponse,
    BatchingOrderWithItemsResponse,
    PullFromWorkOrderRequest,
    BatchingOrderConfirmRequest,
)
from apps.kuaizhizao.utils.issue_method_resolver import is_batching_material
from apps.kuaizhizao.utils.warehouse_resolver import (
    resolve_line_side_warehouse_for_work_order,
    resolve_source_warehouse_for_work_order,
)
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


class BatchingOrderService(AppBaseService[BatchingOrder]):
    _ALLOWED_WO_STATUSES = (
        "released", "dispatched", "confirmed", "已下达", "已确认", "in_progress", "draft",
    )

    def __init__(self):
        super().__init__(BatchingOrder)
        self.business_config_service = BusinessConfigService()

    async def create_batching_order(
        self,
        tenant_id: int,
        order_data: BatchingOrderCreate,
        created_by: int,
        items: Optional[List[BatchingOrderItemCreate]] = None,
    ) -> BatchingOrderResponse:
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BATCHING_ORDER_CODE",
                prefix=f"PL{today}",
            )
            user_info = await self.get_user_info(created_by)

            order = await BatchingOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=order_data.warehouse_id,
                warehouse_name=order_data.warehouse_name,
                work_order_id=order_data.work_order_id,
                work_order_code=order_data.work_order_code,
                production_plan_id=order_data.production_plan_id,
                batching_date=order_data.batching_date,
                status="draft",
                total_items=0,
                target_warehouse_id=order_data.target_warehouse_id,
                target_warehouse_name=order_data.target_warehouse_name,
                remarks=order_data.remarks,
                attachments=order_data.attachments,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            if items:
                for item_data in items:
                    await BatchingOrderItem.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        batching_order_id=order.id,
                        material_id=item_data.material_id,
                        material_code=item_data.material_code,
                        material_name=item_data.material_name,
                        unit=item_data.unit or "",
                        required_quantity=item_data.required_quantity,
                        picked_quantity=Decimal("0"),
                        warehouse_id=item_data.warehouse_id,
                        warehouse_name=item_data.warehouse_name,
                        location_id=item_data.location_id,
                        location_code=item_data.location_code,
                        batch_no=item_data.batch_no,
                        status="pending",
                        remarks=item_data.remarks,
                    )
                order.total_items = len(items)
                await order.save()

            return BatchingOrderResponse.model_validate(order)

    async def _get_pick_shortage_lines(self, tenant_id: int, work_order: WorkOrder):
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        analysis = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order.id)
        reqs = await calculate_material_requirements_from_bom(
            tenant_id=tenant_id,
            material_id=work_order.product_id,
            required_quantity=float(work_order.quantity or 1),
            only_approved=True,
            variant_attributes=work_order.variant_attributes,
            configurable_selections=work_order.configurable_selections,
            for_kitting_analysis=True,
        )
        issue_map = {r.component_id: r.issue_method for r in reqs}
        lines = []
        for item in analysis.items:
            im = issue_map.get(item.material_id, "pick")
            if not is_batching_material(im, getattr(item, "source_type", None)):
                continue
            # 配料口径：线边就绪（正式发料 + 线边备料 + 关联工单供给），不含主仓。
            # picked 不含历史叫料备料转移，避免与线边双计。
            required = item.required_quantity or Decimal("0")
            line_ready = (
                (item.picked_quantity or Decimal("0"))
                + (item.line_side_available or Decimal("0"))
                + (item.work_order_supply_quantity or Decimal("0"))
            )
            shortage = required - line_ready
            if shortage <= 0:
                continue
            lines.append((item, shortage))
        return lines, analysis

    @staticmethod
    def _derive_batching_pull_capability(
        work_order: WorkOrder,
        *,
        has_existing_draft: bool,
        has_shortage: bool,
    ) -> tuple[bool, Optional[str]]:
        if work_order.status in ("completed", "cancelled", "已完工", "已取消"):
            return False, "batching_order.pull_from_work_order.not_allowed"
        if not work_order.product_id:
            return False, "batching_order.pull_from_work_order.no_product"
        if has_existing_draft:
            return False, "batching_order.pull_from_work_order.existing_draft"
        if not has_shortage:
            return False, "batching_order.pull_from_work_order.no_shortage_lines"
        return True, None

    async def list_batching_pull_candidates(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Dict[str, Any]:
        from tortoise.expressions import Q

        query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        work_orders = await query.offset(skip).limit(limit).order_by("-updated_at")
        wo_ids = [int(wo.id) for wo in work_orders if wo.id is not None]

        existing_draft_ids: set[int] = set()
        if wo_ids:
            drafts = await BatchingOrder.filter(
                tenant_id=tenant_id,
                work_order_id__in=wo_ids,
                status__in=["draft", "picking"],
                deleted_at__isnull=True,
            ).values_list("work_order_id", flat=True)
            existing_draft_ids = {int(x) for x in drafts if x is not None}

        candidates: List[Dict[str, Any]] = []
        for work_order in work_orders:
            wo_id = int(work_order.id)
            has_draft = wo_id in existing_draft_ids
            has_shortage = False
            if not has_draft and work_order.product_id:
                try:
                    shortage_lines, _ = await self._get_pick_shortage_lines(tenant_id, work_order)
                    has_shortage = len(shortage_lines) > 0
                except Exception:
                    has_shortage = False
            allowed, reason = self._derive_batching_pull_capability(
                work_order,
                has_existing_draft=has_draft,
                has_shortage=has_shortage,
            )
            candidates.append(
                {
                    "id": wo_id,
                    "code": str(work_order.code or ""),
                    "name": str(work_order.name or "") or None,
                    "status": str(work_order.status or ""),
                    "planned_quantity": float(work_order.quantity or 0) if work_order.quantity is not None else None,
                    "pullable": allowed,
                    "capabilities": {
                        "push_batching_order": {"allowed": allowed, "reason": reason},
                    },
                }
            )
        return {"data": candidates, "total": total, "success": True}

    async def get_batching_pull_preview(
        self,
        tenant_id: int,
        work_order_id: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.types import CAPABILITY_REASON_MESSAGES

        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        existing = await BatchingOrder.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status__in=["draft", "picking"],
            deleted_at__isnull=True,
        )
        shortage_lines, _analysis = await self._get_pick_shortage_lines(tenant_id, work_order)
        allowed, reason = self._derive_batching_pull_capability(
            work_order,
            has_existing_draft=existing is not None,
            has_shortage=len(shortage_lines) > 0,
        )
        if not allowed:
            msg = CAPABILITY_REASON_MESSAGES.get(reason or "", reason or "不可取单")
            return {
                "work_order_id": work_order_id,
                "work_order_code": str(work_order.code or ""),
                "items": [],
                "summary": f"工单 {work_order.code}：不可取单",
                "message": reason,
                "has_blocking_issues": True,
                "blocking_reason": msg,
            }

        preview_lines: List[Dict[str, Any]] = []
        for item, shortage in shortage_lines:
            preview_lines.append(
                {
                    "item_id": int(item.material_id),
                    "material_id": int(item.material_id),
                    "material_code": str(item.material_code or ""),
                    "material_name": str(item.material_name or ""),
                    "material_unit": str(item.material_unit or "个"),
                    "quantity": float(item.required_quantity or 0),
                    "pushed_quantity": float(item.picked_quantity or 0),
                    "max_push_quantity": float(shortage),
                }
            )
        pushable = len(preview_lines)
        blocking_reason = None
        if pushable == 0:
            blocking_reason = "当前工单无待备料缺料行"
        return {
            "work_order_id": work_order_id,
            "work_order_code": str(work_order.code or ""),
            "items": preview_lines,
            "summary": f"工单 {work_order.code}：{pushable} 行可备料",
            "message": None,
            "has_blocking_issues": pushable == 0,
            "blocking_reason": blocking_reason,
        }

    async def _sync_shortage_lines_to_draft_order(
        self,
        tenant_id: int,
        order: BatchingOrder,
        work_order: WorkOrder,
        updated_by: Optional[int] = None,
    ) -> BatchingOrderWithItemsResponse:
        """将工单当前缺料行补全/同步到草稿配料单（含 pick + backflush）。"""
        if order.status not in ("draft", "picking"):
            return await self.get_batching_order_by_id(tenant_id, order.id)

        shortage_lines, _analysis = await self._get_pick_shortage_lines(tenant_id, work_order)
        wh_id = order.warehouse_id
        wh_name = order.warehouse_name
        if not wh_id:
            wh_id, wh_name = await resolve_source_warehouse_for_work_order(tenant_id, work_order, None)

        existing_items = await BatchingOrderItem.filter(
            batching_order_id=order.id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).all()
        existing_by_material = {i.material_id: i for i in existing_items}

        async with in_transaction():
            for item, shortage in shortage_lines:
                existing = existing_by_material.get(item.material_id)
                if existing:
                    if existing.required_quantity != shortage:
                        existing.required_quantity = shortage
                        await existing.save()
                    continue
                await BatchingOrderItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    batching_order_id=order.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    unit=item.material_unit or "",
                    required_quantity=shortage,
                    picked_quantity=Decimal("0"),
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                    status="pending",
                )

            total = await BatchingOrderItem.filter(
                batching_order_id=order.id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).count()
            order.total_items = total
            if updated_by:
                user_info = await self.get_user_info(updated_by)
                order.updated_by = updated_by
                order.updated_by_name = user_info["name"]
            await order.save()

        return await self.get_batching_order_by_id(tenant_id, order.id)

    async def sync_from_work_order(
        self,
        tenant_id: int,
        order_id: int,
        updated_by: int,
    ) -> BatchingOrderWithItemsResponse:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"线边备料单不存在: {order_id}")
        if not order.work_order_id:
            raise ValidationError("线边备料单未关联工单，无法同步缺料")
        work_order = await WorkOrder.get_or_none(
            id=order.work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {order.work_order_id}")
        return await self._sync_shortage_lines_to_draft_order(
            tenant_id, order, work_order, updated_by=updated_by
        )

    async def pull_from_work_order(
        self,
        tenant_id: int,
        request_data: PullFromWorkOrderRequest,
        created_by: int,
    ) -> BatchingOrderWithItemsResponse:
        work_order = await WorkOrder.get_or_none(
            id=request_data.work_order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {request_data.work_order_id}")

        if work_order.status in ("completed", "cancelled", "已完工", "已取消"):
            raise ValidationError(f"工单状态 {work_order.status} 不可生成线边备料单")

        if not work_order.product_id:
            raise ValidationError("工单未关联产品物料，无法按 BOM 展开备料需求")

        existing = await BatchingOrder.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            status__in=["draft", "picking"],
            deleted_at__isnull=True,
        )
        if existing:
            if request_data.allow_existing_draft:
                work_order_for_sync = work_order
                return await self._sync_shortage_lines_to_draft_order(
                    tenant_id,
                    existing,
                    work_order_for_sync,
                    updated_by=created_by,
                )
            raise BusinessLogicError(
                f"工单 {work_order.code} 已有进行中的线边备料单 {existing.code}，请先处理或确认"
            )

        shortage_lines, _analysis = await self._get_pick_shortage_lines(tenant_id, work_order)
        if not shortage_lines:
            raise ValidationError("当前工单无待备料缺料行，无需主动备料")

        src_id, src_name = await resolve_source_warehouse_for_work_order(
            tenant_id, work_order, request_data.warehouse_id
        )
        tgt_id, tgt_name = await resolve_line_side_warehouse_for_work_order(
            tenant_id, work_order, request_data.target_warehouse_id
        )
        wh_id = request_data.warehouse_id or src_id
        wh_name = request_data.warehouse_name or src_name
        tgt_wh_id = request_data.target_warehouse_id or tgt_id
        tgt_wh_name = request_data.target_warehouse_name or tgt_name

        batching_date = request_data.batching_date or datetime.now()

        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BATCHING_ORDER_CODE",
                prefix=f"PL{today}",
            )
            user_info = await self.get_user_info(created_by)

            order = await BatchingOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                warehouse_id=wh_id,
                warehouse_name=wh_name,
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                production_plan_id=None,
                batching_date=batching_date,
                status="draft",
                total_items=len(shortage_lines),
                target_warehouse_id=tgt_wh_id,
                target_warehouse_name=tgt_wh_name,
                remarks=request_data.remarks or "主动线边备料（齐套缺料）",
                attachments=request_data.attachments,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            for item, shortage in shortage_lines:
                await BatchingOrderItem.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    batching_order_id=order.id,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    unit=item.material_unit or "",
                    required_quantity=shortage,
                    picked_quantity=Decimal("0"),
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                    status="pending",
                )

            return await self.get_batching_order_by_id(tenant_id, order.id)

    async def get_batching_order_by_id(
        self,
        tenant_id: int,
        order_id: int,
    ) -> BatchingOrderWithItemsResponse:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"线边备料单不存在: {order_id}")

        items = await BatchingOrderItem.filter(
            batching_order_id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("id")

        from apps.kuaizhizao.services.document_lifecycle_service import get_batching_order_lifecycle, get_document_milestones
        milestones = await get_document_milestones(order.tenant_id, "batching_order", order.id)
        
        response = BatchingOrderWithItemsResponse.model_validate(order)
        response.items = [BatchingOrderItemResponse.model_validate(item) for item in items]
        response.lifecycle = get_batching_order_lifecycle(order, milestones=milestones)
        return response

    async def update_batching_order(
        self,
        tenant_id: int,
        order_id: int,
        order_data: BatchingOrderUpdate,
        updated_by: int,
    ) -> BatchingOrderResponse:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"线边备料单不存在: {order_id}")
        if order.status not in ["draft", "picking"]:
            raise ValidationError(f"线边备料单状态为 {order.status}，不能修改")

        user_info = await self.get_user_info(updated_by)

        for field, value in order_data.model_dump(exclude_unset=True).items():
            setattr(order, field, value)

        order.updated_by = updated_by
        order.updated_by_name = user_info["name"]
        await order.save()
        return BatchingOrderResponse.model_validate(order)

    async def list_batching_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        warehouse_id: Optional[int] = None,
        work_order_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> BatchingOrderListResponse:
        query = BatchingOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if code:
            query = query.filter(code__icontains=code)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if status:
            query = query.filter(status=status)

        total = await query.count()
        orders = await query.order_by("-created_at").offset(skip).limit(limit)
        return BatchingOrderListResponse(
            items=[BatchingOrderResponse.model_validate(o) for o in orders],
            total=total,
        )

    async def confirm_batching_order(
        self,
        tenant_id: int,
        order_id: int,
        executed_by: int,
        confirm_data: Optional[BatchingOrderConfirmRequest] = None,
    ) -> BatchingOrderResponse:
        from apps.kuaizhizao.services.inventory_service import InventoryService
        from apps.master_data.models.material import Material
        from infra.services.business_config_service import BusinessConfigService

        batch_map = {}
        confirm_map: dict = {}
        if confirm_data and confirm_data.item_batches:
            for b in confirm_data.item_batches:
                confirm_map[b.item_id] = b
                if b.batch_no and b.batch_no.strip():
                    batch_map[b.item_id] = b.batch_no.strip()

        async with in_transaction():
            order = await BatchingOrder.get_or_none(
                id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not order:
                raise NotFoundError(f"线边备料单不存在: {order_id}")
            if order.status not in ["draft", "picking"]:
                raise ValidationError(f"线边备料单状态为 {order.status}，不能确认备料")

            if not order.target_warehouse_id:
                wo = None
                if order.work_order_id:
                    wo = await WorkOrder.get_or_none(id=order.work_order_id, tenant_id=tenant_id)
                tgt_id, tgt_name = await resolve_line_side_warehouse_for_work_order(tenant_id, wo, None)
                order.target_warehouse_id = tgt_id
                order.target_warehouse_name = tgt_name
                await order.save()

            items = await BatchingOrderItem.filter(
                batching_order_id=order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            if not items:
                raise ValidationError("线边备料单没有明细")

            biz_config = await BusinessConfigService().get_business_config(tenant_id)
            enforce_fifo = bool(biz_config.get("parameters", {}).get("warehouse", {}).get("fifo", False))

            user_info = await self.get_user_info(executed_by)
            executed_at = datetime.now()
            wo_code = order.work_order_code

            use_selective_confirm = bool(confirm_data and confirm_data.item_batches)
            picked_this_round = 0

            for item in items:
                conf = confirm_map.get(item.id) if use_selective_confirm else None
                if item.status == "picked":
                    continue
                if use_selective_confirm:
                    if conf is None or conf.skip:
                        continue
                    pick_qty = (
                        conf.pick_quantity
                        if conf.pick_quantity is not None
                        else item.required_quantity
                    )
                else:
                    pick_qty = item.required_quantity

                pick_qty = Decimal(str(pick_qty or 0))
                if pick_qty <= 0:
                    continue
                if pick_qty > item.required_quantity:
                    raise ValidationError(
                        f"物料 {item.material_code} 备料数量不能超过需求数量 {item.required_quantity}"
                    )

                batch_no = batch_map.get(item.id) or getattr(item, "batch_no", None)
                mat = await Material.get_or_none(
                    tenant_id=tenant_id, id=item.material_id, deleted_at__isnull=True
                )
                batch_managed = bool(mat and getattr(mat, "batch_managed", False))
                inv_batch = batch_no if batch_managed else None
                if batch_managed and not inv_batch and not enforce_fifo:
                    raise ValidationError(f"物料 {item.material_code} 启用批号管理，请指定批号")

                src_wh = order.warehouse_id
                await InventoryService.decrease_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=pick_qty,
                    warehouse_id=src_wh,
                    batch_no=inv_batch,
                    source_type="batching_order",
                    source_doc_id=order.id,
                    source_doc_code=order.code,
                    enforce_fifo=enforce_fifo,
                    work_order_id=order.work_order_id,
                    work_order_code=wo_code,
                    movement_type="staging_to_line",
                    from_warehouse_id=src_wh,
                    to_warehouse_id=order.target_warehouse_id,
                    idempotency_key=f"batching_order:{order.id}:dec:{item.id}",
                )
                await InventoryService.increase_stock(
                    tenant_id=tenant_id,
                    material_id=item.material_id,
                    quantity=pick_qty,
                    warehouse_id=order.target_warehouse_id,
                    batch_no=inv_batch,
                    source_type="batching_order",
                    source_doc_id=order.id,
                    source_doc_code=order.code,
                    work_order_id=order.work_order_id,
                    work_order_code=wo_code,
                    movement_type="staging_to_line",
                    from_warehouse_id=src_wh,
                    to_warehouse_id=order.target_warehouse_id,
                    idempotency_key=f"batching_order:{order.id}:inc:{item.id}",
                )
                item.picked_quantity = pick_qty
                item.status = "picked" if pick_qty >= item.required_quantity else "pending"
                if batch_no:
                    item.batch_no = batch_no
                await item.save()
                picked_this_round += 1

            if use_selective_confirm and picked_this_round == 0:
                raise ValidationError("请至少选择一项进行备料")

            all_picked = all(
                i.status == "picked"
                for i in await BatchingOrderItem.filter(
                    batching_order_id=order_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
            )
            order.status = "completed" if all_picked else "picking"
            order.executed_by = executed_by
            order.executed_by_name = user_info["name"]
            order.executed_at = executed_at
            order.updated_by = executed_by
            order.updated_by_name = user_info["name"]
            await order.save()

            return BatchingOrderResponse.model_validate(order)

    async def delete_batching_order(self, tenant_id: int, order_id: int) -> bool:
        order = await BatchingOrder.get_or_none(
            id=order_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not order:
            raise NotFoundError(f"线边备料单不存在: {order_id}")
        if order.status != "draft":
            raise ValidationError(f"线边备料单状态为 {order.status}，不能删除")

        now = datetime.now()
        await BatchingOrder.filter(id=order_id, tenant_id=tenant_id).update(deleted_at=now)
        await BatchingOrderItem.filter(batching_order_id=order_id, tenant_id=tenant_id).update(deleted_at=now)
        return True
