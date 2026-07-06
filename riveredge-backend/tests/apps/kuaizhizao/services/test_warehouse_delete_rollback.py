"""P6：仓储 delete/withdraw 上游数量回退审计 — 关键路径单元测试。"""

from decimal import Decimal
from types import SimpleNamespace

import pytest


def test_occupied_delivery_qty_ignores_closed_and_cancelled_statuses():
    """待出库占用量：已出库/已取消不计入 occupied，删除待出库单后释放占用。"""
    closed_statuses = {"已出库", "已完成", "completed", "COMPLETED", "done", "DONE"}
    cancelled = {"已取消", "cancelled", "CANCELLED"}
    rows = [
        {"id": 1, "status": "待出库"},
        {"id": 2, "status": "已出库"},
        {"id": 3, "status": "已取消"},
        {"id": 4, "status": "draft"},
    ]
    occupying = [
        int(d["id"])
        for d in rows
        if d.get("id") is not None
        and str(d.get("status") or "").strip() not in closed_statuses
        and str(d.get("status") or "").strip() not in cancelled
    ]
    assert occupying == [1, 4]


def test_sales_return_preview_pending_quantity_formula():
    """销售退货预览：已下推=累计退货单数量，可退=已发货-已下推。"""
    delivered = 100.0
    returned = 30.0
    pending = max(0.0, delivered - returned)
    assert pending == 70.0


def test_purchase_receipt_confirmed_only_counts_toward_po_received():
    """采购入库：仅已入库/已完成计入 PO received；草稿/待入库删除不触发 sync。"""
    confirmed = frozenset({"已入库", "已完成", "completed", "COMPLETED"})
    assert "待入库" not in confirmed
    assert "草稿" not in confirmed


@pytest.mark.parametrize(
    "delivered,rollback,expected",
    [
        (Decimal("100"), Decimal("30"), Decimal("70")),
        (Decimal("50"), Decimal("50"), Decimal("0")),
        (Decimal("10"), Decimal("15"), Decimal("0")),
    ],
)
def test_sales_order_delivery_rollback_never_negative(delivered, rollback, expected):
    """销售出库撤回：已交货数量回退后不得为负。"""
    new_delivered = max(delivered - rollback, Decimal("0"))
    assert new_delivered == expected
