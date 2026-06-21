"""
收货通知单服务模块

采购通知仓库收货，不直接动库存。来源为采购订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

from typing import List, Optional, Tuple
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

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
            deleted_at__isnull=True,
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

            notice = await ReceiptNotice.create(
                tenant_id=tenant_id,
                notice_code=code,
                created_by=created_by,
                **dump
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
        return await self._enrich_notice_response(tenant_id, notice, response)

    async def list_receipt_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> List[ReceiptNoticeListResponse]:
        """获取收货通知单列表"""
        query = ReceiptNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("purchase_order_id"):
            query = query.filter(purchase_order_id=filters["purchase_order_id"])
        if filters.get("supplier_id"):
            query = query.filter(supplier_id=filters["supplier_id"])

        notices = await query.offset(skip).limit(limit).order_by("-created_at")
        notice_list = list(notices)
        notice_ids = [int(n.id) for n in notice_list if n.id is not None]
        items_map = await self._notice_has_items_map(tenant_id, notice_ids)
        withdraw_map = await self._receipt_withdrawable_by_notice_id(tenant_id, notice_list)
        responses = [ReceiptNoticeListResponse.model_validate(r) for r in notice_list]
        return enrich_receipt_notice_list_capabilities(
            notice_list,
            responses,
            has_items_by_id=items_map,
            receipt_withdrawable_by_id=withdraw_map,
        )

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
            dump["updated_by"] = updated_by
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

    async def notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        notified_by: int
    ) -> ReceiptNoticeResponse:
        """通知仓库：标记已通知，并同步生成采购入库单（草稿），供仓库核对后确认入库。"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrderItem
        from apps.kuaizhizao.services.warehouse_service import PurchaseReceiptService
        from apps.kuaizhizao.schemas.warehouse import PurchaseReceiptCreate, PurchaseReceiptItemCreate
        from apps.master_data.models.warehouse import Warehouse

        notice = await ReceiptNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"收货通知单不存在: {notice_id}")

        notice_items = await ReceiptNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        assert_receipt_notice_capability(
            notice,
            "notify",
            has_items=bool(notice_items),
            has_warehouse=getattr(notice, "warehouse_id", None) is not None,
        )
        if not notice_items:
            raise BusinessLogicError("收货通知单无明细，无法生成采购入库单")

        wh_id = notice.warehouse_id
        wh_name = notice.warehouse_name
        if not wh_id:
            default_wh = await Warehouse.filter(tenant_id=tenant_id, is_active=True).first()
            if not default_wh:
                raise BusinessLogicError("收货通知单未指定仓库，且未找到可用仓库，无法生成采购入库草稿")
            wh_id = default_wh.id
            wh_name = default_wh.name

        cfg = await self.business_config_service.get_business_config(tenant_id)
        wh_params = cfg.get("parameters", {}).get("warehouse", {})
        location_required = bool(wh_params.get("location_management", False))

        default_loc_id: Optional[int] = None
        default_loc_code: Optional[str] = None
        if location_required:
            default_loc_id, default_loc_code = await _first_storage_location_for_warehouse(
                tenant_id, int(wh_id)
            )

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
            )
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
            purchase_receipt_id=None,
            purchase_receipt_code=None,
        )
        updated = await ReceiptNotice.get(tenant_id=tenant_id, id=notice_id)
        resp = ReceiptNoticeResponse.model_validate(updated)
        return await self._enrich_notice_response(tenant_id, updated, resp)
