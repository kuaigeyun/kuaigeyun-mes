"""订单变更单共享工具"""

from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from apps.kuaizhizao.constants import DocumentStatus, ReviewStatus, normalize_status
from apps.kuaizhizao.constants.order_change import OrderChangeCategory, OrderChangeLineType
from infra.exceptions.exceptions import BusinessLogicError


def is_source_order_locked_for_direct_edit(status: str, review_status: Optional[str] = None) -> bool:
    """已生效/执行中/已完成/已关闭原单禁止直接改单"""
    n = normalize_status(status or "")
    locked = {
        DocumentStatus.CONFIRMED.value,
        DocumentStatus.IN_PROGRESS.value,
        DocumentStatus.COMPLETED.value,
        DocumentStatus.CLOSED.value,
        DocumentStatus.RELEASED.value,
        DocumentStatus.AUDITED.value,
    }
    if n in locked:
        return True
    if review_status == ReviewStatus.APPROVED.value and n not in (
        DocumentStatus.DRAFT.value,
        DocumentStatus.PENDING_REVIEW.value,
        DocumentStatus.REJECTED.value,
    ):
        return True
    return False


def infer_change_category(line_types: List[str]) -> str:
    types = {t for t in line_types if t}
    if not types:
        return OrderChangeCategory.OTHER.value
    if len(types) == 1:
        t = next(iter(types))
        if t == OrderChangeLineType.QUANTITY.value:
            return OrderChangeCategory.QUANTITY.value
        if t == OrderChangeLineType.DELIVERY_DATE.value:
            return OrderChangeCategory.DELIVERY.value
        if t == OrderChangeLineType.UNIT_PRICE.value:
            return OrderChangeCategory.PRICE.value
        if t == OrderChangeLineType.LINE_CANCEL.value:
            return OrderChangeCategory.CANCEL.value
        if t == OrderChangeLineType.LINE_ADD.value:
            return OrderChangeCategory.QUANTITY.value
    return OrderChangeCategory.MIXED.value


def line_amount(qty: Optional[Decimal], price: Optional[Decimal]) -> Decimal:
    q = Decimal(str(qty or 0))
    p = Decimal(str(price or 0))
    return (q * p).quantize(Decimal("0.01"))


def diff_sales_item(
    source_item: Any,
    after_quantity: Optional[Decimal],
    after_unit_price: Optional[Decimal],
    after_delivery_date: Optional[Any],
    line_cancel: bool = False,
) -> Tuple[str, Dict[str, Any]]:
    """比较单行，返回 change_type 与 before/after 字段"""
    before_qty = Decimal(str(getattr(source_item, "order_quantity", 0) or 0))
    before_price = Decimal(str(getattr(source_item, "unit_price", 0) or 0))
    before_date = getattr(source_item, "delivery_date", None)
    delivered = Decimal(str(getattr(source_item, "delivered_quantity", 0) or 0))

    if line_cancel:
        if delivered > 0:
            raise BusinessLogicError(f"物料 {getattr(source_item, 'material_code', '')} 已发货 {delivered}，不可取消行")
        return OrderChangeLineType.LINE_CANCEL.value, {
            "before_quantity": before_qty,
            "after_quantity": Decimal("0"),
            "before_unit_price": before_price,
            "after_unit_price": before_price,
            "before_delivery_date": before_date,
            "after_delivery_date": before_date,
        }

    new_qty = before_qty if after_quantity is None else Decimal(str(after_quantity))
    new_price = before_price if after_unit_price is None else Decimal(str(after_unit_price))
    new_date = before_date if after_delivery_date is None else after_delivery_date

    if new_qty < delivered:
        raise BusinessLogicError(
            f"物料 {getattr(source_item, 'material_code', '')} 新数量 {new_qty} 不能小于已发货 {delivered}"
        )

    changes: List[str] = []
    if new_qty != before_qty:
        changes.append(OrderChangeLineType.QUANTITY.value)
    if new_price != before_price:
        changes.append(OrderChangeLineType.UNIT_PRICE.value)
    if str(new_date) != str(before_date):
        changes.append(OrderChangeLineType.DELIVERY_DATE.value)

    if not changes:
        raise BusinessLogicError(f"物料 {getattr(source_item, 'material_code', '')} 无有效变更")

    change_type = changes[0] if len(changes) == 1 else OrderChangeLineType.QUANTITY.value
    return change_type, {
        "before_quantity": before_qty,
        "after_quantity": new_qty,
        "before_unit_price": before_price,
        "after_unit_price": new_price,
        "before_delivery_date": before_date,
        "after_delivery_date": new_date,
    }


def snapshot_sales_item(source_item: Any) -> Tuple[str, Dict[str, Any]]:
    """原单行快照（无变更）"""
    before_qty = Decimal(str(getattr(source_item, "order_quantity", 0) or 0))
    before_price = Decimal(str(getattr(source_item, "unit_price", 0) or 0))
    before_date = getattr(source_item, "delivery_date", None)
    return OrderChangeLineType.QUANTITY.value, {
        "before_quantity": before_qty,
        "after_quantity": before_qty,
        "before_unit_price": before_price,
        "after_unit_price": before_price,
        "before_delivery_date": before_date,
        "after_delivery_date": before_date,
    }


