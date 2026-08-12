"""Mode A 单据 lifecycle 与审核剥离（全局规范回归）。"""

from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.document_lifecycle_service import (
    get_demand_lifecycle,
    get_incoming_inspection_lifecycle,
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
        lambda: get_reporting_record_lifecycle(SimpleNamespace(status="pending")),
        lambda: get_shipment_notice_lifecycle(SimpleNamespace(status="待审核")),
        lambda: get_sales_delivery_lifecycle(SimpleNamespace(status="待审核")),
    ],
)
def test_mode_a_pre_effective_shows_dash(factory):
    _assert_pre_effective(factory())


def test_incoming_inspection_pending_ignores_preset_approved_review():
    """未开人工审核时创建预置 APPROVED，阶段仍应为待检验。"""
    lc = get_incoming_inspection_lifecycle(
        SimpleNamespace(status="待检验", review_status="APPROVED", inspection_result="待检验"),
    )
    assert lc["current_stage_key"] == "pending_inspection"
    assert lc["current_stage_name"] == "待检验"


def test_incoming_inspection_inspected_before_manual_audit():
    lc = get_incoming_inspection_lifecycle(
        SimpleNamespace(status="已检验", review_status="PENDING", inspection_result="已检验"),
    )
    assert lc["current_stage_key"] == "inspected"
    assert lc["current_stage_name"] == "已检验"


def test_incoming_inspection_audited_shows_inspected_stage():
    lc = get_incoming_inspection_lifecycle(
        SimpleNamespace(status="已审核", review_status="APPROVED", inspection_result="已检验"),
    )
    assert lc["current_stage_key"] == "inspected"
    assert lc["current_stage_name"] == "已检验"


def test_sales_order_effective_shows_business_stage():
    lc = get_sales_order_lifecycle(
        SimpleNamespace(status="已生效", review_status="APPROVED"),
    )
    assert lc["current_stage_name"] == "已生效"
    assert lc["main_stages"][0]["label"] == "已生效"


def test_demand_effective_shows_business_stage():
    lc = get_demand_lifecycle(
        SimpleNamespace(status="已审核", review_status="APPROVED", pushed_to_computation=False),
    )
    assert lc["current_stage_name"] == "已生效"
    assert lc["current_stage_key"] == "effective"
    assert [s["key"] for s in lc["main_stages"]] == ["effective", "pushed"]
    assert lc["main_stages"][0]["status"] == "active"
    assert lc["main_stages"][1]["status"] == "pending"


def test_demand_pushed_shows_business_stage():
    lc = get_demand_lifecycle(
        SimpleNamespace(status="已审核", review_status="APPROVED", pushed_to_computation=True),
    )
    assert lc["current_stage_name"] == "已下推计算"
    assert lc["main_stages"][0]["status"] == "done"
    assert lc["main_stages"][1]["status"] == "active"


def test_reporting_approved_shows_recorded():
    lc = get_reporting_record_lifecycle(SimpleNamespace(status="approved"))
    assert lc["current_stage_name"] == "已报工"


def test_shipment_notice_effective_shows_pending_ship():
    lc = get_shipment_notice_lifecycle(SimpleNamespace(status="待发货"))
    assert lc["current_stage_name"] == "待发货"
    assert lc["current_stage_key"] == "pending_ship"


def test_shipment_notice_linked_pending_delivery_stays_notified():
    """通知仓库已生成待出库单时，生命周期仍为已通知，不得显示已出库。"""
    lc = get_shipment_notice_lifecycle(
        SimpleNamespace(status="已通知", sales_delivery_id=99, sales_delivery_code="XSFH1")
    )
    assert lc["current_stage_key"] == "notified"
    assert lc["current_stage_name"] == "已通知"


def test_shipment_notice_shipped_status_shows_shipped():
    lc = get_shipment_notice_lifecycle(
        SimpleNamespace(status="已出库", sales_delivery_id=99)
    )
    assert lc["current_stage_key"] == "shipped"
    assert lc["current_stage_name"] == "已出库"


def test_sales_delivery_effective_shows_pending_outbound():
    lc = get_sales_delivery_lifecycle(SimpleNamespace(status="待出库"))
    assert lc["current_stage_name"] == "待出库"
    assert lc["current_stage_key"] == "pending_outbound"


def test_order_change_draft_shows_pending_apply():
    lc = get_sales_order_change_lifecycle("草稿", "PENDING")
    assert lc["current_stage_name"] == "待生效"
    assert lc["current_stage_key"] == "pending_apply"
    assert [s["key"] for s in lc["main_stages"]] == ["pending_apply", "applied"]
    assert lc["main_stages"][0]["status"] == "active"
    assert lc["main_stages"][1]["status"] == "pending"


def test_order_change_pending_review_shows_pending_apply():
    lc = get_sales_order_change_lifecycle("待审核", "PENDING")
    assert lc["current_stage_name"] == "待生效"
    assert lc["current_stage_key"] == "pending_apply"


def test_order_change_applied_shows_applied_stage():
    lc = get_sales_order_change_lifecycle("已生效", "APPROVED", applied_at="2026-01-01")
    assert lc["current_stage_name"] == "已生效"
    assert lc["current_stage_key"] == "applied"
    assert lc["main_stages"][0]["status"] == "done"
    assert lc["main_stages"][1]["status"] == "active"


def test_order_change_rejected_shows_rejected():
    lc = get_sales_order_change_lifecycle("已驳回", "REJECTED")
    assert lc["current_stage_name"] == "已驳回"
    assert lc["status"] == "exception"
