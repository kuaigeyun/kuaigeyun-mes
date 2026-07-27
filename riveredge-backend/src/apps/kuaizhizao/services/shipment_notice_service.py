"""
发货通知单服务模块

销售通知仓库发货，不直接动库存。来源为销售订单。

Author: RiverEdge Team
Date: 2026-02-22
"""

import logging
from collections import defaultdict
from typing import List, Optional, Dict, Any
from datetime import date, datetime, time
from decimal import Decimal
from tortoise.transactions import in_transaction
from tortoise.expressions import Q

from apps.common.base_service import AppBaseService

logger = logging.getLogger(__name__)
from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
from apps.kuaizhizao.models.shipment_notice_item import ShipmentNoticeItem
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.shipment_notice import (
    ShipmentNoticeCreate,
    ShipmentNoticeUpdate,
    ShipmentNoticeNotify,
    ShipmentNoticeResponse,
    ShipmentNoticeListResponse,
    ShipmentNoticeWithItemsResponse,
    ShipmentNoticeItemCreate,
    ShipmentNoticeItemResponse,
)
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError
from apps.kuaizhizao.services.document_action_policy.shipment_notice import (
    assert_shipment_notice_capability,
    derive_shipment_notice_capabilities,
)
from apps.kuaizhizao.services.document_action_policy.enricher import (
    enrich_shipment_notice_capabilities_on_response,
    enrich_shipment_notice_list_capabilities,
)
from infra.services.business_config_service import BusinessConfigService
from apps.kuaizhizao.utils.inventory_helper import get_material_available_quantity
from core.services.approval.audit_record_enricher import enrich_items
from core.utils.timezone_utils import resolve_business_datetime, today_site_str

SHIPMENT_NOTICE_SORTABLE_FIELDS = frozenset({
    "notice_code",
    "sales_order_code",
    "customer_name",
    "warehouse_name",
    "planned_ship_date",
    "notified_at",
    "total_quantity",
    "total_amount",
    "status",
    "created_at",
    "updated_at",
})


async def _resolve_warehouse_name_by_id(
    tenant_id: int,
    warehouse_id: int,
    preferred_name: Optional[str] = None,
) -> str:
    preferred = str(preferred_name or "").strip()
    if preferred:
        return preferred
    if warehouse_id is None:
        raise ValidationError("缺少仓库ID，无法解析仓库名称")
    from apps.master_data.models.warehouse import Warehouse

    wh = await Warehouse.get_or_none(
        tenant_id=tenant_id,
        id=int(warehouse_id),
        is_active=True,
        deleted_at__isnull=True,
    )
    if not wh:
        raise ValidationError(f"仓库不存在或未启用: {warehouse_id}")
    name = str(getattr(wh, "name", "") or "").strip()
    if not name:
        raise ValidationError(f"仓库名称未配置: {warehouse_id}")
    return name


