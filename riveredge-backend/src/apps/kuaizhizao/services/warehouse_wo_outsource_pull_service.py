"""工单/委外开口行取单：列表与按行建单。"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.production_return_item import ProductionReturnItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.warehouse import ProductionReturnCreate, ProductionReturnItemCreate
from apps.master_data.services.material_service import resolve_primary_default_warehouse_from_material
from core.utils.timezone_utils import resolve_business_datetime

_LINE_ID_BASE = 1_000_000_000
_CANCELLED_RETURN_STATUSES = frozenset({"已作废", "已取消", "cancelled", "void"})


def encode_header_material_id(header_id: int, material_id: int) -> int:
    if header_id <= 0 or material_id <= 0:
        raise ValidationError("来源单或物料无效")
    if header_id >= _LINE_ID_BASE or material_id >= _LINE_ID_BASE:
        raise ValidationError("来源单或物料 ID 超出开口行编码范围")
    return int(header_id) * _LINE_ID_BASE + int(material_id)


def decode_header_material_id(line_id: int) -> Tuple[int, int]:
    hid, mid = divmod(int(line_id), _LINE_ID_BASE)
    if hid <= 0 or mid <= 0:
        raise ValidationError("开口行 ID 无效")
    return hid, mid


def _match_material_keyword(keyword: Optional[str], *parts: Any) -> bool:
    kw = (keyword or "").strip().lower()
    if not kw:
        return True
    haystack = " ".join(str(p or "").strip() for p in parts).lower()
    return kw in haystack


def _page(lines: List[Dict[str, Any]], skip: int, limit: int) -> Dict[str, Any]:
    return {"data": lines[skip : skip + limit], "total": len(lines)}


async def _resolve_material_warehouse(tenant_id: int, material_id: int, label: str) -> Tuple[int, str]:
    material_wh = await resolve_primary_default_warehouse_from_material(
        tenant_id, material_id=int(material_id)
    )
    if not material_wh or not material_wh[0]:
        raise ValidationError(f"请为物料 {label} 维护默认仓库")
    wh_id, wh_name = int(material_wh[0]), str(material_wh[1] or "").strip()
    if not wh_name:
        from apps.kuaizhizao.services.warehouse_service import _resolve_warehouse_name_by_id

        wh_name = await _resolve_warehouse_name_by_id(tenant_id, wh_id)
    if not wh_name:
        raise ValidationError(f"物料 {label} 的默认仓库名称缺失")
    return wh_id, wh_name


class WarehouseWoOutsourcePullService:
    async def list_work_order_finished_goods_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        work_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            derive_work_order_capabilities,
        )
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
        from apps.master_data.models.material import Material

        query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if work_order_id is not None:
            query = query.filter(id=int(work_order_id))
        orders = await query.only(
            "id", "code", "status", "is_frozen", "product_id", "product_code",
            "product_name", "product_spec", "quantity",
        )
        if not orders:
            return {"data": [], "total": 0}
        fg_svc = FinishedGoodsReceiptService()
        material_ids = [int(o.product_id) for o in orders if o.product_id]
        mats = await Material.filter(
            tenant_id=tenant_id, id__in=list(set(material_ids)), deleted_at__isnull=True
        ).all() if material_ids else []
        mat_by_id = {int(m.id): m for m in mats}
        lines: List[Dict[str, Any]] = []
        for wo in orders:
            caps = derive_work_order_capabilities(wo)
            can_push = bool(caps.push_finished_goods_receipt.allowed)
            quota = await fg_svc._get_work_order_inbound_quota(tenant_id, int(wo.id))
            planned = float(wo.quantity or 0)
            received = float(quota.get("received") or 0)
            remaining = float(quota.get("pending") or 0)
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            material = mat_by_id.get(int(wo.product_id or 0))
            material_code = str(
                (getattr(material, "main_code", None) or getattr(material, "code", None) or wo.product_code or "")
            ).strip()
            material_name = str((getattr(material, "name", None) or wo.product_name or "")).strip()
            material_spec = str(
                getattr(material, "specification", None) or getattr(wo, "product_spec", None) or ""
            ).strip()
            if not _match_material_keyword(keyword, material_code, material_name, material_spec):
                continue
            lines.append(
                {
                    "id": int(wo.id),
                    "work_order_id": int(wo.id),
                    "work_order_code": wo.code,
                    "material_id": wo.product_id,
                    "material_code": material_code,
                    "material_name": material_name,
                    "material_spec": material_spec or None,
                    "unit": (getattr(material, "base_unit", None) or "个") if material else "个",
                    "suggested_quantity": planned,
                    "pushed_quantity": received,
                    "remaining_quantity": remaining,
                }
            )
        lines.sort(key=lambda r: (str(r.get("work_order_code") or ""), int(r.get("id") or 0)))
        return _page(lines, skip, limit)

    async def create_finished_goods_from_work_orders(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )
        from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可入库工单成品行")
        orders = await WorkOrder.filter(
            tenant_id=tenant_id, id__in=selected, deleted_at__isnull=True
        ).all()
        if len(orders) != len(set(selected)):
            raise NotFoundError("工单不存在")
        fg_svc = FinishedGoodsReceiptService()
        created: List[Dict[str, Any]] = []
        for wo in orders:
            assert_work_order_capability(wo, "push_finished_goods_receipt")
            if not wo.product_id:
                raise ValidationError(f"工单 {wo.code} 未维护产品，无法入库")
            wh_id, wh_name = await _resolve_material_warehouse(
                tenant_id, int(wo.product_id), str(wo.product_code or wo.product_name or wo.code)
            )
            receipt = await fg_svc.quick_receipt_from_work_order(
                tenant_id=tenant_id,
                work_order_id=int(wo.id),
                created_by=created_by,
                warehouse_id=wh_id,
                warehouse_name=wh_name,
            )
            created.append(
                {
                    "receipt_id": receipt.id,
                    "receipt_code": receipt.receipt_code,
                    "work_order_id": int(wo.id),
                    "work_order_code": wo.code,
                }
            )
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张成品入库单"
            if len(created) > 1
            else "成品入库单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "receipt_id": first["receipt_id"],
            "receipt_code": first["receipt_code"],
            "receipts": created,
        }

    async def list_production_return_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        work_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            derive_work_order_capabilities,
        )
        from apps.kuaizhizao.services.warehouse_service import (
            PRODUCTION_RETURN_PICKING_ELIGIBLE_STATUSES,
        )

        wo_query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if work_order_id is not None:
            wo_query = wo_query.filter(id=int(work_order_id))
        orders = await wo_query.only("id", "code", "status", "is_frozen")
        order_by_id = {int(o.id): o for o in orders}
        if not order_by_id:
            return {"data": [], "total": 0}
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id__in=list(order_by_id.keys()),
            status__in=list(PRODUCTION_RETURN_PICKING_ELIGIBLE_STATUSES),
            deleted_at__isnull=True,
        ).all()
        if not pickings:
            return {"data": [], "total": 0}
        picking_by_id = {int(p.id): p for p in pickings}
        items = await ProductionPickingItem.filter(
            tenant_id=tenant_id,
            picking_id__in=list(picking_by_id.keys()),
            picked_quantity__gt=0,
            deleted_at__isnull=True,
        ).all()
        occupied = await self._occupied_return_qty_by_picking_item(
            tenant_id, [int(i.id) for i in items if i.id]
        )
        lines: List[Dict[str, Any]] = []
        for item in items:
            picking = picking_by_id.get(int(item.picking_id))
            wo = order_by_id.get(int(picking.work_order_id)) if picking else None
            if not picking or not wo:
                continue
            can_push = bool(derive_work_order_capabilities(wo, has_returnable_picking=True).push_production_return.allowed)
            picked = float(item.picked_quantity or 0)
            used = float(occupied.get(int(item.id), 0))
            remaining = max(0.0, picked - used)
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            if not _match_material_keyword(keyword, item.material_code, item.material_name, item.material_spec):
                continue
            lines.append(
                {
                    "id": int(item.id),
                    "work_order_id": int(wo.id),
                    "work_order_code": wo.code,
                    "picking_id": int(picking.id),
                    "picking_code": picking.picking_code,
                    "material_id": item.material_id,
                    "material_code": item.material_code,
                    "material_name": item.material_name,
                    "material_spec": item.material_spec,
                    "unit": item.material_unit or "个",
                    "suggested_quantity": picked,
                    "pushed_quantity": used,
                    "remaining_quantity": remaining,
                }
            )
        lines.sort(
            key=lambda r: (
                str(r.get("work_order_code") or ""),
                str(r.get("picking_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return _page(lines, skip, limit)

    async def _occupied_return_qty_by_picking_item(
        self,
        tenant_id: int,
        picking_item_ids: List[int],
    ) -> Dict[int, float]:
        if not picking_item_ids:
            return {}
        return_ids = await ProductionReturn.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(status__in=list(_CANCELLED_RETURN_STATUSES)).values_list("id", flat=True)
        if not return_ids:
            return {}
        rows = await ProductionReturnItem.filter(
            tenant_id=tenant_id,
            return_id__in=list(return_ids),
            picking_item_id__in=picking_item_ids,
        ).values_list("picking_item_id", "return_quantity")
        totals: Dict[int, float] = {}
        for item_id, qty in rows:
            if item_id is None:
                continue
            totals[int(item_id)] = totals.get(int(item_id), 0.0) + float(qty or 0)
        return totals

    async def create_production_returns_from_picking_items(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            assert_work_order_capability,
        )
        from apps.kuaizhizao.services.warehouse_service import ProductionReturnService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可退料明细")
        items = await ProductionPickingItem.filter(
            tenant_id=tenant_id, id__in=selected, deleted_at__isnull=True
        ).all()
        if not items:
            raise BusinessLogicError("没有可退料的领料明细")
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            id__in=list({int(i.picking_id) for i in items}),
            deleted_at__isnull=True,
        ).all()
        picking_by_id = {int(p.id): p for p in pickings}
        wo_ids = sorted({int(p.work_order_id) for p in pickings})
        orders = await WorkOrder.filter(
            tenant_id=tenant_id, id__in=wo_ids, deleted_at__isnull=True
        ).all()
        order_by_id = {int(o.id): o for o in orders}
        if len(order_by_id) != len(wo_ids):
            raise NotFoundError("工单不存在")
        occupied = await self._occupied_return_qty_by_picking_item(tenant_id, selected)
        return_svc = ProductionReturnService()
        returnable_map = await return_svc.batch_work_orders_have_returnable_picking(tenant_id, wo_ids)
        for wo in orders:
            assert_work_order_capability(
                wo,
                "push_production_return",
                has_returnable_picking=returnable_map.get(int(wo.id), False),
            )

        groups: Dict[Tuple[int, int], List[ProductionPickingItem]] = defaultdict(list)
        for item in items:
            picking = picking_by_id.get(int(item.picking_id))
            if not picking:
                raise NotFoundError(f"领料单不存在: {item.picking_id}")
            remaining = max(0.0, float(item.picked_quantity or 0) - float(occupied.get(int(item.id), 0)))
            if remaining <= 0:
                raise BusinessLogicError(
                    f"物料 {item.material_code or item.material_name} 已无剩余可退数量"
                )
            groups[(int(picking.work_order_id), int(picking.id))].append(item)

        created: List[Dict[str, Any]] = []
        now = resolve_business_datetime()
        for (wo_id, picking_id), group_items in groups.items():
            wo = order_by_id[wo_id]
            picking = picking_by_id[picking_id]
            first_item = group_items[0]
            wh_id = int(first_item.warehouse_id or 0)
            wh_name = str(first_item.warehouse_name or "").strip()
            if wh_id <= 0:
                wh_id, wh_name = await _resolve_material_warehouse(
                    tenant_id,
                    int(first_item.material_id),
                    str(first_item.material_code or first_item.material_name),
                )
            return_items: List[ProductionReturnItemCreate] = []
            for item in group_items:
                qty = max(0.0, float(item.picked_quantity or 0) - float(occupied.get(int(item.id), 0)))
                if qty <= 0:
                    continue
                line_wh_id = int(item.warehouse_id or wh_id)
                line_wh_name = str(item.warehouse_name or wh_name)
                if line_wh_id <= 0:
                    line_wh_id, line_wh_name = await _resolve_material_warehouse(
                        tenant_id,
                        int(item.material_id),
                        str(item.material_code or item.material_name),
                    )
                return_items.append(
                    ProductionReturnItemCreate(
                        picking_item_id=int(item.id),
                        material_id=int(item.material_id),
                        material_code=str(item.material_code or ""),
                        material_name=str(item.material_name or ""),
                        material_spec=item.material_spec,
                        material_unit=str(item.material_unit or "个"),
                        return_quantity=qty,
                        warehouse_id=line_wh_id,
                        warehouse_name=line_wh_name,
                    )
                )
            if not return_items:
                raise BusinessLogicError("所选明细无法生成生产退料单")
            created_ret = await return_svc.create_production_return(
                tenant_id,
                ProductionReturnCreate(
                    work_order_id=wo_id,
                    work_order_code=str(wo.code or ""),
                    picking_id=picking_id,
                    picking_code=str(picking.picking_code or ""),
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                    return_time=now,
                    items=return_items,
                ),
                created_by,
            )
            created.append(
                {
                    "return_id": created_ret.id,
                    "return_code": created_ret.return_code,
                    "work_order_id": wo_id,
                    "work_order_code": wo.code,
                }
            )
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张生产退料单"
            if len(created) > 1
            else "生产退料单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "return_id": first["return_id"],
            "return_code": first["return_code"],
            "returns": created,
        }

    async def list_work_order_picking_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        work_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.document_action_policy.work_order import (
            derive_work_order_capabilities,
        )
        from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

        query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if work_order_id is not None:
            query = query.filter(id=int(work_order_id))
        orders = await query.all()
        if not orders:
            return {"data": [], "total": 0}
        pick_svc = ProductionPickingService()
        lines: List[Dict[str, Any]] = []
        for wo in orders:
            caps = derive_work_order_capabilities(wo)
            can_push = bool(caps.push_production_picking.allowed)
            if pullable_only and not can_push:
                continue
            try:
                preview = await pick_svc.preview_push_work_order_to_production_picking(tenant_id, int(wo.id))
            except (BusinessLogicError, NotFoundError, ValidationError):
                if pullable_only:
                    continue
                preview = {"items": [], "has_blocking_issues": True}
            for row in preview.get("items") or []:
                remaining = float(row.get("max_push_quantity") or 0)
                selectable = can_push and remaining > 0 and not preview.get("has_blocking_issues")
                if pullable_only and not selectable:
                    continue
                material_code = str(row.get("material_code") or "")
                material_name = str(row.get("material_name") or "")
                if not _match_material_keyword(keyword, material_code, material_name):
                    continue
                material_id = int(row.get("item_id") or 0)
                if material_id <= 0:
                    continue
                lines.append(
                    {
                        "id": encode_header_material_id(int(wo.id), material_id),
                        "work_order_id": int(wo.id),
                        "work_order_code": wo.code,
                        "material_id": material_id,
                        "material_code": material_code,
                        "material_name": material_name,
                        "material_spec": None,
                        "unit": str(row.get("material_unit") or "个"),
                        "suggested_quantity": float(row.get("quantity") or 0),
                        "pushed_quantity": float(row.get("pushed_quantity") or 0),
                        "remaining_quantity": remaining,
                    }
                )
        lines.sort(
            key=lambda r: (
                str(r.get("work_order_code") or ""),
                str(r.get("material_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return _page(lines, skip, limit)

    async def create_production_pickings_from_lines(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可领料明细")
        grouped: Dict[int, List[int]] = defaultdict(list)
        for line_id in selected:
            wo_id, material_id = decode_header_material_id(line_id)
            grouped[wo_id].append(material_id)
        pick_svc = ProductionPickingService()
        created: List[Dict[str, Any]] = []
        for wo_id, material_ids in grouped.items():
            preview = await pick_svc.preview_push_work_order_to_production_picking(tenant_id, wo_id)
            if preview.get("has_blocking_issues"):
                raise BusinessLogicError(str(preview.get("blocking_reason") or "当前工单不可下推生产领料"))
            by_material = {int(r["item_id"]): r for r in (preview.get("items") or [])}
            lines: List[Dict[str, Any]] = []
            for material_id in material_ids:
                row = by_material.get(int(material_id))
                if not row:
                    raise BusinessLogicError(f"物料 {material_id} 不在工单可领料范围内")
                qty = float(row.get("max_push_quantity") or 0)
                if qty <= 0:
                    raise BusinessLogicError(
                        f"物料 {row.get('material_code') or material_id} 已无剩余可领数量"
                    )
                label = str(row.get("material_code") or row.get("material_name") or material_id)
                wh_id, wh_name = await _resolve_material_warehouse(tenant_id, int(material_id), label)
                lines.append(
                    {
                        "material_id": int(material_id),
                        "material_code": str(row.get("material_code") or ""),
                        "material_name": str(row.get("material_name") or ""),
                        "material_unit": str(row.get("material_unit") or "个"),
                        "issue_quantity": qty,
                        "warehouse_id": wh_id,
                        "warehouse_name": wh_name,
                    }
                )
            picking = await pick_svc.create_production_picking_from_work_order_pull(
                tenant_id=tenant_id,
                created_by=created_by,
                work_order_id=wo_id,
                lines=lines,
            )
            created.append(
                {
                    "picking_id": picking.id,
                    "picking_code": picking.picking_code,
                    "work_order_id": wo_id,
                }
            )
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张生产领料单"
            if len(created) > 1
            else "生产领料单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "picking_id": first["picking_id"],
            "picking_code": first["picking_code"],
            "pickings": created,
        }

    async def list_outsource_issue_pull_lines(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        outsource_work_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            derive_outsource_work_order_capabilities,
        )
        from apps.kuaizhizao.services.outsource_material_issue_service import OutsourceMaterialIssueService

        query = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id is not None:
            query = query.filter(id=int(outsource_work_order_id))
        orders = await query.all()
        if not orders:
            return {"data": [], "total": 0}
        issue_svc = OutsourceMaterialIssueService()
        lines: List[Dict[str, Any]] = []
        for owo in orders:
            caps = derive_outsource_work_order_capabilities(owo)
            can_push = bool(caps.push_outsource_issue.allowed)
            if pullable_only and not can_push:
                continue
            try:
                preview = await issue_svc.get_issue_preview(tenant_id, int(owo.id))
            except (BusinessLogicError, NotFoundError, ValidationError):
                if pullable_only:
                    continue
                preview = type("P", (), {"lines": []})()
            for row in preview.lines or []:
                remaining = float(row.pending_quantity or 0)
                selectable = can_push and remaining > 0
                if pullable_only and not selectable:
                    continue
                if not _match_material_keyword(keyword, row.material_code, row.material_name):
                    continue
                material_id = int(row.material_id)
                lines.append(
                    {
                        "id": encode_header_material_id(int(owo.id), material_id),
                        "outsource_work_order_id": int(owo.id),
                        "outsource_work_order_code": owo.code,
                        "supplier_name": owo.supplier_name,
                        "material_id": material_id,
                        "material_code": row.material_code,
                        "material_name": row.material_name,
                        "material_spec": None,
                        "unit": row.unit or "个",
                        "suggested_quantity": float(row.required_quantity or 0),
                        "pushed_quantity": float(row.issued_quantity or 0),
                        "remaining_quantity": remaining,
                    }
                )
        lines.sort(
            key=lambda r: (
                str(r.get("outsource_work_order_code") or ""),
                str(r.get("material_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return _page(lines, skip, limit)

    async def create_outsource_issues_from_lines(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
        from apps.kuaizhizao.schemas.outsource_work_order import (
            OutsourceMaterialIssueBatchCreate,
            OutsourceMaterialIssueLineCreate,
        )
        from apps.kuaizhizao.services.outsource_material_issue_service import OutsourceMaterialIssueService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可发料明细")
        grouped: Dict[int, List[int]] = defaultdict(list)
        for line_id in selected:
            owo_id, material_id = decode_header_material_id(line_id)
            grouped[owo_id].append(material_id)
        issue_svc = OutsourceMaterialIssueService()
        created: List[Dict[str, Any]] = []
        for owo_id, material_ids in grouped.items():
            owo = await OutsourceWorkOrder.get_or_none(
                tenant_id=tenant_id, id=owo_id, deleted_at__isnull=True
            )
            if not owo:
                raise NotFoundError(f"委外工单不存在: {owo_id}")
            preview = await issue_svc.get_issue_preview(tenant_id, owo_id)
            by_material = {int(r.material_id): r for r in (preview.lines or [])}
            batch_lines: List[OutsourceMaterialIssueLineCreate] = []
            for material_id in material_ids:
                row = by_material.get(int(material_id))
                if not row:
                    raise BusinessLogicError(f"物料 {material_id} 不在委外工单可发料范围内")
                qty = float(row.pending_quantity or 0)
                if qty <= 0:
                    raise BusinessLogicError(f"物料 {row.material_code or material_id} 已无剩余可发数量")
                label = str(row.material_code or row.material_name or material_id)
                wh_id, wh_name = await _resolve_material_warehouse(tenant_id, int(material_id), label)
                batch_lines.append(
                    OutsourceMaterialIssueLineCreate(
                        material_id=int(material_id),
                        material_code=str(row.material_code or ""),
                        material_name=str(row.material_name or ""),
                        quantity=Decimal(str(qty)),
                        unit=str(row.unit or "个"),
                        warehouse_id=wh_id,
                        warehouse_name=wh_name,
                    )
                )
            batch = await issue_svc.create_material_issues_batch(
                tenant_id,
                OutsourceMaterialIssueBatchCreate(
                    outsource_work_order_id=owo_id,
                    outsource_work_order_code=str(owo.code or ""),
                    lines=batch_lines,
                ),
                created_by,
            )
            for issue in batch.issues:
                created.append(
                    {
                        "issue_id": issue.id,
                        "issue_code": issue.code,
                        "outsource_work_order_id": owo_id,
                    }
                )
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张委外发料单"
            if len(created) > 1
            else "委外发料单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "issue_id": first["issue_id"],
            "issue_code": first["issue_code"],
            "issues": created,
        }

    async def list_outsource_inbound_pull_lines(
        self,
        tenant_id: int,
        *,
        pull_type: str,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        outsource_work_order_id: Optional[int] = None,
        pullable_only: bool = True,
    ) -> Dict[str, Any]:
        if pull_type == "outsource_receipt":
            return await self._list_outsource_receipt_lines(
                tenant_id,
                skip=skip,
                limit=limit,
                keyword=keyword,
                outsource_work_order_id=outsource_work_order_id,
                pullable_only=pullable_only,
            )
        if pull_type == "outsource_material_return":
            return await self._list_outsource_material_return_lines(
                tenant_id,
                skip=skip,
                limit=limit,
                keyword=keyword,
                outsource_work_order_id=outsource_work_order_id,
                pullable_only=pullable_only,
            )
        if pull_type == "outsource_product_return":
            return await self._list_outsource_product_return_lines(
                tenant_id,
                skip=skip,
                limit=limit,
                keyword=keyword,
                outsource_work_order_id=outsource_work_order_id,
                pullable_only=pullable_only,
            )
        raise ValidationError("不支持的委外入库取单类型")

    async def _list_outsource_receipt_lines(
        self,
        tenant_id: int,
        *,
        skip: int,
        limit: int,
        keyword: Optional[str],
        outsource_work_order_id: Optional[int],
        pullable_only: bool,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            derive_outsource_work_order_capabilities,
        )

        query = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id is not None:
            query = query.filter(id=int(outsource_work_order_id))
        orders = await query.all()
        lines: List[Dict[str, Any]] = []
        for owo in orders:
            can_push = bool(derive_outsource_work_order_capabilities(owo).push_outsource_receipt.allowed)
            ordered = float(owo.quantity or 0)
            received = float(owo.received_quantity or 0)
            remaining = max(0.0, ordered - received)
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            if not _match_material_keyword(keyword, owo.product_code, owo.product_name):
                continue
            lines.append(
                {
                    "id": int(owo.id),
                    "outsource_work_order_id": int(owo.id),
                    "outsource_work_order_code": owo.code,
                    "supplier_name": owo.supplier_name,
                    "material_id": owo.product_id,
                    "material_code": owo.product_code,
                    "material_name": owo.product_name,
                    "material_spec": None,
                    "unit": "件",
                    "suggested_quantity": ordered,
                    "pushed_quantity": received,
                    "remaining_quantity": remaining,
                    "pull_type": "outsource_receipt",
                }
            )
        lines.sort(key=lambda r: (str(r.get("outsource_work_order_code") or ""), int(r.get("id") or 0)))
        return _page(lines, skip, limit)

    async def _list_outsource_material_return_lines(
        self,
        tenant_id: int,
        *,
        skip: int,
        limit: int,
        keyword: Optional[str],
        outsource_work_order_id: Optional[int],
        pullable_only: bool,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue, OutsourceWorkOrder
        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            derive_outsource_work_order_capabilities,
        )
        from apps.kuaizhizao.services.outsource_material_return_service import OutsourceMaterialReturnService

        query = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id is not None:
            query = query.filter(id=int(outsource_work_order_id))
        orders = await query.all()
        order_by_id = {int(o.id): o for o in orders}
        if not order_by_id:
            return {"data": [], "total": 0}
        issues = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            outsource_work_order_id__in=list(order_by_id.keys()),
            deleted_at__isnull=True,
            status="completed",
        ).all()
        return_svc = OutsourceMaterialReturnService()
        returned_by_issue = await return_svc._sum_returns_by_issue(
            tenant_id, [int(i.id) for i in issues if i.id]
        )
        lines: List[Dict[str, Any]] = []
        for issue in issues:
            owo = order_by_id.get(int(issue.outsource_work_order_id))
            if not owo:
                continue
            can_push = bool(
                derive_outsource_work_order_capabilities(owo).push_outsource_material_return.allowed
            )
            issued = float(issue.quantity or 0)
            returned = float(returned_by_issue.get(int(issue.id), 0))
            remaining = max(0.0, issued - returned)
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            if not _match_material_keyword(keyword, issue.material_code, issue.material_name):
                continue
            lines.append(
                {
                    "id": int(issue.id),
                    "outsource_work_order_id": int(owo.id),
                    "outsource_work_order_code": owo.code,
                    "supplier_name": owo.supplier_name,
                    "material_id": issue.material_id,
                    "material_code": issue.material_code,
                    "material_name": issue.material_name,
                    "material_spec": None,
                    "unit": issue.unit or "个",
                    "suggested_quantity": issued,
                    "pushed_quantity": returned,
                    "remaining_quantity": remaining,
                    "pull_type": "outsource_material_return",
                }
            )
        lines.sort(
            key=lambda r: (
                str(r.get("outsource_work_order_code") or ""),
                str(r.get("material_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return _page(lines, skip, limit)

    async def _list_outsource_product_return_lines(
        self,
        tenant_id: int,
        *,
        skip: int,
        limit: int,
        keyword: Optional[str],
        outsource_work_order_id: Optional[int],
        pullable_only: bool,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialReceipt, OutsourceWorkOrder
        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            derive_outsource_work_order_capabilities,
        )
        from apps.kuaizhizao.services.outsource_product_return_service import OutsourceProductReturnService

        query = OutsourceWorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id is not None:
            query = query.filter(id=int(outsource_work_order_id))
        orders = await query.all()
        order_by_id = {int(o.id): o for o in orders}
        if not order_by_id:
            return {"data": [], "total": 0}
        receipts = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            outsource_work_order_id__in=list(order_by_id.keys()),
            deleted_at__isnull=True,
            status="completed",
        ).all()
        return_svc = OutsourceProductReturnService()
        returned_by_receipt = await return_svc._sum_returns_by_receipt(
            tenant_id, [int(r.id) for r in receipts if r.id]
        )
        lines: List[Dict[str, Any]] = []
        for receipt in receipts:
            owo = order_by_id.get(int(receipt.outsource_work_order_id))
            if not owo:
                continue
            can_push = bool(
                derive_outsource_work_order_capabilities(owo).push_outsource_product_return.allowed
            )
            received = float(receipt.quantity or 0)
            returned = float(returned_by_receipt.get(int(receipt.id), 0))
            remaining = max(0.0, received - returned)
            selectable = can_push and remaining > 0
            if pullable_only and not selectable:
                continue
            if not _match_material_keyword(keyword, owo.product_code, owo.product_name, receipt.code):
                continue
            lines.append(
                {
                    "id": int(receipt.id),
                    "outsource_work_order_id": int(owo.id),
                    "outsource_work_order_code": owo.code,
                    "supplier_name": owo.supplier_name,
                    "material_id": owo.product_id,
                    "material_code": owo.product_code,
                    "material_name": owo.product_name,
                    "material_spec": None,
                    "unit": receipt.unit or "件",
                    "suggested_quantity": received,
                    "pushed_quantity": returned,
                    "remaining_quantity": remaining,
                    "pull_type": "outsource_product_return",
                }
            )
        lines.sort(
            key=lambda r: (
                str(r.get("outsource_work_order_code") or ""),
                int(r.get("id") or 0),
            )
        )
        return _page(lines, skip, limit)

    async def create_outsource_inbound_from_items(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
        pull_type: str,
    ) -> Dict[str, Any]:
        if pull_type == "outsource_receipt":
            return await self._create_outsource_receipts(tenant_id, item_ids, created_by)
        if pull_type == "outsource_material_return":
            return await self._create_outsource_material_returns(tenant_id, item_ids, created_by)
        if pull_type == "outsource_product_return":
            return await self._create_outsource_product_returns(tenant_id, item_ids, created_by)
        raise ValidationError("不支持的委外入库取单类型")

    async def _create_outsource_receipts(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
        from apps.kuaizhizao.schemas.outsource_work_order import OutsourceMaterialReceiptCreate
        from apps.kuaizhizao.services.outsource_material_receipt_service import (
            OutsourceMaterialReceiptService,
        )
        from apps.kuaizhizao.utils.outsource_work_order_state import (
            resolve_outsource_work_order_product_unit,
        )

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可收货委外工单行")
        orders = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id, id__in=selected, deleted_at__isnull=True
        ).all()
        if len(orders) != len(set(selected)):
            raise NotFoundError("委外工单不存在")
        receipt_svc = OutsourceMaterialReceiptService()
        created: List[Dict[str, Any]] = []
        for owo in orders:
            pending = max(0.0, float(owo.quantity or 0) - float(owo.received_quantity or 0))
            if pending <= 0:
                raise BusinessLogicError(f"委外工单 {owo.code} 已无剩余可收数量")
            if not owo.product_id:
                raise ValidationError(f"委外工单 {owo.code} 未维护产品")
            wh_id, wh_name = await _resolve_material_warehouse(
                tenant_id, int(owo.product_id), str(owo.product_code or owo.product_name or owo.code)
            )
            unit = await resolve_outsource_work_order_product_unit(tenant_id, owo)
            receipt = await receipt_svc.create_material_receipt(
                tenant_id,
                OutsourceMaterialReceiptCreate(
                    outsource_work_order_id=int(owo.id),
                    outsource_work_order_code=str(owo.code or ""),
                    quantity=Decimal(str(pending)),
                    qualified_quantity=Decimal(str(pending)),
                    unqualified_quantity=Decimal("0"),
                    unit=unit,
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                ),
                created_by,
            )
            created.append(
                {
                    "receipt_id": receipt.id,
                    "receipt_code": receipt.code,
                    "outsource_work_order_id": int(owo.id),
                }
            )
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张委外收货单"
            if len(created) > 1
            else "委外收货单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "receipt_id": first["receipt_id"],
            "receipt_code": first["receipt_code"],
            "receipts": created,
        }

    async def _create_outsource_material_returns(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue, OutsourceWorkOrder
        from apps.kuaizhizao.schemas.outsource_work_order import OutsourceMaterialReturnCreate
        from apps.kuaizhizao.services.outsource_material_return_service import OutsourceMaterialReturnService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可退料发料明细")
        issues = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id, id__in=selected, deleted_at__isnull=True, status="completed"
        ).all()
        if not issues:
            raise BusinessLogicError("没有可退料的发料明细")
        owo_ids = sorted({int(i.outsource_work_order_id) for i in issues})
        orders = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id, id__in=owo_ids, deleted_at__isnull=True
        ).all()
        order_by_id = {int(o.id): o for o in orders}
        return_svc = OutsourceMaterialReturnService()
        returned_by_issue = await return_svc._sum_returns_by_issue(tenant_id, selected)
        created: List[Dict[str, Any]] = []
        for issue in issues:
            owo = order_by_id.get(int(issue.outsource_work_order_id))
            if not owo:
                raise NotFoundError(f"委外工单不存在: {issue.outsource_work_order_id}")
            remaining = float(issue.quantity or 0) - float(returned_by_issue.get(int(issue.id), 0))
            if remaining <= 0:
                raise BusinessLogicError(f"物料 {issue.material_code or issue.id} 已无剩余可退数量")
            wh_id, wh_name = await _resolve_material_warehouse(
                tenant_id, int(issue.material_id), str(issue.material_code or issue.material_name)
            )
            created_ret = await return_svc.create_material_return(
                tenant_id,
                OutsourceMaterialReturnCreate(
                    outsource_work_order_id=int(owo.id),
                    outsource_work_order_code=str(owo.code or ""),
                    outsource_material_issue_id=int(issue.id),
                    material_id=int(issue.material_id),
                    material_code=str(issue.material_code or ""),
                    material_name=str(issue.material_name or ""),
                    quantity=Decimal(str(remaining)),
                    unit=str(issue.unit or "个"),
                    warehouse_id=wh_id,
                    warehouse_name=wh_name,
                    remarks=None,
                ),
                created_by,
            )
            created.append({"return_id": created_ret.id, "return_code": created_ret.code})
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张委外退料单"
            if len(created) > 1
            else "委外退料单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "return_id": first["return_id"],
            "return_code": first["return_code"],
            "returns": created,
        }

    async def _create_outsource_product_returns(
        self,
        tenant_id: int,
        item_ids: List[int],
        created_by: int,
    ) -> Dict[str, Any]:
        from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialReceipt, OutsourceWorkOrder
        from apps.kuaizhizao.schemas.outsource_work_order import OutsourceProductReturnCreate
        from apps.kuaizhizao.services.outsource_product_return_service import OutsourceProductReturnService

        selected = [int(v) for v in item_ids if v]
        if not selected:
            raise BusinessLogicError("请至少选择一条可退货收货明细")
        receipts = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id, id__in=selected, deleted_at__isnull=True, status="completed"
        ).all()
        if not receipts:
            raise BusinessLogicError("没有可退货的收货明细")
        owo_ids = sorted({int(r.outsource_work_order_id) for r in receipts})
        orders = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id, id__in=owo_ids, deleted_at__isnull=True
        ).all()
        order_by_id = {int(o.id): o for o in orders}
        return_svc = OutsourceProductReturnService()
        returned_by_receipt = await return_svc._sum_returns_by_receipt(tenant_id, selected)
        created: List[Dict[str, Any]] = []
        for receipt in receipts:
            owo = order_by_id.get(int(receipt.outsource_work_order_id))
            if not owo:
                raise NotFoundError(f"委外工单不存在: {receipt.outsource_work_order_id}")
            remaining = float(receipt.quantity or 0) - float(returned_by_receipt.get(int(receipt.id), 0))
            if remaining <= 0:
                raise BusinessLogicError(f"收货单 {receipt.code} 已无剩余可退数量")
            created_ret = await return_svc.create_product_return(
                tenant_id,
                OutsourceProductReturnCreate(
                    outsource_work_order_id=int(owo.id),
                    outsource_work_order_code=str(owo.code or ""),
                    outsource_material_receipt_id=int(receipt.id),
                    quantity=Decimal(str(remaining)),
                    unit=str(receipt.unit or "件"),
                ),
                created_by,
            )
            created.append({"return_id": created_ret.id, "return_code": created_ret.code})
        first = created[0]
        msg = (
            f"转单成功，共生成 {len(created)} 张委外退货单"
            if len(created) > 1
            else "委外退货单创建成功"
        )
        return {
            "success": True,
            "message": msg,
            "return_id": first["return_id"],
            "return_code": first["return_code"],
            "returns": created,
        }
