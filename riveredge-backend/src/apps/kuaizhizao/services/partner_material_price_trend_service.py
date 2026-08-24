"""客商物料价格趋势查询服务。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from apps.kuaizhizao.constants import LEGACY_AUDITED_VALUES
from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_item import SalesOrderItem
from apps.kuaizhizao.schemas.partner_material_price_trend import (
    PartnerMaterialPriceTrendItem,
    PartnerMaterialPriceTrendPoint,
    PartnerMaterialPriceTrendResponse,
)

DEFAULT_LIMIT = 10
MAX_LIMIT = 50
_SALES_ORDER_SCAN = 200
# 采购趋势禁止 hydrate 完整 PurchaseOrder / select_related("order")：
# Tortoise 对 prepayment_bank_account_id 等长字段别名截断后，
# _init_from_db 会 KeyError('prepayment_bank_acc')（有成交行时必现）。
_PURCHASE_ORDER_SCAN = 200
_PURCHASE_ORDER_TREND_FIELDS = (
    "id",
    "order_code",
    "order_date",
    "supplier_id",
    "supplier_name",
)
_PURCHASE_ITEM_TREND_FIELDS = (
    "id",
    "order_id",
    "unit_price",
    "ordered_quantity",
)


def _clamp_limit(limit: int) -> int:
    return max(1, min(MAX_LIMIT, int(limit or DEFAULT_LIMIT)))


def _aggregate_prices(prices: List[Decimal]) -> tuple[Decimal, Decimal, Decimal]:
    if not prices:
        return Decimal(0), Decimal(0), Decimal(0)
    return (
        sum(prices) / len(prices),
        min(prices),
        max(prices),
    )


def _build_trend_points(items: List[PartnerMaterialPriceTrendItem]) -> List[PartnerMaterialPriceTrendPoint]:
    chronological = sorted(items, key=lambda row: (row.order_date, row.order_id))
    return [
        PartnerMaterialPriceTrendPoint(
            date=row.order_date,
            price=row.unit_price,
            order_code=row.order_code,
        )
        for row in chronological
    ]


class PartnerMaterialPriceTrendService:
    """按客商 + 物料查询已审核订单历史成交价。"""

    async def get_sales_price_trend(
        self,
        tenant_id: int,
        material_id: int,
        customer_id: int,
        limit: int = DEFAULT_LIMIT,
    ) -> PartnerMaterialPriceTrendResponse:
        limit = _clamp_limit(limit)
        orders = await SalesOrder.filter(
            tenant_id=tenant_id,
            customer_id=customer_id,
            status__in=LEGACY_AUDITED_VALUES,
        ).order_by("-order_date", "-id").limit(_SALES_ORDER_SCAN).all()
        if not orders:
            return PartnerMaterialPriceTrendResponse(
                side="sales",
                material_id=material_id,
                partner_id=customer_id,
            )

        order_map = {order.id: order for order in orders}
        order_ids = list(order_map.keys())
        raw_items = await SalesOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            sales_order_id__in=order_ids,
            is_gift=False,
        ).all()

        ranked: List[tuple] = []
        for item in raw_items:
            order = order_map.get(item.sales_order_id)
            if order is None:
                continue
            ranked.append((order.order_date, order.id, item, order))

        ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
        ranked = ranked[:limit]

        history_items: List[PartnerMaterialPriceTrendItem] = []
        prices: List[Decimal] = []
        partner_name: Optional[str] = None
        for order_date, _order_id, item, order in ranked:
            partner_name = order.customer_name
            unit_price = Decimal(str(item.unit_price or 0))
            history_items.append(
                PartnerMaterialPriceTrendItem(
                    order_id=order.id,
                    order_code=order.order_code,
                    order_date=order_date,
                    partner_id=order.customer_id,
                    partner_name=order.customer_name,
                    unit_price=unit_price,
                    quantity=Decimal(str(item.order_quantity or 0)),
                )
            )
            prices.append(unit_price)

        average_price, min_price, max_price = _aggregate_prices(prices)
        return PartnerMaterialPriceTrendResponse(
            side="sales",
            material_id=material_id,
            partner_id=customer_id,
            partner_name=partner_name,
            history_items=history_items,
            trend_points=_build_trend_points(history_items),
            average_price=average_price,
            min_price=min_price,
            max_price=max_price,
        )

    async def get_purchase_price_trend(
        self,
        tenant_id: int,
        material_id: int,
        supplier_id: int,
        limit: int = DEFAULT_LIMIT,
    ) -> PartnerMaterialPriceTrendResponse:
        limit = _clamp_limit(limit)
        order_rows: List[Dict[str, Any]] = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            supplier_id=supplier_id,
            status__in=LEGACY_AUDITED_VALUES,
            deleted_at__isnull=True,
        ).order_by("-order_date", "-id").limit(_PURCHASE_ORDER_SCAN).values(*_PURCHASE_ORDER_TREND_FIELDS)
        if not order_rows:
            return PartnerMaterialPriceTrendResponse(
                side="purchase",
                material_id=material_id,
                partner_id=supplier_id,
            )

        order_map = {row["id"]: row for row in order_rows}
        item_rows: List[Dict[str, Any]] = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            order_id__in=list(order_map.keys()),
            deleted_at__isnull=True,
        ).values(*_PURCHASE_ITEM_TREND_FIELDS)

        ranked: List[tuple] = []
        for item in item_rows:
            order = order_map.get(item["order_id"])
            if order is None:
                continue
            ranked.append((order["order_date"], order["id"], item, order))

        ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
        ranked = ranked[:limit]

        history_items: List[PartnerMaterialPriceTrendItem] = []
        prices: List[Decimal] = []
        partner_name: Optional[str] = None
        for order_date, _order_id, item, order in ranked:
            partner_name = order.get("supplier_name") or ""
            unit_price = Decimal(str(item.get("unit_price") or 0))
            history_items.append(
                PartnerMaterialPriceTrendItem(
                    order_id=order["id"],
                    order_code=order["order_code"],
                    order_date=order_date,
                    partner_id=order["supplier_id"],
                    partner_name=partner_name,
                    unit_price=unit_price,
                    quantity=Decimal(str(item.get("ordered_quantity") or 0)),
                )
            )
            prices.append(unit_price)

        average_price, min_price, max_price = _aggregate_prices(prices)
        return PartnerMaterialPriceTrendResponse(
            side="purchase",
            material_id=material_id,
            partner_id=supplier_id,
            partner_name=partner_name,
            history_items=history_items,
            trend_points=_build_trend_points(history_items),
            average_price=average_price,
            min_price=min_price,
            max_price=max_price,
        )

    async def get_purchase_price_history_all_suppliers(
        self,
        tenant_id: int,
        material_id: int,
        limit: int = DEFAULT_LIMIT,
    ) -> PartnerMaterialPriceTrendResponse:
        """兼容旧 material-price-history：不限供应商。"""
        limit = _clamp_limit(limit)
        order_rows: List[Dict[str, Any]] = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            status__in=LEGACY_AUDITED_VALUES,
            deleted_at__isnull=True,
        ).order_by("-order_date", "-id").limit(_PURCHASE_ORDER_SCAN).values(*_PURCHASE_ORDER_TREND_FIELDS)
        if not order_rows:
            return PartnerMaterialPriceTrendResponse(
                side="purchase",
                material_id=material_id,
                partner_id=0,
            )

        order_map = {row["id"]: row for row in order_rows}
        item_rows: List[Dict[str, Any]] = await PurchaseOrderItem.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            order_id__in=list(order_map.keys()),
            deleted_at__isnull=True,
        ).values(*_PURCHASE_ITEM_TREND_FIELDS)

        ranked: List[tuple] = []
        for item in item_rows:
            order = order_map.get(item["order_id"])
            if order is None:
                continue
            ranked.append((order["order_date"], order["id"], item, order))

        ranked.sort(key=lambda row: (row[0], row[1]), reverse=True)
        ranked = ranked[:limit]

        history_items: List[PartnerMaterialPriceTrendItem] = []
        prices: List[Decimal] = []
        for order_date, _order_id, item, order in ranked:
            unit_price = Decimal(str(item.get("unit_price") or 0))
            history_items.append(
                PartnerMaterialPriceTrendItem(
                    order_id=order["id"],
                    order_code=order["order_code"],
                    order_date=order_date,
                    partner_id=order["supplier_id"],
                    partner_name=order.get("supplier_name") or "",
                    unit_price=unit_price,
                    quantity=Decimal(str(item.get("ordered_quantity") or 0)),
                )
            )
            prices.append(unit_price)

        average_price, min_price, max_price = _aggregate_prices(prices)
        return PartnerMaterialPriceTrendResponse(
            side="purchase",
            material_id=material_id,
            partner_id=0,
            partner_name=None,
            history_items=history_items,
            trend_points=_build_trend_points(history_items),
            average_price=average_price,
            min_price=min_price,
            max_price=max_price,
        )