class ShipmentNoticeService(AppBaseService[ShipmentNotice]):
    """发货通知单服务"""

    def __init__(self):
        super().__init__(ShipmentNotice)
        self.business_config_service = BusinessConfigService()

    @staticmethod
    def _collect_notice_delivery_ids(notice: ShipmentNotice) -> List[int]:
        ids: List[int] = []
        primary = getattr(notice, "sales_delivery_id", None)
        if primary:
            ids.append(int(primary))
        related = getattr(notice, "related_sales_delivery_ids", None) or []
        if isinstance(related, list):
            for entry in related:
                if isinstance(entry, dict) and entry.get("id") is not None:
                    ids.append(int(entry["id"]))
                elif isinstance(entry, int):
                    ids.append(int(entry))
        return list(dict.fromkeys(ids))

    @staticmethod
    def _pushable_items_have_warehouses(notice_items: List[ShipmentNoticeItem]) -> bool:
        has_positive = False
        for item in notice_items:
            qty = Decimal(str(getattr(item, "notice_quantity", 0) or 0))
            if qty <= Decimal("0"):
                continue
            has_positive = True
            if not getattr(item, "warehouse_id", None):
                return False
        return has_positive

    async def _notice_delivery_withdrawable(self, tenant_id: int, notice: ShipmentNotice) -> bool:
        delivery_ids = self._collect_notice_delivery_ids(notice)
        if not delivery_ids:
            return True
        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id, id__in=delivery_ids, deleted_at__isnull=True
        ).all()
        status_by_id = {int(d.id): str(d.status or "").strip() for d in deliveries}
        for did in delivery_ids:
            st = status_by_id.get(did, "")
            if st and st not in ("草稿", "draft", "待出库"):
                return False
        return True

    async def _delivery_withdrawable_by_notice_id(
        self, tenant_id: int, notices: List[ShipmentNotice]
    ) -> dict[int, bool]:
        result: dict[int, bool] = {}
        delivery_ids_by_notice: dict[int, List[int]] = {}
        all_delivery_ids: set[int] = set()
        for n in notices:
            if str(n.status or "").strip() != "已通知":
                continue
            ids = self._collect_notice_delivery_ids(n)
            if not ids:
                result[int(n.id)] = True
            else:
                delivery_ids_by_notice[int(n.id)] = ids
                all_delivery_ids.update(ids)

        if not all_delivery_ids:
            return result

        from apps.kuaizhizao.models.sales_delivery import SalesDelivery

        status_by_id: dict[int, str] = {}
        deliveries = await SalesDelivery.filter(
            tenant_id=tenant_id, id__in=list(all_delivery_ids), deleted_at__isnull=True
        ).all()
        for d in deliveries:
            status_by_id[int(d.id)] = str(d.status or "").strip()

        for nid, dids in delivery_ids_by_notice.items():
            withdrawable = True
            for did in dids:
                st = status_by_id.get(did, "")
                if st and st not in ("草稿", "draft", "待出库"):
                    withdrawable = False
                    break
            result[nid] = withdrawable
        return result

    async def _notice_has_items_map(self, tenant_id: int, notice_ids: List[int]) -> dict[int, bool]:
        if not notice_ids:
            return {}
        from tortoise.functions import Count

        rows = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id__in=notice_ids,
        ).annotate(cnt=Count("id")).group_by("notice_id").values("notice_id", "cnt")
        return {int(r["notice_id"]): int(r["cnt"] or 0) > 0 for r in rows}

    async def _enrich_notice_response(
        self,
        tenant_id: int,
        notice: ShipmentNotice,
        response: ShipmentNoticeResponse | ShipmentNoticeWithItemsResponse,
    ) -> ShipmentNoticeResponse | ShipmentNoticeWithItemsResponse:
        item_count = await ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice.id).count()
        delivery_withdrawable = await self._notice_delivery_withdrawable(tenant_id, notice)
        enriched = enrich_shipment_notice_capabilities_on_response(
            notice,
            response,
            has_items=item_count > 0,
            has_warehouse=getattr(notice, "warehouse_id", None) is not None,
            delivery_withdrawable=delivery_withdrawable,
        )
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "shipment_notice", enriched)

    async def _validate_not_overdelivery_on_notify(
        self,
        *,
        tenant_id: int,
        notice: ShipmentNotice,
    ) -> None:
        """
        P1-S-009: 在通知仓库（提交）前做超发校验。
        以销售订单明细可发数量（剩余数量）为上限，且扣除其他“已通知”单据已占用数量。
        """
        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id=notice.id,
        ).all()
        if not notice_items:
            raise BusinessLogicError("发货通知单无明细，无法通知仓库")

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
        ).all()
        if not order_items:
            raise BusinessLogicError("销售订单明细不存在，无法校验发货通知数量")

        order_item_by_id = {int(it.id): it for it in order_items}

        reserved_notice_ids = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
            status="已通知",
            deleted_at__isnull=True,
        ).exclude(id=notice.id).values_list("id", flat=True)

        reserved_by_item_id: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if reserved_notice_ids:
            reserved_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(reserved_notice_ids),
            ).all()
            for rit in reserved_items:
                so_item_id = getattr(rit, "sales_order_item_id", None)
                if so_item_id is None:
                    continue
                reserved_by_item_id[int(so_item_id)] += Decimal(str(rit.notice_quantity or 0))

        for n_item in notice_items:
            qty = Decimal(str(n_item.notice_quantity or 0))
            if qty <= Decimal("0"):
                raise BusinessLogicError("发货通知数量必须大于0")

            so_item_id = getattr(n_item, "sales_order_item_id", None)
            if so_item_id is None:
                # 无法映射到订单行时，不做超发额度校验（但保留数量>0校验）
                continue
            so_item_id = int(so_item_id)
            so_item = order_item_by_id.get(so_item_id)
            if not so_item:
                raise BusinessLogicError(f"发货通知明细缺少有效的订单行关联: {so_item_id}")

            remaining_qty = (
                Decimal(str(so_item.remaining_quantity))
                if getattr(so_item, "remaining_quantity", None) is not None
                else Decimal(str(so_item.order_quantity or 0)) - Decimal(str(so_item.delivered_quantity or 0))
            )
            remaining_qty = max(Decimal("0"), remaining_qty)
            available_qty = max(Decimal("0"), remaining_qty - reserved_by_item_id.get(so_item_id, Decimal("0")))
            if qty > available_qty:
                material_label = (getattr(so_item, "material_code", None) or getattr(so_item, "material_name", None) or str(so_item_id))
                raise BusinessLogicError(
                    f"物料 {material_label} 通知数量 {qty} 超过可通知欠发量 {available_qty}"
                )

    async def _validate_inventory_reservation_on_notify(
        self,
        *,
        tenant_id: int,
        notice: ShipmentNotice,
    ) -> None:
        """
        P1-S-011: 通知仓库前校验库存预占量。
        按行出库仓库 + 物料汇总需求，扣除其他「已通知」单据同仓预占后再判断。
        """
        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id=notice.id,
        ).all()
        if not notice_items:
            return

        required_by_wh_material: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
        labels_by_wh_material: dict[tuple[int, int], str] = {}
        for item in notice_items:
            material_id = getattr(item, "material_id", None)
            if not material_id:
                continue
            qty = Decimal(str(getattr(item, "notice_quantity", 0) or 0))
            if qty <= Decimal("0"):
                continue
            warehouse_id = getattr(item, "warehouse_id", None) or getattr(notice, "warehouse_id", None)
            if warehouse_id is None:
                label = (
                    getattr(item, "material_code", None)
                    or getattr(item, "material_name", None)
                    or str(material_id)
                )
                raise ValidationError(f"请为物料 {label} 指定出库仓库")
            key = (int(warehouse_id), int(material_id))
            required_by_wh_material[key] += qty
            labels_by_wh_material[key] = (
                getattr(item, "material_code", None)
                or getattr(item, "material_name", None)
                or str(material_id)
            )

        if not required_by_wh_material:
            return

        reserved_notice_ids = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            status="已通知",
            deleted_at__isnull=True,
        ).exclude(id=notice.id).values_list("id", flat=True)

        reserved_by_wh_material: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
        if reserved_notice_ids:
            reserved_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(reserved_notice_ids),
            ).all()
            reserved_notices = await ShipmentNotice.filter(
                tenant_id=tenant_id,
                id__in=list(reserved_notice_ids),
            ).all()
            header_wh_by_notice = {int(n.id): getattr(n, "warehouse_id", None) for n in reserved_notices}
            for rit in reserved_items:
                material_id = getattr(rit, "material_id", None)
                if not material_id:
                    continue
                qty = Decimal(str(getattr(rit, "notice_quantity", 0) or 0))
                if qty <= Decimal("0"):
                    continue
                wh_id = getattr(rit, "warehouse_id", None) or header_wh_by_notice.get(int(rit.notice_id))
                if wh_id is None:
                    continue
                key = (int(wh_id), int(material_id))
                reserved_by_wh_material[key] += qty

        for key, required_qty in required_by_wh_material.items():
            wh_id, material_id = key
            available_qty = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=material_id,
                warehouse_id=wh_id,
            )
            effective_qty = max(
                Decimal("0"),
                Decimal(str(available_qty or 0)) - reserved_by_wh_material.get(key, Decimal("0")),
            )
            if required_qty > effective_qty:
                label = labels_by_wh_material.get(key, str(material_id))
                raise BusinessLogicError(
                    f"物料 {label} 通知数量 {required_qty} 超过库存可用量 {effective_qty}（已扣减预占）"
                )

    async def create_shipment_notice(
        self,
        tenant_id: int,
        notice_data: ShipmentNoticeCreate,
        created_by: int
    ) -> ShipmentNoticeResponse:
        """创建发货通知单"""
        is_enabled = await self.business_config_service.check_node_enabled(tenant_id, "shipment_notice")
        if not is_enabled:
            raise BusinessLogicError("发货通知单节点未启用，无法创建发货通知单")
        source_order = await SalesOrder.get_or_none(
            tenant_id=tenant_id,
            id=notice_data.sales_order_id,
            deleted_at__isnull=True,
        )
        if not source_order:
            raise BusinessLogicError("销售订单不存在或已删除，无法创建发货通知单")
        existed = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id,
            sales_order_id=notice_data.sales_order_id,
            deleted_at__isnull=True,
        )
        if existed:
            raise BusinessLogicError(
                f"该销售订单已创建发货通知单（{existed.notice_code}），请勿重复创建"
            )
        async with in_transaction():
            code = notice_data.notice_code
            if not code:
                try:
                    code = await self.generate_code(tenant_id, "SHIPMENT_NOTICE_CODE", prefix="SN")
                except Exception as e:
                    from infra.exceptions.exceptions import ValidationError
                    if isinstance(e, ValidationError) and ("不存在" in str(e) or "未启用" in str(e)):
                        from core.services.default.default_values_service import DefaultValuesService
                        created = await DefaultValuesService.ensure_code_rule_for_page(
                            tenant_id, "kuaizhizao-shipment-notice"
                        )
                        if created:
                            try:
                                code = await self.generate_code(tenant_id, "SHIPMENT_NOTICE_CODE", prefix="SN")
                            except Exception as e2:
                                logger.warning("发货通知单编码规则补建后生成仍失败: %s", e2)
                        else:
                            logger.warning("发货通知单编码规则生成失败: %s", e)
                    else:
                        logger.warning("发货通知单编码规则生成失败: %s", e)
                if not code:
                    import uuid
                    code = f"SN{today_site_str()}{uuid.uuid4().hex[:6].upper()}"

            dump = notice_data.model_dump(exclude_unset=True, exclude={"items", "notice_code"})
            audit_required = await self.business_config_service.check_audit_required(
                tenant_id, "shipment_notice"
            )
            if audit_required:
                dump["status"] = "待审核"

            user_info = await self.get_user_info(created_by)
            notice = await ShipmentNotice.create(
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
                amt = item_data.total_amount if item_data.total_amount is not None else qty * Decimal(str(item_data.unit_price or 0))
                await ShipmentNoticeItem.create(
                    tenant_id=tenant_id,
                    notice_id=notice.id,
                    notice_quantity=qty,
                    unit_price=Decimal(str(item_data.unit_price or 0)),
                    total_amount=amt,
                    **item_data.model_dump(exclude_unset=True, exclude={"notice_quantity", "unit_price", "total_amount"})
                )
                total_quantity += qty
                total_amount += amt

            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                total_quantity=total_quantity,
                total_amount=total_amount
            )
            notice = await ShipmentNotice.get(tenant_id=tenant_id, id=notice.id)
            if audit_required and (notice.status or "").strip() == "待审核":
                from core.services.approval.approval_instance_service import ApprovalInstanceService

                instance = await ApprovalInstanceService.start_approval_for_node(
                    tenant_id=tenant_id,
                    user_id=created_by,
                    node_key="shipment_notice",
                    entity_type="shipment_notice",
                    entity_id=notice.id,
                    entity_uuid=str(notice.uuid),
                    title=f"发货通知单审批: {notice.notice_code}",
                    content=f"客户: {notice.customer_name}, 金额: {notice.total_amount}",
                )
                if not instance:
                    raise BusinessLogicError(
                        "发货通知单审核已开启但未找到可用的审批流程，请在配置中心检查 shipment_notice 审批流程是否已激活"
                    )
            resp = ShipmentNoticeResponse.model_validate(notice)
            return await self._enrich_notice_response(tenant_id, notice, resp)

    async def get_shipment_notice_by_id(
        self,
        tenant_id: int,
        notice_id: int
    ) -> ShipmentNoticeWithItemsResponse:
        """根据ID获取发货通知单（含明细）"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        items = await ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()
        response = ShipmentNoticeWithItemsResponse.model_validate(notice)
        response.items = [ShipmentNoticeItemResponse.model_validate(i) for i in items]
        from apps.kuaizhizao.services.document_lifecycle_service import get_shipment_notice_lifecycle, get_document_milestones
        milestones = await get_document_milestones(tenant_id, "shipment_notice", notice_id)
        response.lifecycle = get_shipment_notice_lifecycle(notice, milestones=milestones)
        return await self._enrich_notice_response(tenant_id, notice, response)

    async def list_shipment_notices(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        **filters
    ) -> Dict[str, Any]:
        """获取发货通知单列表（含 capabilities 与分页 total）。"""
        query = ShipmentNotice.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if filters.get("status"):
            query = query.filter(status=filters["status"])
        if filters.get("sales_order_id"):
            query = query.filter(sales_order_id=filters["sales_order_id"])
        if filters.get("customer_id"):
            query = query.filter(customer_id=int(filters["customer_id"]))
        if filters.get("warehouse_id"):
            query = query.filter(warehouse_id=int(filters["warehouse_id"]))
        if filters.get("planned_start_date"):
            query = query.filter(planned_ship_date__gte=filters["planned_start_date"])
        if filters.get("planned_end_date"):
            query = query.filter(planned_ship_date__lte=filters["planned_end_date"])
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
                | Q(sales_order_code__icontains=keyword)
                | Q(customer_name__icontains=keyword)
                | Q(warehouse_name__icontains=keyword)
                | Q(sales_delivery_code__icontains=keyword)
            )
        if filters.get("notice_code"):
            code = str(filters["notice_code"]).strip()
            if code:
                query = query.filter(notice_code__icontains=code)
        if filters.get("sales_order_code"):
            order_code = str(filters["sales_order_code"]).strip()
            if order_code:
                query = query.filter(sales_order_code__icontains=order_code)

        total = await query.count()
        order_clause = filters.get("order_by") or "-created_at"
        notices = await query.offset(skip).limit(limit).order_by(order_clause, "-id")
        notice_list = list(notices)
        notice_ids = [int(n.id) for n in notice_list]
        has_items_by_id = await self._notice_has_items_map(tenant_id, notice_ids)
        withdrawable_by_id = await self._delivery_withdrawable_by_notice_id(tenant_id, notice_list)
        from apps.kuaizhizao.services.document_lifecycle_service import get_shipment_notice_lifecycle
        list_responses: List[ShipmentNoticeListResponse] = []
        for r in notice_list:
            resp = ShipmentNoticeListResponse.model_validate(r)
            resp.lifecycle = get_shipment_notice_lifecycle(r)
            list_responses.append(resp)
        enriched = await enrich_items(tenant_id, "shipment_notice", enrich_shipment_notice_list_capabilities(
            notice_list,
            list_responses,
            has_items_by_id=has_items_by_id,
            delivery_withdrawable_by_id=withdrawable_by_id,
        ))
        return {
            "data": [item.model_dump() for item in enriched],
            "total": total,
            "success": True,
        }

    async def update_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        notice_data: ShipmentNoticeUpdate,
        updated_by: int
    ) -> ShipmentNoticeResponse:
        """更新发货通知单"""
        notice_row = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice_row:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        assert_shipment_notice_capability(notice_row, "update")

        async with in_transaction():
            dump = notice_data.model_dump(exclude_unset=True, exclude={"notice_code"})
            user_info = await self.get_user_info(updated_by)
            dump["updated_by"] = updated_by
            dump["updated_by_name"] = user_info["name"]
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(**dump)
            updated = await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
            resp = ShipmentNoticeResponse.model_validate(updated)
            return await self._enrich_notice_response(tenant_id, updated, resp)

    async def delete_shipment_notice(self, tenant_id: int, notice_id: int) -> bool:
        """删除发货通知单"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        assert_shipment_notice_capability(notice, "delete")

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(deleted_at=resolve_business_datetime())
        return True

    async def submit_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        submitted_by: int,
    ) -> ShipmentNoticeResponse:
        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        status = str(notice.status or "").strip()
        if status == "待审核":
            return await self.get_shipment_notice_by_id(tenant_id, notice_id)

        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "shipment_notice"
        )
        if not audit_required:
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
                status="待发货",
                updated_by=submitted_by,
                updated_by_name=(await self.get_user_info(submitted_by))["name"],
            )
            return await self.get_shipment_notice_by_id(tenant_id, notice_id)

        if status not in ("待发货",):
            raise BusinessLogicError(f"当前状态不可提交审核: {status or '-'}")

        from core.services.approval.approval_instance_service import ApprovalInstanceService

        instance = await ApprovalInstanceService.start_approval_for_node(
            tenant_id=tenant_id,
            user_id=submitted_by,
            node_key="shipment_notice",
            entity_type="shipment_notice",
            entity_id=notice.id,
            entity_uuid=str(notice.uuid),
            title=f"发货通知单审批: {notice.notice_code}",
            content=f"客户: {notice.customer_name}, 金额: {notice.total_amount}",
        )
        if not instance:
            raise BusinessLogicError(
                "发货通知单审核已开启但未找到可用的审批流程，请在配置中心检查 shipment_notice 审批流程是否已激活"
            )
        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待审核",
            updated_by=submitted_by,
            updated_by_name=(await self.get_user_info(submitted_by))["name"],
        )
        return await self.get_shipment_notice_by_id(tenant_id, notice_id)

    async def approve_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        approver_id: int,
    ) -> ShipmentNoticeResponse:
        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        status = str(notice.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能审核待审核状态的发货通知单，当前: {status or '-'}")
        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待发货",
            updated_by=approver_id,
            updated_by_name=(await self.get_user_info(approver_id))["name"],
        )
        return await self.get_shipment_notice_by_id(tenant_id, notice_id)

    async def reject_shipment_notice(
        self,
        tenant_id: int,
        notice_id: int,
        approver_id: int,
        *,
        rejection_reason: Optional[str] = None,
    ) -> ShipmentNoticeResponse:
        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        status = str(notice.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能驳回待审核状态的发货通知单，当前: {status or '-'}")
        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已驳回",
            updated_by=approver_id,
            updated_by_name=(await self.get_user_info(approver_id))["name"],
        )
        return await self.get_shipment_notice_by_id(tenant_id, notice_id)

    async def withdraw_shipment_notice_submit(
        self,
        tenant_id: int,
        notice_id: int,
        operator_id: int,
    ) -> ShipmentNoticeResponse:
        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        status = str(notice.status or "").strip()
        if status != "待审核":
            raise BusinessLogicError(f"只能撤回待审核状态的发货通知单，当前: {status or '-'}")
        from core.services.approval.approval_instance_service import ApprovalInstanceService

        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type="shipment_notice",
            entity_id=notice_id,
            operator_id=operator_id,
        )
        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待发货",
            updated_by=operator_id,
            updated_by_name=(await self.get_user_info(operator_id))["name"],
        )
        return await self.get_shipment_notice_by_id(tenant_id, notice_id)

    async def revoke_shipment_notice_approval(
        self,
        tenant_id: int,
        notice_id: int,
        operator_id: int,
    ) -> ShipmentNoticeResponse:
        from core.services.approval.audit_transition import resolve_revoke_landing_phase
        from core.services.approval.uni_audit_service import UniAuditService

        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        status = str(notice.status or "").strip()
        if status != "待发货":
            raise BusinessLogicError(f"当前状态不可撤销审核: {status or '-'}")
        audit_required = await self.business_config_service.check_audit_required(
            tenant_id, "shipment_notice"
        )
        landing = resolve_revoke_landing_phase(manual_audit_enabled=audit_required)
        target_status = "待审核" if landing == "pending" else "待发货"

        async def _do_revoke() -> ShipmentNoticeResponse:
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
                status=target_status,
                updated_by=operator_id,
                updated_by_name=(await self.get_user_info(operator_id))["name"],
            )
            return await self.get_shipment_notice_by_id(tenant_id, notice_id)

        return await UniAuditService.revoke_with_flow_fallback(
            tenant_id=tenant_id,
            entity_type="shipment_notice",
            entity_id=notice_id,
            operator_id=operator_id,
            flow_revoke=_do_revoke,
        )

    async def _apply_notify_warehouse_if_needed(
        self,
        *,
        tenant_id: int,
        notice: ShipmentNotice,
        notified_by: int,
        notify_data: Optional[ShipmentNoticeNotify],
    ) -> ShipmentNotice:
        if getattr(notice, "warehouse_id", None) is not None:
            return notice

        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id,
            notice_id=notice.id,
        ).all()
        if self._pushable_items_have_warehouses(notice_items):
            first_item = next(
                (
                    item
                    for item in notice_items
                    if Decimal(str(getattr(item, "notice_quantity", 0) or 0)) > Decimal("0")
                ),
                None,
            )
            if first_item is None:
                raise ValidationError("请指定出库仓库")
            warehouse_id = int(first_item.warehouse_id)
            warehouse_name = await _resolve_warehouse_name_by_id(
                tenant_id=tenant_id,
                warehouse_id=warehouse_id,
                preferred_name=getattr(first_item, "warehouse_name", None),
            )
            await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
                updated_by=notified_by,
                updated_by_name=(await self.get_user_info(notified_by))["name"],
            )
            return await ShipmentNotice.get(tenant_id=tenant_id, id=notice.id)

        warehouse_id = getattr(notify_data, "warehouse_id", None) if notify_data else None
        if warehouse_id is None:
            raise ValidationError("请指定出库仓库")

        warehouse_name = await _resolve_warehouse_name_by_id(
            tenant_id=tenant_id,
            warehouse_id=int(warehouse_id),
            preferred_name=getattr(notify_data, "warehouse_name", None) if notify_data else None,
        )
        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice.id).update(
            warehouse_id=int(warehouse_id),
            warehouse_name=warehouse_name,
            updated_by=notified_by,
            updated_by_name=(await self.get_user_info(notified_by))["name"],
        )
        return await ShipmentNotice.get(tenant_id=tenant_id, id=notice.id)

    async def preview_notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        *,
        warehouse_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """通知仓库预览：返回通知明细数量、已占用、可通知量，不实际创建出库单。"""
        notice = await ShipmentNotice.get_or_none(
            tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True
        )
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        notice_items = await ShipmentNoticeItem.filter(
            tenant_id=tenant_id, notice_id=notice_id
        ).order_by("id")
        if not notice_items:
            raise BusinessLogicError("发货通知单无明细，无法通知仓库")

        effective_warehouse_id = warehouse_id or getattr(notice, "warehouse_id", None)
        line_warehouses_ok = self._pushable_items_have_warehouses(notice_items)
        caps = derive_shipment_notice_capabilities(
            notice,
            has_items=True,
            has_warehouse=effective_warehouse_id is not None or line_warehouses_ok,
        )
        push_allowed = caps.notify.allowed
        blocking_reason = caps.notify.reason if not push_allowed else None

        order_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
        ).all()
        order_item_by_id = {int(it.id): it for it in order_items}

        reserved_notice_ids = await ShipmentNotice.filter(
            tenant_id=tenant_id,
            sales_order_id=notice.sales_order_id,
            status="已通知",
            deleted_at__isnull=True,
        ).exclude(id=notice.id).values_list("id", flat=True)

        reserved_by_item_id: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
        if reserved_notice_ids:
            reserved_items = await ShipmentNoticeItem.filter(
                tenant_id=tenant_id,
                notice_id__in=list(reserved_notice_ids),
            ).all()
            for rit in reserved_items:
                so_item_id = getattr(rit, "sales_order_item_id", None)
                if so_item_id is None:
                    continue
                reserved_by_item_id[int(so_item_id)] += Decimal(str(rit.notice_quantity or 0))

        preview_items: List[Dict[str, Any]] = []
        line_blocking_issues: List[str] = []
        for n_item in notice_items:
            notice_qty = Decimal(str(n_item.notice_quantity or 0))
            so_item_id = getattr(n_item, "sales_order_item_id", None)
            reserved_qty = Decimal("0")
            available_qty = notice_qty
            order_qty = notice_qty

            if so_item_id is not None:
                so_item_id = int(so_item_id)
                so_item = order_item_by_id.get(so_item_id)
                if so_item:
                    order_qty = Decimal(str(so_item.order_quantity or 0))
                    remaining_qty = (
                        Decimal(str(so_item.remaining_quantity))
                        if getattr(so_item, "remaining_quantity", None) is not None
                        else Decimal(str(so_item.order_quantity or 0))
                        - Decimal(str(so_item.delivered_quantity or 0))
                    )
                    remaining_qty = max(Decimal("0"), remaining_qty)
                    reserved_qty = reserved_by_item_id.get(so_item_id, Decimal("0"))
                    available_qty = max(Decimal("0"), remaining_qty - reserved_qty)
                    if notice_qty > available_qty:
                        material_label = (
                            getattr(so_item, "material_code", None)
                            or getattr(so_item, "material_name", None)
                            or str(so_item_id)
                        )
                        line_blocking_issues.append(
                            f"物料 {material_label} 通知数量 {notice_qty} 超过可通知欠发量 {available_qty}"
                        )

            preview_items.append({
                "item_id": int(n_item.id),
                "sales_order_item_id": int(so_item_id) if so_item_id is not None else None,
                "material_code": str(getattr(n_item, "material_code", "") or "").strip(),
                "material_name": str(getattr(n_item, "material_name", "") or "").strip(),
                "quantity": float(order_qty),
                "pushed_quantity": float(reserved_qty),
                "max_push_quantity": float(available_qty),
                "notice_quantity": float(notice_qty),
                "warehouse_id": int(n_item.warehouse_id) if getattr(n_item, "warehouse_id", None) else None,
                "warehouse_name": getattr(n_item, "warehouse_name", None),
            })

        inventory_blocking: List[str] = []
        required_by_wh_material: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
        labels_by_wh_material: dict[tuple[int, int], str] = {}
        for item in notice_items:
            material_id = getattr(item, "material_id", None)
            if not material_id:
                continue
            qty = Decimal(str(getattr(item, "notice_quantity", 0) or 0))
            if qty <= Decimal("0"):
                continue
            wh_id = (
                getattr(item, "warehouse_id", None)
                or effective_warehouse_id
                or getattr(notice, "warehouse_id", None)
            )
            if wh_id is None:
                continue
            key = (int(wh_id), int(material_id))
            required_by_wh_material[key] += qty
            labels_by_wh_material[key] = (
                getattr(item, "material_code", None)
                or getattr(item, "material_name", None)
                or str(material_id)
            )

        if required_by_wh_material:
            reserved_notice_ids_wh = await ShipmentNotice.filter(
                tenant_id=tenant_id,
                status="已通知",
                deleted_at__isnull=True,
            ).exclude(id=notice.id).values_list("id", flat=True)

            reserved_by_wh_material: dict[tuple[int, int], Decimal] = defaultdict(lambda: Decimal("0"))
            if reserved_notice_ids_wh:
                reserved_items_wh = await ShipmentNoticeItem.filter(
                    tenant_id=tenant_id,
                    notice_id__in=list(reserved_notice_ids_wh),
                ).all()
                reserved_notices = await ShipmentNotice.filter(
                    tenant_id=tenant_id,
                    id__in=list(reserved_notice_ids_wh),
                ).all()
                header_wh_by_notice = {int(n.id): getattr(n, "warehouse_id", None) for n in reserved_notices}
                for rit in reserved_items_wh:
                    material_id = getattr(rit, "material_id", None)
                    if not material_id:
                        continue
                    qty = Decimal(str(getattr(rit, "notice_quantity", 0) or 0))
                    if qty <= Decimal("0"):
                        continue
                    wh_id = getattr(rit, "warehouse_id", None) or header_wh_by_notice.get(int(rit.notice_id))
                    if wh_id is None:
                        continue
                    key = (int(wh_id), int(material_id))
                    reserved_by_wh_material[key] += qty

            for key, required_qty in required_by_wh_material.items():
                wh_id, material_id = key
                available_qty = await get_material_available_quantity(
                    tenant_id=tenant_id,
                    material_id=material_id,
                    warehouse_id=wh_id,
                )
                effective_qty = max(
                    Decimal("0"),
                    Decimal(str(available_qty or 0)) - reserved_by_wh_material.get(key, Decimal("0")),
                )
                if required_qty > effective_qty:
                    label = labels_by_wh_material.get(key, str(material_id))
                    inventory_blocking.append(
                        f"物料 {label} 通知数量 {required_qty} 超过库存可用量 {effective_qty}（已扣减预占）"
                    )

        if line_blocking_issues or inventory_blocking:
            push_allowed = False
            blocking_reason = blocking_reason or "shipment_notice.notify.overdelivery_or_inventory"
        elif not line_warehouses_ok and effective_warehouse_id is None and push_allowed:
            push_allowed = False
            blocking_reason = "shipment_notice.notify.no_warehouse"

        pushable_count = sum(
            1 for row in preview_items if float(row.get("max_push_quantity") or 0) > 0
        )
        return {
            "target_type": "sales_delivery",
            "summary": (
                f"请确认将通知仓库的发货明细（{pushable_count}/{len(preview_items)} 行可通知）"
                if push_allowed
                else "当前发货通知单不可通知仓库"
            ),
            "notice_code": notice.notice_code,
            "warehouse_required": not line_warehouses_ok and getattr(notice, "warehouse_id", None) is None,
            "line_warehouse_required": not line_warehouses_ok and getattr(notice, "warehouse_id", None) is None,
            "warehouse_id": int(effective_warehouse_id) if effective_warehouse_id is not None else None,
            "items": preview_items,
            "has_blocking_issues": not push_allowed,
            "blocking_reason": blocking_reason if not push_allowed else None,
            "line_blocking_issues": line_blocking_issues + inventory_blocking,
            "tip": "确认后将生成销售出库单（待出库），并标记本通知单为已通知。",
        }

    async def notify_warehouse(
        self,
        tenant_id: int,
        notice_id: int,
        notified_by: int,
        *,
        notify_data: Optional[ShipmentNoticeNotify] = None,
    ) -> ShipmentNoticeResponse:
        """通知仓库（标记为已通知）"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")
        item_count = await ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).count()
        assert_shipment_notice_capability(
            notice,
            "notify",
            has_items=item_count > 0,
        )

        notice = await self._apply_notify_warehouse_if_needed(
            tenant_id=tenant_id,
            notice=notice,
            notified_by=notified_by,
            notify_data=notify_data,
        )

        await self._validate_not_overdelivery_on_notify(
            tenant_id=tenant_id,
            notice=notice,
        )
        await self._validate_inventory_reservation_on_notify(
            tenant_id=tenant_id,
            notice=notice,
        )

        notice_items = await ShipmentNoticeItem.filter(tenant_id=tenant_id, notice_id=notice_id).all()

        # 按行出库仓库分组生成销售出库单
        from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService
        from apps.kuaizhizao.schemas.warehouse import SalesDeliveryCreate, SalesDeliveryItemCreate

        groups: dict[int, list] = defaultdict(list)
        for item in notice_items:
            qty = Decimal(str(getattr(item, "notice_quantity", 0) or 0))
            if qty <= Decimal("0"):
                continue
            wh_id = getattr(item, "warehouse_id", None) or getattr(notice, "warehouse_id", None)
            if wh_id is None:
                label = getattr(item, "material_code", None) or getattr(item, "material_name", None) or str(item.id)
                raise ValidationError(f"请为物料 {label} 指定出库仓库")
            groups[int(wh_id)].append(item)

        if not groups:
            raise BusinessLogicError("发货通知单无有效明细，无法通知仓库")

        delivery_service = SalesDeliveryService()
        created_deliveries = []
        for wh_id, group_items in groups.items():
            wh_name = await _resolve_warehouse_name_by_id(
                tenant_id=tenant_id,
                warehouse_id=wh_id,
                preferred_name=next(
                    (getattr(item, "warehouse_name", None) for item in group_items if getattr(item, "warehouse_name", None)),
                    getattr(notice, "warehouse_name", None),
                ),
            )
            delivery_items = []
            for item in group_items:
                unit_price = getattr(item, "unit_price", None)
                total_amount = getattr(item, "total_amount", None)
                so_item_id = getattr(item, "sales_order_item_id", None)
                delivery_items.append(
                    SalesDeliveryItemCreate(
                        sales_order_item_id=int(so_item_id) if so_item_id else 0,
                        material_id=item.material_id,
                        material_code=item.material_code,
                        material_name=item.material_name,
                        material_spec=getattr(item, "material_spec", None),
                        material_unit=item.material_unit,
                        delivery_quantity=float(item.notice_quantity),
                        unit_price=float(unit_price) if unit_price is not None else 0.0,
                        total_amount=float(total_amount) if total_amount is not None else 0.0,
                        notes=getattr(item, "notes", None),
                    )
                )

            delivery_data = SalesDeliveryCreate(
                sales_order_id=notice.sales_order_id,
                sales_order_code=notice.sales_order_code,
                demand_id=notice.sales_order_id,
                demand_code=notice.sales_order_code,
                demand_type="sales_order",
                customer_id=notice.customer_id,
                customer_name=notice.customer_name,
                customer_contact=getattr(notice, "customer_contact", None),
                customer_phone=getattr(notice, "customer_phone", None),
                warehouse_id=wh_id,
                warehouse_name=wh_name,
                delivery_time=notice.planned_ship_date,
                shipping_address=getattr(notice, "shipping_address", None),
                notes=getattr(notice, "notes", None),
                items=delivery_items,
                status="待出库",
                review_status="已通过",
            )
            delivery = await delivery_service.create_sales_delivery(
                tenant_id=tenant_id,
                delivery_data=delivery_data,
                created_by=notified_by,
                require_batch_serial_on_create=False,
            )
            created_deliveries.append(delivery)

        primary_delivery = created_deliveries[0]
        related_deliveries = [
            {"id": int(d.id), "code": str(d.delivery_code)}
            for d in created_deliveries
        ]

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="已通知",
            notified_at=resolve_business_datetime(),
            sales_delivery_id=primary_delivery.id,
            sales_delivery_code=primary_delivery.delivery_code,
            related_sales_delivery_ids=related_deliveries,
            updated_by=notified_by,
            updated_by_name=(await self.get_user_info(notified_by))["name"],
        )
        # 回写关联后再自动建 OQC，避免与「销售出库创建时自动建 OQC」在未关联窗口双建。
        # 门禁在确认出库时校验，此处只建待检验单。
        from apps.kuaizhizao.services.quality_automation_service import QualityAutomationService

        await QualityAutomationService().maybe_auto_create_oqc_from_shipment_notice(
            tenant_id=tenant_id,
            notice_id=notice_id,
            user_id=notified_by,
        )
        updated = await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
        resp = ShipmentNoticeResponse.model_validate(updated)
        return await self._enrich_notice_response(tenant_id, updated, resp)

    async def withdraw_notice(
        self,
        tenant_id: int,
        notice_id: int,
        withdrawn_by: int,
    ) -> ShipmentNoticeResponse:
        """撤回通知（已通知 -> 待发货）。已出库/已关联出库单不允许撤回。"""
        notice = await ShipmentNotice.get_or_none(tenant_id=tenant_id, id=notice_id, deleted_at__isnull=True)
        if not notice:
            raise NotFoundError(f"发货通知单不存在: {notice_id}")

        delivery_withdrawable = await self._notice_delivery_withdrawable(tenant_id, notice)
        assert_shipment_notice_capability(
            notice,
            "withdraw",
            delivery_withdrawable=delivery_withdrawable,
        )
        if getattr(notice, "sales_delivery_id", None) or getattr(notice, "related_sales_delivery_ids", None):
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery
            from apps.kuaizhizao.models.sales_delivery_item import SalesDeliveryItem

            delivery_ids = self._collect_notice_delivery_ids(notice)
            for delivery_id in delivery_ids:
                delivery = await SalesDelivery.get_or_none(
                    tenant_id=tenant_id, id=delivery_id, deleted_at__isnull=True
                )
                if delivery:
                    await SalesDelivery.filter(tenant_id=tenant_id, id=delivery.id).update(
                        deleted_at=resolve_business_datetime()
                    )
                    await SalesDeliveryItem.filter(tenant_id=tenant_id, delivery_id=delivery.id).delete()

        await ShipmentNotice.filter(tenant_id=tenant_id, id=notice_id).update(
            status="待发货",
            notified_at=None,
            updated_by=withdrawn_by,
            updated_by_name=(await self.get_user_info(withdrawn_by))["name"],
            sales_delivery_id=None,
            sales_delivery_code=None,
            related_sales_delivery_ids=None,
        )
        updated = await ShipmentNotice.get(tenant_id=tenant_id, id=notice_id)
        resp = ShipmentNoticeResponse.model_validate(updated)
        return await self._enrich_notice_response(tenant_id, updated, resp)