def snapshot_purchase_item(source_item: Any) -> Tuple[str, Dict[str, Any]]:
    before_qty = Decimal(str(getattr(source_item, "ordered_quantity", 0) or 0))
    before_price = Decimal(str(getattr(source_item, "unit_price", 0) or 0))
    before_date = getattr(source_item, "required_date", None)
    return OrderChangeLineType.QUANTITY.value, {
        "before_quantity": before_qty,
        "after_quantity": before_qty,
        "before_unit_price": before_price,
        "after_unit_price": before_price,
        "before_delivery_date": before_date,
        "after_delivery_date": before_date,
    }


def build_line_add_diff(
    after_quantity: Optional[Decimal],
    after_unit_price: Optional[Decimal],
    after_delivery_date: Optional[Any],
) -> Dict[str, Any]:
    qty = Decimal(str(after_quantity or 0))
    if qty <= 0:
        raise BusinessLogicError("新增行数量必须大于 0")
    price = Decimal(str(after_unit_price or 0))
    if price < 0:
        raise BusinessLogicError("新增行单价不能为负")
    return {
        "before_quantity": Decimal("0"),
        "after_quantity": qty,
        "before_unit_price": Decimal("0"),
        "after_unit_price": price,
        "before_delivery_date": None,
        "after_delivery_date": after_delivery_date,
    }


def resolve_sales_line_change(
    source_item: Any,
    payload: Any,
) -> Tuple[str, Dict[str, Any]]:
    if getattr(payload, "change_type", None) == OrderChangeLineType.LINE_ADD.value:
        return OrderChangeLineType.LINE_ADD.value, build_line_add_diff(
            payload.after_quantity,
            payload.after_unit_price,
            payload.after_delivery_date,
        )
    cancel = getattr(payload, "change_type", None) == OrderChangeLineType.LINE_CANCEL.value
    try:
        return diff_sales_item(
            source_item,
            payload.after_quantity,
            payload.after_unit_price,
            payload.after_delivery_date,
            line_cancel=cancel,
        )
    except BusinessLogicError as exc:
        if cancel or "无有效变更" not in str(exc):
            raise
        return snapshot_sales_item(source_item)


def resolve_purchase_line_change(
    source_item: Any,
    payload: Any,
) -> Tuple[str, Dict[str, Any]]:
    if getattr(payload, "change_type", None) == OrderChangeLineType.LINE_ADD.value:
        return OrderChangeLineType.LINE_ADD.value, build_line_add_diff(
            payload.after_quantity,
            payload.after_unit_price,
            payload.after_delivery_date,
        )
    cancel = getattr(payload, "change_type", None) == OrderChangeLineType.LINE_CANCEL.value
    try:
        return diff_purchase_item(
            source_item,
            payload.after_quantity,
            payload.after_unit_price,
            payload.after_delivery_date,
            line_cancel=cancel,
        )
    except BusinessLogicError as exc:
        if cancel or "无有效变更" not in str(exc):
            raise
        return snapshot_purchase_item(source_item)


def diff_purchase_item(
    source_item: Any,
    after_quantity: Optional[Decimal],
    after_unit_price: Optional[Decimal],
    after_delivery_date: Optional[Any],
    line_cancel: bool = False,
) -> Tuple[str, Dict[str, Any]]:
    before_qty = Decimal(str(getattr(source_item, "ordered_quantity", 0) or 0))
    before_price = Decimal(str(getattr(source_item, "unit_price", 0) or 0))
    before_date = getattr(source_item, "required_date", None)
    received = Decimal(str(getattr(source_item, "received_quantity", 0) or 0))

    if line_cancel:
        if received > 0:
            raise BusinessLogicError(f"物料 {getattr(source_item, 'material_code', '')} 已收货 {received}，不可取消行")
        return OrderChangeLineType.LINE_CANCEL.value, {
            "before_quantity": before_qty,
            "after_quantity": Decimal("0"),
            "before_unit_price": before_price,
            "after_unit_price": before_price,
            "before_delivery_date": before_date,
            "after_delivery_date": before_date,
        }

    new_qty = before_qty if after_quantity is None else Decimal(str(after_quantity))
    new_price = before_price if after_unit_price is None else Decimal(str(after_unit_price))
    new_date = before_date if after_delivery_date is None else after_delivery_date

    if new_qty < received:
        raise BusinessLogicError(
            f"物料 {getattr(source_item, 'material_code', '')} 新数量 {new_qty} 不能小于已收货 {received}"
        )

    changes: List[str] = []
    if new_qty != before_qty:
        changes.append(OrderChangeLineType.QUANTITY.value)
    if new_price != before_price:
        changes.append(OrderChangeLineType.UNIT_PRICE.value)
    if str(new_date) != str(before_date):
        changes.append(OrderChangeLineType.DELIVERY_DATE.value)

    if not changes:
        raise BusinessLogicError(f"物料 {getattr(source_item, 'material_code', '')} 无有效变更")

    change_type = changes[0] if len(changes) == 1 else OrderChangeLineType.QUANTITY.value
    return change_type, {
        "before_quantity": before_qty,
        "after_quantity": new_qty,
        "before_unit_price": before_price,
        "after_unit_price": new_price,
        "before_delivery_date": before_date,
        "after_delivery_date": new_date,
    }
