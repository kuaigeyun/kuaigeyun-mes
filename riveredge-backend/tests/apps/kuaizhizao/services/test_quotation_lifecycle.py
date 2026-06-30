"""报价单 lifecycle 计算单元测试。"""

from __future__ import annotations

from types import SimpleNamespace

from apps.kuaizhizao.services.document_lifecycle_service import get_quotation_lifecycle


def _q(**kwargs):
    defaults = {
        "status": "已接受",
        "review_status": "审核通过",
        "sales_order_id": None,
        "contract_id": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_accepted_with_contract_shows_converted_stage():
    lc = get_quotation_lifecycle(
        _q(status="已接受", contract_id=42),
        contract_downstream_missing=False,
    )
    assert lc["current_stage_key"] == "converted"
    assert lc["current_stage_name"] == "已转订单"
    assert lc["status"] == "success"


def test_accepted_without_contract_stays_customer_confirmed():
    lc = get_quotation_lifecycle(_q(status="已接受"))
    assert lc["current_stage_key"] == "customer_confirmed"
    assert lc["current_stage_name"] == "客户确认"


def test_accepted_with_stale_contract_stays_customer_confirmed():
    lc = get_quotation_lifecycle(
        _q(status="已接受", contract_id=42),
        contract_downstream_missing=True,
    )
    assert lc["current_stage_key"] == "customer_confirmed"
    assert lc["current_stage_name"] == "客户确认"
