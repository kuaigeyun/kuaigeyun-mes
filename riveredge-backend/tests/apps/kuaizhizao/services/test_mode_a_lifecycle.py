"""Mode A 单据 lifecycle 与审核剥离（全局规范回归）。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_lifecycle_service import (
    get_demand_lifecycle,
    get_incoming_inspection_lifecycle,
    get_production_plan_lifecycle,
    get_purchase_order_lifecycle,
    get_reporting_record_lifecycle,
    get_sales_delivery_lifecycle,
    get_sales_order_change_lifecycle,
    get_sales_order_lifecycle,
    get_shipment_notice_lifecycle,
)


def _assert_pre_effective(lc: dict) -> None:
    assert lc["current_stage_name"] == "—"
    assert lc["current_stage_key"] == ""
    assert all(s["status"] == "pending" for s in lc["main_stages"])
    assert not any(s["label"] in {"草稿", "待审核", "已驳回", "已审核"} for s in lc["main_stages"])


@pytest.mark.parametrize(
    "factory",
    [
        lambda: get_sales_order_lifecycle(SimpleNamespace(status="草稿", review_status="PENDING")),
        lambda: get_sales_order_lifecycle(SimpleNamespace(status="待审核", review_status="PENDING")),
        lambda: get_sales_order_lifecycle(SimpleNamespace(status="已审核", review_status="APPROVED")),
        lambda: get_demand_lifecycle(SimpleNamespace(status="草稿", review_status="PENDING", pushed_to_computation=False)),
        lambda: get_purchase_order_lifecycle(SimpleNamespace(status="待审核", review_status="PENDING")),
        lambda: get_production_plan_lifecycle(SimpleNamespace(status="草稿", review_status="PENDING", execution_status="未执行")),
        lambda: get_sales_order_change_lifecycle("待审核", "PENDING"),
        lambda: get_incoming_inspection_lifecycle(SimpleNamespace(status="已检验", review_status="PENDING")),
        lambda: get_reporting_record_lifecycle(SimpleNamespace(status="pending")),
        lambda: get_shipment_notice_lifecycle(SimpleNamespace(status="待审核")),
        lambda: get_sales_delivery_lifecycle(SimpleNamespace(status="待审核")),
    ],
)
def test_mode_a_pre_effective_shows_dash(factory):
    _assert_pre_effective(factory())


def test_sales_order_effective_shows_business_stage():
    lc = get_sales_order_lifecycle(
        SimpleNamespace(status="已生效", review_status="APPROVED"),
    )
    assert lc["current_stage_name"] == "已生效"
    assert lc["main_stages"][0]["label"] == "已生效"


def test_demand_pushed_shows_business_stage():
    lc = get_demand_lifecycle(
        SimpleNamespace(status="已审核", review_status="APPROVED", pushed_to_computation=True),
    )
    assert lc["current_stage_name"] == "已下推计算"


def test_reporting_approved_shows_recorded():
    lc = get_reporting_record_lifecycle(SimpleNamespace(status="approved"))
    assert lc["current_stage_name"] == "已报工"


def test_shipment_notice_effective_shows_pending_ship():
    lc = get_shipment_notice_lifecycle(SimpleNamespace(status="待发货"))
    assert lc["current_stage_name"] == "待发货"
    assert lc["current_stage_key"] == "pending_ship"


def test_sales_delivery_effective_shows_pending_outbound():
    lc = get_sales_delivery_lifecycle(SimpleNamespace(status="待出库"))
    assert lc["current_stage_name"] == "待出库"
    assert lc["current_stage_key"] == "pending_outbound"
