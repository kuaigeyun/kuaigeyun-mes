"""
收货通知单服务模块

采购通知仓库收货，不直接动库存。来源为采购订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, date, time
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
from apps.kuaizhizao.models.receipt_notice_item import ReceiptNoticeItem
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.schemas.receipt_notice import (
    ReceiptNoticeCreate,
    ReceiptNoticeUpdate,
    ReceiptNoticeResponse,
    ReceiptNoticeListResponse,
    ReceiptNoticeWithItemsResponse,
    ReceiptNoticeItemCreate,
    ReceiptNoticeItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from infra.services.business_config_service import BusinessConfigService
from apps.kuaizhizao.services.document_action_policy.receipt_notice import (
    assert_receipt_notice_capability,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_receipt_notice_capabilities_on_response,
    enrich_receipt_notice_list_capabilities,
)


async def _first_storage_location_for_warehouse(
    tenant_id: int, warehouse_id: int
) -> Tuple[Optional[int], Optional[str]]:
    """取该仓库下第一个可用库位（按库区、库位 id），供启用库位管理时生成入库草稿。"""
    from apps.master_data.models.warehouse import StorageArea, StorageLocation

    areas = await StorageArea.filter(
        tenant_id=tenant_id,
        warehouse_id=warehouse_id,
        deleted_at__isnull=True,
        is_active=True,
    ).order_by("id")
    for area in areas:
        loc = await StorageLocation.filter(
            tenant_id=tenant_id,
            storage_area_id=area.id,
            deleted_at__isnull=True,
            is_active=True,
        ).order_by("id").first()
        if loc:
            return loc.id, loc.code
    return None, None


RECEIPT_NOTICE_SORTABLE_FIELDS = frozenset({
    "notice_code",
    "purchase_order_code",
    "supplier_name",
    "warehouse_name",
    "planned_receipt_date",
    "notified_at",
    "total_quantity",
    "total_amount",
    "status",
    "created_at",
    "updated_at",
})


class ReceiptNoticeService(AppBaseService[ReceiptNotice]):
    """收货通知单服务"""

    def __init__(self):
        super().__init__(ReceiptNotice)
        self.business_config_service = BusinessConfigService()

    async def _notice_receipt_withdrawable(self, tenant_id: int, notice: ReceiptNotice) -> bool:
        receipt_id = getattr(notice, "purchase_receipt_id", None)
        if not receipt_id:
            return True
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipt = await PurchaseReceipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            return True
        return str(receipt.status or "").strip() in ("草稿", "draft", "DRAFT", "待入库")

    async def _receipt_withdrawable_by_notice_id(
        self, tenant_id: int, notices: List[ReceiptNotice]
    ) -> dict[int, bool]:
        result: dict[int, bool] = {}
        receipt_id_by_notice: dict[int, int] = {}
        for n in notices:
            if str(n.status or "").strip() != "已通知":
                continue
            if not getattr(n, "purchase_receipt_id", None):
                result[int(n.id)] = True
            else:
                receipt_id_by_notice[int(n.id)] = int(n.purchase_receipt_id)

        if not receipt_id_by_notice:
            return result

        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipt_ids = list(set(receipt_id_by_notice.values()))
        status_by_id: dict[int, str] = {}
        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id, id__in=receipt_ids, deleted_at__isnull=True
        ).all()
        for r in receipts:
            status_by_id[int(r.id)] = str(r.status or "").strip()

        for nid, rid in receipt_id_by_notice.items():
            st = status_by_id.get(rid, "")
            result[nid] = st in ("草稿", "draft", "DRAFT", "待入库") or not st
        return result

    async def _purchase_receipt_status_by_notice_id(
        self, tenant_id: int, notices: List[ReceiptNotice]
    ) -> dict[int, str]:
        receipt_id_by_notice: dict[int, int] = {}
        for n in notices:
            rid = getattr(n, "purchase_receipt_id", None)
            if rid:
                receipt_id_by_notice[int(n.id)] = int(rid)
        if not receipt_id_by_notice:
            return {}

        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt

        receipt_ids = list(set(receipt_id_by_notice.values()))
        status_by_id: dict[int, str] = {}
        receipts = await PurchaseReceipt.filter(
            tenant_id=tenant_id, id__in=receipt_ids, deleted_at__isnull=True
        ).all()
        for r in receipts:
            status_by_id[int(r.id)] = str(r.status or "").strip()

        return {
            nid: status_by_id.get(rid, "")
            for nid, rid in receipt_id_by_notice.items()
        }

    async def _notice_has_items_map(self, tenant_id: int, notice_ids: List[int]) -> dict[int, bool]:
        if not notice_ids:
            return {}
        from tortoise.functions import Count

        rows = await ReceiptNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id__in=notice_ids,
        ).annotate(cnt=Count("id")).group_by("notice_id").values("notice_id", "cnt")
        return {int(r["notice_id"]): int(r["cnt"] or 0) > 0 for r in rows}

    async def _enrich_notice_response(
        self,
        tenant_id: int,
        notice: ReceiptNotice,
        response: ReceiptNoticeResponse | ReceiptNoticeWithItemsResponse,
    ) -> ReceiptNoticeResponse | ReceiptNoticeWithItemsResponse:
        item_count = await ReceiptNoticeItem.filter(tenant_id=tenant_id, notice_id=notice.id).count()
        receipt_withdrawable = await self._notice_receipt_withdrawable(tenant_id, notice)
        return enrich_receipt_notice_capabilities_on_response(
            notice,
            response,
            has_items=item_count > 0,
            has_warehouse=getattr(notice, "warehouse_id", None) is not None,
            receipt_withdrawable=receipt_withdrawable,
        )

    async def create_receipt_notice(
        self,
        tenant_id: int,
        notice_data: ReceiptNoticeCreate,
        created_by: int
    ) -> ReceiptNoticeResponse:
        """创建收货通知单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "receipt_notice")
        if not is_enabled:
            raise BusinessLogicError("收货通知单节点未启用，无法创建收货通知单")
        source_order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id,
            id=notice_data.purchase_order_id,
        )
        if not source_order:
            raise BusinessLogicError("采购订单不存在或已删除，无法创建收货通知单")
        existed = await ReceiptNotice.get_or_none(
            tenant_id=tenant_id,
            purchase_order_id=notice_data.purchase_order_id,
            deleted_at__isnull=True,
        )
        if existed:
            raise BusinessLogicError(
                f"该采购订单已创建收货通知单（{existed.notice_code}），请勿重复创建"
            )
        async with in_transaction():
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "RECEIPT_NOTICE_CODE", prefix=f"RN{today}")

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            if notice_data.notice_code:
                code = notice_data.notice_code

            user_info = await self.get_user_info(created_by)
            notice = await ReceiptNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                **dump,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            items = getattr(notice_data, "items", None) or []
            total_quantity = Decimal(0)
            total_amount = Decimal(0)
            for item_data in items:
                qty = Decimal(str(item_data.notice_quantity))
                unit_p = Decimal(str(item_data.unit_price or 0))
                amt = (
                    Decimal(str(item_data.total_amount))
                    if item_data.total_amount is not None
                    else qty * unit_p
                )
                # 显式字段落库，避免 model_dump **展开带入 Tortoise 未定义字段导致 TypeError（500）
                spec = item_data.material_spec
                if spec is not None and str(spec).strip() == "":
                    spec = None
                await ReceiptNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    material_id=int(item_data.material_id),
                    material_code=str(item_data.material_code or ""),
                    material_name=str(item_data.material_name or ""),
                    material_spec=spec,
                    material_unit=str(item_data.material_unit or "件"),
                    notice_quantity=qty,
                    unit_price=unit_p,
                    total_amount=amt,
                    purchase_order_item_id=item_data.purchase_order_item_id,
                    warehouse_id=getattr(item_data, "warehouse_id", None),
                    warehouse_name=getattr(item_data, "warehouse_name", None),
                    notes=item_data.notes,
                )
                total_quantity += qty
                total_amount += amt

            await ReceiptNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await ReceiptNotice.get(tenant_id=tenant_id, id=notice.id)
            return ReceiptNoticeResponse.model_validate(notice)

    async def get_receipt_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> ReceiptNoticeWithItemsResponse:
        """根据ID获取收货通知单（含明细）"""
        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        items = await ReceiptNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = ReceiptNoticeWithItemsResponse.model_validate(notice)
        response.items = [ReceiptNoticeItemResponse.model_validate(i) for i in items]
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_document_milestones,
            get_receipt_notice_lifecycle,
        )

        receipt_status_map = await self._purchase_receipt_status_by_notice_id(tenant_id, [notice])
        milestones = await get_document_milestones(tenant_id, "receipt_notice", notice_id)
        response.lifecycle = get_receipt_notice_lifecycle(
            notice,
            milestones=milestones,
            purchase_receipt_status=receipt_status_map.get(int(notice.id)),
        )
        return await self._enrich_notice_response(tenant_id, notice, response)

    async def list_receipt_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> Dict[str, Any]:
        """获取收货通知单列表（含 capabilities 与分页 total）。"""
        query = ReceiptNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("purchase_order_id"):
            query = query.filter(purchase_order_id=filters["purchase_order_id"])
        if filters.get("supplier_id"):
            query = query.filter(supplier_id=int(filters["supplier_id"]))
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=int(filters["warehouse_id"]))
        if filters.get("planned_start_date"):
            query = query.filter(planned_receipt_date__gte=filters["planned_start_date"])
        if filters.get("planned_end_date"):
            query = query.filter(planned_receipt_date__lte=filters["planned_end_date"])
        if filters.get("created_start_date"):
            query = query.filter(
                created_at__gte=datetime.combine(filters["created_start_date"], time.min)
            )
        if filters.get("created_end_date"):
            query = query.filter(
                created_at__lte=datetime.combine(filters["created_end_date"], time(23, 59, 59))
            )
        keyword = str(filters.get("keyword") or "").strip()
        if keyword:
            query = query.filter(
                Q(notice_code__icontains=keyword)
                | Q(purchase_order_code__icontains=keyword)
                | Q(supplier_name__icontains=keyword)
                | Q(warehouse_name__icontains=keyword)
                | Q(purchase_receipt_code__icontains=keyword)
            )
        if filters.get("notice_code"):
            code = str(filters["notice_code"]).strip()
            if code:
                query = query.filter(notice_code__icontains=code)
        if filters.get("purchase_order_code"):
            order_code = str(filters["purchase_order_code"]).strip()
            if order_code:
                query = query.filter(purchase_order_code__icontains=order_code)

        total = await query.count()
        order_clause = filters.get("order_by") or "-created_at"
        field = order_clause.lstrip("-")
        if field not in RECEIPT_NOTICE_SORTABLE_FIELDS:
            order_clause = "-created_at"
        notices = await query.offset(skip).limit(limit).order_by(order_clause, "-id")
        notice_list = list(notices)
        notice_ids = [int(n.id) for n in notice_list if n.id is not None]
        items_map = await self._notice_has_items_map(tenant_id, notice_ids)
        withdraw_map = await self._receipt_withdrawable_by_notice_id(tenant_id, notice_list)
        receipt_status_map = await self._purchase_receipt_status_by_notice_id(tenant_id, notice_list)
        from apps.kuaizhizao.services.document_lifecycle_service import get_receipt_notice_lifecycle

        list_responses: List[ReceiptNoticeListResponse] = []
        for r in notice_list:
            resp = ReceiptNoticeListResponse.model_validate(r)
            resp.lifecycle = get_receipt_notice_lifecycle(
                r,
                purchase_receipt_status=receipt_status_map.get(int(r.id)) if r.id is not None else None,
            )
            list_responses.append(resp)
        enriched = enrich_receipt_notice_list_capabilities(
            notice_list,
            list_responses,
            has_items_by_id=items_map,
            receipt_withdrawable_by_id=withdraw_map,
        )
        return {
            "data": [item.model_dump() for item in enriched],
            "total": total,
            "success": True,
        }

    async def update_receipt_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: ReceiptNoticeUpdate,
        updated_by: int
    ) -> ReceiptNoticeResponse:
        """更新收货通知单"""
        notice = await self.get_receipt_notice_by_id(tenant_id, notice_id)
        if notice.status != "待收货":
            raise BusinessLogicError("只能更新待收货状态的收货通知单")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
            await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            return ReceiptNoticeResponse.model_validate(
                await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
            )

    async def delete_receipt_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除收货通知单"""
        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")
        if notice.status != "待收货":
            raise BusinessLogicError("只能删除待收货状态的收货通知单")

        await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=datetime.now())
        return True

    async def preview_notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
    ) -> Dict[str, Any]:
        """通知仓库预览：返回通知明细及采购未入库数量门禁，不实际创建入库单。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.services.warehouse_service import sync_purchase_order_receipt_quantities
        from apps.kuaizhizao.services.document_action_policy.receipt_notice import (
            derive_receipt_notice_capabilities,
        )

        notice = await ReceiptNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        notice_items = await ReceiptNoticeItem.filter(
            tenant_id=tenant_id, notice_id=notice_id
        ).order_by("id").all()
        if not notice_items:
            raise BusinessLogicError("收货通知单无明细，无法通知仓库")

        has_warehouse = getattr(notice, "warehouse_id", None) is not None
        caps = derive_receipt_notice_capabilities(
            notice,
            has_items=True,
            has_warehouse=has_warehouse,
        )
        push_allowed = caps.notify.allowed
        blocking_reason = caps.notify.reason if not push_allowed else None

        if notice.purchase_order_id:
            await sync_purchase_order_receipt_quantities(tenant_id, int(notice.purchase_order_id))

        po_items_by_id: Dict[int, PurchaseOrderItem] = {}
        if notice.purchase_order_id:
            po_items = await PurchaseOrderItem.filter(
                tenant_id=tenant_id,
                order_id=int(notice.purchase_order_id),
            ).all()
            po_items_by_id = {int(it.id): it for it in po_items}

        preview_items: List[Dict[str, Any]] = []
        line_blocking_issues: List[str] = []
        for ni in notice_items:
            notice_qty = float(ni.notice_quantity or 0)
            if notice_qty <= 0:
                continue
            po_item = None
            if ni.purchase_order_item_id:
                po_item = po_items_by_id.get(int(ni.purchase_order_item_id))
            ordered = float(po_item.ordered_quantity or 0) if po_item else notice_qty
            received = float(po_item.received_quantity or 0) if po_item else 0.0
            outstanding = float(po_item.outstanding_quantity or 0) if po_item else notice_qty
            if po_item is not None and notice_qty > outstanding:
                line_blocking_issues.append(
                    f"物料 {ni.material_code or ni.material_name} 的通知数量 {notice_qty} "
                    f"超过未入库数量 {outstanding}"
                )
            preview_items.append(
                {
                    "item_id": int(ni.id),
                    "purchase_order_item_id": int(ni.purchase_order_item_id)
                    if ni.purchase_order_item_id
                    else None,
                    "material_code": str(ni.material_code or ""),
                    "material_name": str(ni.material_name or ""),
                    "quantity": ordered,
                    "pushed_quantity": received,
                    "max_push_quantity": outstanding,
                    "notice_quantity": notice_qty,
                }
            )

        if line_blocking_issues:
            push_allowed = False
            blocking_reason = blocking_reason or "receipt_notice.notify.overdelivery"

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "purchase_receipt",
            "summary": (
                f"请确认将通知仓库的收货明细（{pushable_count}/{len(preview_items)} 行可通知）"
                if push_allowed
                else "当前收货通知单不可通知仓库"
            ),
            "notice_code": notice.notice_code,
            "warehouse_required": not has_warehouse,
            "warehouse_id": int(notice.warehouse_id) if notice.warehouse_id else None,
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": blocking_reason if not push_allowed else None,
            "line_blocking_issues": line_blocking_issues,
            "tip": "确认后将生成采购入库草稿，由仓库核对后确认入库。",
        }

    async def notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        notified_by: int
    ) -> ReceiptNoticeResponse:
        """通知仓库：标记已通知，并同步生成采购入库单（草稿），供仓库核对后确认入库。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService, _resolve_warehouse_name_by_id
        from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
        from apps.master_data.models.warehouse import Warehouse

        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        notice_items = await ReceiptNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        has_line_warehouse = any(getattr(ni, "warehouse_id", None) for ni in notice_items)
        assert_receipt_notice_capability(
            notice,
            "notify",
            has_items=bool(notice_items),
            has_warehouse=getattr(notice, "warehouse_id", None) is not None or has_line_warehouse,
        )
        if not notice_items:
            raise BusinessLogicError("收货通知单无明细，无法生成采购入库单")

        wh_id = notice.warehouse_id
        wh_name = notice.warehouse_name
        if not wh_id:
            for ni in notice_items:
                if getattr(ni, "warehouse_id", None):
                    wh_id = int(ni.warehouse_id)
                    wh_name = getattr(ni, "warehouse_name", None)
                    break
        if not wh_id:
            default_wh = await Warehouse.filter(tenant_id=tenant_id, is_active=True).first()
            if not default_wh:
                raise BusinessLogicError("收货通知单未指定仓库，且未找到可用仓库，无法生成采购入库草稿")
            wh_id = default_wh.id
            wh_name = default_wh.name

        cfg = await self.business_config_service.get_business_config(tenant_id)
        wh_params = cfg.get("parameters", {}).get("warehouse", {})
        location_required = bool(wh_params.get("location_management", False))

        default_loc_by_wh: dict[int, tuple[Optional[int], Optional[str]]] = {}

        async def _default_location_for_warehouse(warehouse_id: int) -> tuple[Optional[int], Optional[str]]:
            if warehouse_id in default_loc_by_wh:
                return default_loc_by_wh[warehouse_id]
            loc_id: Optional[int] = None
            loc_code: Optional[str] = None
            if location_required:
                loc_id, loc_code = await _first_storage_location_for_warehouse(
                    tenant_id, int(warehouse_id)
                )
            default_loc_by_wh[warehouse_id] = (loc_id, loc_code)
            return loc_id, loc_code

        receipt_items: List[PurchaseReceiptItemCreate] = []
        for ni in notice_items:
            qty = Decimal(str(ni.notice_quantity or 0))
            if qty <= 0:
                continue

            po_item = None
            if ni.purchase_order_item_id:
                po_item = await PurchaseOrderItem.get_or_none(
                    tenant_id=tenant_id, id=ni.purchase_order_item_id
                )
            if po_item is not None and qty > po_item.outstanding_quantity:
                raise ValidationError(
                    f"物料 {ni.material_code} 的通知数量 {qty} 超过采购订单未入库数量 {po_item.outstanding_quantity}"
                )

            line_wh_id = int(ni.warehouse_id) if getattr(ni, "warehouse_id", None) else int(wh_id)
            line_wh_name = getattr(ni, "warehouse_name", None)
            if not line_wh_name:
                line_wh_name = await _resolve_warehouse_name_by_id(tenant_id, line_wh_id)

            unit_p = Decimal(str(ni.unit_price or 0))
            if unit_p <= 0 and po_item is not None:
                unit_p = po_item.unit_price
            total_amt = qty * unit_p
            po_line_id = int(ni.purchase_order_item_id) if ni.purchase_order_item_id else 0
            material_spec = (getattr(po_item, "material_spec", None) or None) or ni.material_spec

            item_kwargs = dict(
                purchase_order_item_id=po_line_id,
                material_id=int(ni.material_id),
                material_code=str(ni.material_code or ""),
                material_name=str(ni.material_name or ""),
                material_spec=material_spec,
                material_unit=str(ni.material_unit or "件"),
                receipt_quantity=float(qty),
                unit_price=float(unit_p),
                total_amount=float(total_amt),
                qualified_quantity=float(qty),
                unqualified_quantity=0.0,
                status="草稿",
                warehouse_id=line_wh_id,
                warehouse_name=line_wh_name,
            )
            default_loc_id, default_loc_code = await _default_location_for_warehouse(line_wh_id)
            if default_loc_id is not None:
                item_kwargs["location_id"] = default_loc_id
                if default_loc_code:
                    item_kwargs["location_code"] = default_loc_code

            receipt_items.append(PurchaseReceiptItemCreate(**item_kwargs))

        if not receipt_items:
            raise BusinessLogicError("没有有效的通知数量，无法生成采购入库单")

        prev_notes = (notice.notes or "").strip()
        trail_note = f"由收货通知单 {notice.notice_code} 通知仓库生成（草稿）"
        merged_notes = f"{prev_notes}；{trail_note}" if prev_notes else trail_note

        receipt_data = PurchaseReceiptCreate(
            purchase_order_id=int(notice.purchase_order_id),
            purchase_order_code=str(notice.purchase_order_code or ""),
            supplier_id=int(notice.supplier_id),
            supplier_name=str(notice.supplier_name or ""),
            warehouse_id=int(wh_id),
            warehouse_name=str(wh_name or ""),
            status="草稿",
            review_status="待审核",
            notes=merged_notes,
            items=receipt_items,
        )

        receipt_svc = PurchaseReceiptService()
        receipt = await receipt_svc.create_purchase_receipt(
            tenant_id=tenant_id,
            receipt_data=receipt_data,
            created_by=notified_by,
        )

        await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已通知",
            notified_at=datetime.now(),
            updated_by=notified_by,
            updated_by_name=(await self.get_user_info(notified_by))["name"],
            purchase_receipt_id=receipt.id,
            purchase_receipt_code=receipt.receipt_code,
        )
        updated = await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
        resp = ReceiptNoticeResponse.model_validate(updated)
        return await self._enrich_notice_response(tenant_id, updated, resp)

    async def withdraw_notice(
        self,
        tenant_id: int,
        notice_id: int,
        withdrawn_by: int,
    ) -> ReceiptNoticeResponse:
        """撤回通知（已通知 -> 待收货）。已确认入库或关联采购入库单已处理则不允许撤回。"""
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem

        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        receipt_withdrawable = await self._notice_receipt_withdrawable(tenant_id, notice)
        assert_receipt_notice_capability(notice, "withdraw", receipt_withdrawable=receipt_withdrawable)

        allowed_receipt_statuses = ("草稿", "draft", "DRAFT", "待入库")
        if getattr(notice, "purchase_receipt_id", None):
            receipt = await PurchaseReceipt.get_or_none(
                tenant_id=tenant_id, id=notice.purchase_receipt_id, deleted_at__isnull=True
            )
            if receipt and receipt.status not in allowed_receipt_statuses:
                raise BusinessLogicError(
                    f"该通知单关联的采购入库单 ({receipt.receipt_code}) 已经在处理（{receipt.status}），无法撤回。"
                    "请先作废或撤回该入库单。"
                )
            if receipt:
                await PurchaseReceipt.filter(tenant_id=tenant_id, id=receipt.id).update(
                    deleted_at=datetime.now()
                )
                await PurchaseReceiptItem.filter(tenant_id=tenant_id, receipt_id=receipt.id).delete()

        await ReceiptNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待收货",
            notified_at=None,
            updated_by=withdrawn_by,
            updated_by_name=(await self.get_user_info(withdrawn_by))["name"],
            purchase_receipt_id=None,
            purchase_receipt_code=None,
        )
        updated = await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
        resp = ReceiptNoticeResponse.model_validate(updated)
        return await self._enrich_notice_response(tenant_id, updated, resp)
