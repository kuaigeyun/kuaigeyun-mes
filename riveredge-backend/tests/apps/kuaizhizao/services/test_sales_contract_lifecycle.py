"""销售合同 lifecycle 与审核剥离。"""

from types import SimpleNamespace

from apps.kuaizhizao.services.document_lifecycle_service import get_sales_contract_lifecycle


def _contract(**kwargs):
    defaults = {
        "status": "草稿",
        "review_status": "PENDING",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_pre_effective_lifecycle_shows_dash_not_draft():
    lc = get_sales_contract_lifecycle(_contract(status="待审核", review_status="PENDING"))
    assert lc["current_stage_name"] == "—"
    assert lc["current_stage_key"] == ""
    assert all(s["status"] == "pending" for s in lc["main_stages"])
    assert not any(s["label"] == "草稿" for s in lc["main_stages"])


def test_draft_lifecycle_shows_dash():
    lc = get_sales_contract_lifecycle(_contract(status="草稿", review_status="PENDING"))
    assert lc["current_stage_name"] == "—"


def test_rejected_lifecycle_shows_dash_not_rejected_label():
    lc = get_sales_contract_lifecycle(_contract(status="草稿", review_status="REJECTED"))
    assert lc["current_stage_name"] == "—"
    assert not any(s["label"] == "草稿" for s in lc["main_stages"])


def test_effective_lifecycle():
    lc = get_sales_contract_lifecycle(_contract(status="已生效", review_status="APPROVED"))
    assert lc["current_stage_key"] == "effective"
    assert lc["current_stage_name"] == "已生效"
    assert lc["main_stages"][0]["label"] == "已生效"
