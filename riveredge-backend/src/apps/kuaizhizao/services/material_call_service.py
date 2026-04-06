"""
叫料请求服务模块

单头 + 明细行；整单叫料为一张单多行，单独叫料为自选多物料多行。
"""

import uuid
from typing import List, Optional, Tuple
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction
from loguru import logger

from apps.base_service import AppBaseService
from infra.models.user import User
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.models.material_call_request_item import MaterialCallRequestItem
from apps.kuaizhizao.schemas.material_call import (
    MaterialCallLineCreate,
    MaterialCallRequestCreate,
    MaterialCallRequestUpdate,
    MaterialCallRequestResponse,
    MaterialCallLineResponse,
)
from core.timezone_utils import now_utc
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService


def _user_display_name(user: User) -> str:
    fn = user.full_name
    if fn and str(fn).strip():
        return str(fn).strip()
    return user.username


def _normalize_call_type(ct: Optional[str]) -> str:
    t = (ct or "CUSTOM_SELECTION").strip()
    if t == "SINGLE_MATERIAL":
        return "CUSTOM_SELECTION"
    return t


def _is_custom_like(call_type: str) -> bool:
    return _normalize_call_type(call_type) == "CUSTOM_SELECTION"


class MaterialCallService(AppBaseService[MaterialCallRequest]):
    """叫料请求服务类"""

    def __init__(self):
        super().__init__(MaterialCallRequest)

    def _next_material_call_code(self) -> str:
        return f"MC{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    async def _sync_header_from_items(self, tenant_id: int, request_id: int) -> None:
        items = await MaterialCallRequestItem.filter(
            tenant_id=tenant_id, request_id=request_id
        ).order_by("line_no", "id").all()
        rq = sum((i.requested_quantity or Decimal("0") for i in items), start=Decimal("0"))
        dq = sum((i.delivered_quantity or Decimal("0") for i in items), start=Decimal("0"))
        header = await MaterialCallRequest.get(id=request_id, tenant_id=tenant_id)
        header.requested_quantity = rq
        header.delivered_quantity = dq
        if len(items) == 1:
            header.material_id = items[0].material_id
            header.material_code = items[0].material_code
            header.material_name = items[0].material_name
            header.material_unit = items[0].material_unit
        elif len(items) > 1:
            header.material_id = None
            header.material_code = None
            header.material_name = f"共{len(items)}项物料"
            header.material_unit = None
        else:
            header.material_id = None
            header.material_code = None
            header.material_name = None
            header.material_unit = None
        await header.save()

    async def _build_response(
        self, header: MaterialCallRequest, items: Optional[List[MaterialCallRequestItem]] = None
    ) -> MaterialCallRequestResponse:
        if items is None:
            items = await MaterialCallRequestItem.filter(
                tenant_id=header.tenant_id, request_id=header.id
            ).order_by("line_no", "id").all()
        line_res = [MaterialCallLineResponse.model_validate(i) for i in items]
        return MaterialCallRequestResponse(
            id=header.id,
            code=header.code,
            work_order_id=header.work_order_id,
            work_order_code=header.work_order_code,
            material_id=header.material_id,
            material_code=header.material_code,
            material_name=header.material_name,
            material_unit=header.material_unit,
            requested_quantity=header.requested_quantity or Decimal("0"),
            delivered_quantity=header.delivered_quantity or Decimal("0"),
            call_type=header.call_type,
            call_reason=header.call_reason,
            source_warehouse_id=header.source_warehouse_id,
            target_warehouse_id=header.target_warehouse_id,
            production_picking_id=getattr(header, "production_picking_id", None),
            priority=header.priority,
            needed_at=header.needed_at,
            remarks=header.remarks,
            status=header.status,
            caller_id=header.caller_id,
            caller_name=header.caller_name,
            handler_id=header.handler_id,
            handler_name=header.handler_name,
            completed_at=header.completed_at,
            created_at=header.created_at,
            updated_at=header.updated_at,
            items=line_res,
        )

    async def _apply_delivered_proportional(
        self, tenant_id: int, request_id: int, total_delivered: Decimal
    ) -> None:
        items = await MaterialCallRequestItem.filter(
            tenant_id=tenant_id, request_id=request_id
        ).order_by("line_no", "id").all()
        if not items:
            return
        total_req = sum((i.requested_quantity or Decimal("0") for i in items), start=Decimal("0"))
        if total_req <= 0:
            return
        td = max(Decimal("0"), total_delivered)
        if td >= total_req:
            for i in items:
                i.delivered_quantity = i.requested_quantity or Decimal("0")
                await i.save()
            return
        remaining = td
        n = len(items)
        for idx, i in enumerate(items):
            req = i.requested_quantity or Decimal("0")
            if idx == n - 1:
                alloc = min(req, max(Decimal("0"), remaining))
            else:
                ratio = req / total_req
                alloc = (td * ratio).quantize(Decimal("0.0001"))
                alloc = min(alloc, req, remaining)
            i.delivered_quantity = alloc
            remaining -= alloc
            await i.save()

    async def create_call_request(
        self,
        tenant_id: int,
        create_data: MaterialCallRequestCreate,
        user: User,
    ) -> MaterialCallRequestResponse:
        """发起叫料（单头 + 明细）"""
        norm_ct = _normalize_call_type(create_data.call_type)
        if _is_custom_like(norm_ct):
            reason = (create_data.call_reason or "").strip()
            if not reason:
                raise ValidationError("单独叫料须选择叫料原因")
        if norm_ct == "FULL_ORDER" and len(create_data.items) < 1:
            raise ValidationError("叫料明细不能为空")
        for line in create_data.items:
            if line.requested_quantity is None or line.requested_quantity <= Decimal("0"):
                raise ValidationError("各明细需求数量须大于 0")

        async with in_transaction():
            code = self._next_material_call_code()
            call_req = await MaterialCallRequest.create(
                tenant_id=tenant_id,
                code=code,
                caller_id=user.id,
                caller_name=_user_display_name(user),
                work_order_id=create_data.work_order_id,
                work_order_code=create_data.work_order_code,
                call_type=norm_ct,
                call_reason=create_data.call_reason,
                source_warehouse_id=create_data.source_warehouse_id,
                target_warehouse_id=create_data.target_warehouse_id,
                priority=create_data.priority,
                needed_at=create_data.needed_at,
                remarks=create_data.remarks,
                material_id=None,
                material_code=None,
                material_name=None,
                material_unit=None,
                requested_quantity=Decimal("0"),
                delivered_quantity=Decimal("0"),
                status="pending",
            )
            for idx, line in enumerate(create_data.items, start=1):
                await MaterialCallRequestItem.create(
                    tenant_id=tenant_id,
                    request_id=call_req.id,
                    line_no=idx,
                    material_id=line.material_id,
                    material_code=(line.material_code or "").strip() or str(line.material_id),
                    material_name=(line.material_name or "").strip() or "—",
                    material_unit=line.material_unit,
                    requested_quantity=line.requested_quantity,
                    delivered_quantity=Decimal("0"),
                )
            await self._sync_header_from_items(tenant_id, call_req.id)
            call_req = await MaterialCallRequest.get(id=call_req.id, tenant_id=tenant_id)
            return await self._build_response(call_req)

    async def batch_create_from_work_order_kitting(
        self,
        tenant_id: int,
        work_order_id: int,
        user: User,
    ) -> MaterialCallRequestResponse:
        """
        整单叫料：按工单齐套分析，对 shortage_quantity > 0 的物料生成 **一张** 叫料单、多行明细。
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        analysis = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order_id)
        lines: List[MaterialCallLineCreate] = []
        for item in analysis.items:
            shortage = item.shortage_quantity
            if shortage is None or shortage <= Decimal("0"):
                continue
            lines.append(
                MaterialCallLineCreate(
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_unit=item.material_unit,
                    requested_quantity=shortage,
                )
            )
        if not lines:
            raise ValidationError("当前工单齐套分析无缺料行，无需整单叫料")
        create_data = MaterialCallRequestCreate(
            work_order_id=analysis.work_order_id,
            work_order_code=analysis.work_order_code,
            items=lines,
            call_type="FULL_ORDER",
            call_reason=None,
            priority="normal",
            remarks="工单整单叫料（按 BOM 齐套缺料）",
        )
        return await self.create_call_request(tenant_id, create_data, user)

    async def list_call_requests(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        work_order_id: Optional[int] = None,
        material_id: Optional[int] = None,
    ) -> List[MaterialCallRequestResponse]:
        """查询叫料请求列表（含明细）"""
        query = MaterialCallRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)

        if status:
            query = query.filter(status=status)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if material_id:
            req_ids = await MaterialCallRequestItem.filter(
                tenant_id=tenant_id, material_id=material_id
            ).values_list("request_id", flat=True)
            id_list = list({int(x) for x in req_ids})
            if not id_list:
                return []
            query = query.filter(id__in=id_list)

        requests = await query.offset(skip).limit(limit).order_by("-created_at").all()
        if not requests:
            return []
        ids = [r.id for r in requests]
        all_items = (
            await MaterialCallRequestItem.filter(tenant_id=tenant_id, request_id__in=ids)
            .order_by("line_no", "id")
            .all()
        )
        by_req: dict[int, List[MaterialCallRequestItem]] = {}
        for it in all_items:
            by_req.setdefault(it.request_id, []).append(it)
        out: List[MaterialCallRequestResponse] = []
        for r in requests:
            out.append(await self._build_response(r, by_req.get(r.id, [])))
        return out

    async def _resolve_warehouses_for_material_call(
        self, tenant_id: int, call_req: MaterialCallRequest, wo
    ) -> Tuple[int, str, int, str]:
        """解析主仓（扣减）与线边仓（增存）；优先叫料单显式字段，其次车间/工作中心关联。"""
        from apps.master_data.models.warehouse import Warehouse

        src_id = call_req.source_warehouse_id
        src_name = ""
        if src_id:
            wh = await Warehouse.get_or_none(id=src_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if wh:
                src_name = wh.name or ""
            else:
                src_id = None
        if not src_id:
            qn = Warehouse.filter(
                tenant_id=tenant_id, is_active=True, deleted_at__isnull=True, warehouse_type="normal"
            )
            wh = None
            if wo and getattr(wo, "workshop_id", None):
                wh = await qn.filter(workshop_id=wo.workshop_id).order_by("id").first()
            if not wh:
                wh = await qn.order_by("id").first()
            if not wh:
                wh = (
                    await Warehouse.filter(
                        tenant_id=tenant_id,
                        is_active=True,
                        deleted_at__isnull=True,
                        warehouse_type__in=["normal", "wip"],
                    )
                    .order_by("id")
                    .first()
                )
            if wh:
                src_id, src_name = wh.id, wh.name or ""
        if not src_id:
            raise BusinessLogicError(
                "叫料过账需要来源仓库：请在叫料单指定 source_warehouse_id，或维护普通仓"
            )

        tgt_id = call_req.target_warehouse_id
        tgt_name = ""
        if tgt_id:
            wh = await Warehouse.get_or_none(id=tgt_id, tenant_id=tenant_id, deleted_at__isnull=True)
            if wh:
                tgt_name = wh.name or ""
            else:
                tgt_id = None
        if not tgt_id:
            ql = Warehouse.filter(
                tenant_id=tenant_id, is_active=True, deleted_at__isnull=True, warehouse_type="line_side"
            )
            wh = None
            if wo and getattr(wo, "work_center_id", None):
                wh = await ql.filter(work_center_id=wo.work_center_id).order_by("id").first()
            if not wh and wo and getattr(wo, "workshop_id", None):
                wh = await ql.filter(workshop_id=wo.workshop_id).order_by("id").first()
            if not wh:
                wh = await ql.order_by("id").first()
            if wh:
                tgt_id, tgt_name = wh.id, wh.name or ""
        if not tgt_id:
            raise BusinessLogicError(
                "叫料过账需要线边仓：请指定 target_warehouse_id，或维护 warehouse_type=line_side 的仓库"
            )
        if int(src_id) == int(tgt_id):
            raise BusinessLogicError("来源仓库与线边仓不能相同")
        return int(src_id), src_name, int(tgt_id), tgt_name

    async def _create_picking_and_line_side_transfer_for_completed_call(
        self,
        tenant_id: int,
        call_req: MaterialCallRequest,
        user: User,
    ) -> None:
        """
        叫料标记完成后：生成已确认的生产领料单，主仓扣减 + 线边仓增加（与配料业务一致）。
        """
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.production_picking import ProductionPicking
        from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
        from apps.kuaizhizao.services.inventory_service import InventoryService

        if getattr(call_req, "production_picking_id", None):
            return

        items = await MaterialCallRequestItem.filter(
            tenant_id=tenant_id, request_id=call_req.id
        ).order_by("line_no", "id").all()
        lines_to_move: List[Tuple[MaterialCallRequestItem, Decimal]] = []
        for i in items:
            dq = i.delivered_quantity or Decimal("0")
            if dq > 0:
                lines_to_move.append((i, dq))
        if not lines_to_move:
            logger.warning("叫料单 {} 已完成但明细送达数量均为 0，跳过领料过账", call_req.code)
            return

        wo = await WorkOrder.get_or_none(
            tenant_id=tenant_id, id=call_req.work_order_id, deleted_at__isnull=True
        )
        if not wo:
            raise BusinessLogicError(f"工单不存在，无法生成领料单: {call_req.work_order_id}")

        src_wh_id, src_wh_name, tgt_wh_id, tgt_wh_name = await self._resolve_warehouses_for_material_call(
            tenant_id, call_req, wo
        )

        biz_config = await BusinessConfigService().get_business_config(tenant_id)
        enforce_fifo = bool(biz_config.get("parameters", {}).get("warehouse", {}).get("fifo", False))

        today = datetime.now().strftime("%Y%m%d")
        picking_code = await self.generate_code(tenant_id, "PRODUCTION_PICKING_CODE", prefix=f"PP{today}")
        picker_name = _user_display_name(user)

        picking = await ProductionPicking.create(
            tenant_id=tenant_id,
            picking_code=picking_code,
            work_order_id=wo.id,
            work_order_code=wo.code,
            workshop_id=getattr(wo, "workshop_id", None),
            workshop_name=getattr(wo, "workshop_name", None),
            status="已领料",
            picker_id=user.id,
            picker_name=picker_name,
            picking_time=datetime.now(),
            created_by=user.id,
            updated_by=user.id,
            notes=f"由叫料单 {call_req.code} 完成自动生成（主仓→线边）",
        )

        for it, dq in lines_to_move:
            unit = it.material_unit or ""
            await ProductionPickingItem.create(
                tenant_id=tenant_id,
                picking_id=picking.id,
                material_id=it.material_id,
                material_code=it.material_code or "",
                material_name=it.material_name or "",
                material_spec=None,
                material_unit=unit,
                required_quantity=dq,
                picked_quantity=dq,
                remaining_quantity=Decimal("0"),
                warehouse_id=src_wh_id,
                warehouse_name=src_wh_name or "",
                status="已领料",
                picking_time=datetime.now(),
            )
            await InventoryService.decrease_stock(
                tenant_id=tenant_id,
                material_id=it.material_id,
                quantity=Decimal(str(dq)),
                warehouse_id=src_wh_id,
                batch_no=None,
                source_type="production_picking",
                source_doc_id=picking.id,
                source_doc_code=picking.picking_code,
                enforce_fifo=enforce_fifo,
            )
            await InventoryService.increase_stock(
                tenant_id=tenant_id,
                material_id=it.material_id,
                quantity=Decimal(str(dq)),
                warehouse_id=tgt_wh_id,
                batch_no=None,
                source_type="production_picking",
                source_doc_id=picking.id,
                source_doc_code=picking.picking_code,
            )

        call_req.production_picking_id = picking.id
        await call_req.save()

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="work_order",
                    source_id=wo.id,
                    source_code=wo.code,
                    source_name=getattr(wo, "name", None),
                    target_type="production_picking",
                    target_id=picking.id,
                    target_code=picking.picking_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc=f"叫料单 {call_req.code} 完成生成生产领料",
                ),
                created_by=user.id,
            )
        except Exception as e:
            logger.warning("建立工单→生产领料关联失败: {}", e)

        try:
            from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
            from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

            rel_svc = DocumentRelationNewService()
            await rel_svc.create_relation(
                tenant_id=tenant_id,
                relation_data=DocumentRelationCreate(
                    source_type="material_call_request",
                    source_id=call_req.id,
                    source_code=call_req.code,
                    source_name=call_req.work_order_code,
                    target_type="production_picking",
                    target_id=picking.id,
                    target_code=picking.picking_code,
                    target_name=None,
                    relation_type="source",
                    relation_mode="push",
                    relation_desc="叫料完成生成生产领料出库",
                ),
                created_by=user.id,
            )
        except Exception as e:
            logger.warning("建立叫料→生产领料关联失败: {}", e)

    async def update_call_request(
        self,
        tenant_id: int,
        call_id: int,
        update_data: MaterialCallRequestUpdate,
        user: User,
    ) -> MaterialCallRequestResponse:
        """更新叫料请求（处理状态/送达数量等）"""
        async with in_transaction():
            call_req = await MaterialCallRequest.get_or_none(tenant_id=tenant_id, id=call_id)
            if not call_req:
                raise NotFoundError(f"叫料请求不存在: {call_id}")

            existing_picking_id = getattr(call_req, "production_picking_id", None)

            data = update_data.model_dump(exclude_unset=True)

            becoming_completed = (
                data.get("status") == "completed" and call_req.status != "completed"
            )
            if becoming_completed:
                items = await MaterialCallRequestItem.filter(
                    tenant_id=tenant_id, request_id=call_id
                ).all()
                for i in items:
                    i.delivered_quantity = i.requested_quantity or Decimal("0")
                    await i.save()
                total_d = sum(
                    (i.delivered_quantity or Decimal("0") for i in items), start=Decimal("0")
                )
                data["delivered_quantity"] = total_d
                data["completed_at"] = now_utc()
                if not data.get("handler_id"):
                    data["handler_id"] = user.id
                    data["handler_name"] = _user_display_name(user)
            elif "delivered_quantity" in data and data["delivered_quantity"] is not None:
                await self._apply_delivered_proportional(
                    tenant_id, call_id, Decimal(str(data["delivered_quantity"]))
                )
                await self._sync_header_from_items(tenant_id, call_id)
                data.pop("delivered_quantity", None)

            if data.get("status") == "processing" and call_req.status == "pending":
                data["handler_id"] = user.id
                data["handler_name"] = _user_display_name(user)

            for key, value in data.items():
                setattr(call_req, key, value)

            await call_req.save()
            await self._sync_header_from_items(tenant_id, call_id)
            call_req = await MaterialCallRequest.get(id=call_id, tenant_id=tenant_id)

            if call_req.status == "completed" and not existing_picking_id:
                await self._create_picking_and_line_side_transfer_for_completed_call(
                    tenant_id, call_req, user
                )
                call_req = await MaterialCallRequest.get(id=call_id, tenant_id=tenant_id)

            return await self._build_response(call_req)

    async def cancel_call_request(
        self,
        tenant_id: int,
        call_id: int,
        updated_by: int,
    ) -> bool:
        """生产端撤回：仅待处理且各明细尚无送达"""
        call_req = await MaterialCallRequest.get_or_none(tenant_id=tenant_id, id=call_id)
        if not call_req:
            raise NotFoundError(f"叫料请求不存在: {call_id}")

        if call_req.status != "pending":
            raise BusinessLogicError(
                f"仅「待处理」状态的叫料可申请撤回，当前状态：{call_req.status}"
            )
        items = await MaterialCallRequestItem.filter(tenant_id=tenant_id, request_id=call_id).all()
        delivered = sum((i.delivered_quantity or Decimal("0") for i in items), start=Decimal("0"))
        if delivered > Decimal("0"):
            raise BusinessLogicError("已有送达数量，无法撤回叫料申请")

        call_req.status = "cancelled"
        call_req.updated_by = updated_by
        await call_req.save()
        return True
