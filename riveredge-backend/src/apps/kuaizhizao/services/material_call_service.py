"""
叫料请求服务模块

单头 + 明细行；整单叫料为一张单多行，单独叫料为自选多物料多行。
"""

import uuid
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

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
