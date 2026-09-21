"""Kingdee PRD_MO model builder tests for work-order push."""

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest

from apps.kuaizhizao.services.kingdee_production_order_push_service import (
    DEFAULT_FORM_ID,
    build_kingdee_production_order_model,
    work_order_push_skip_reason,
)
from apps.kuaizhizao.services.work_order_sync_service import (
    normalize_work_order_binding_sync_direction,
)
from core.services.integration.document_push_codes import apply_unit_code_map
from core.services.integration.kingdee_galaxy_api_presets import PRD_MO_DEFAULT_BILL_TYPE
from core.services.integration.kingdee_galaxy_push_adapter import KingdeeGalaxyPushAdapter


def _work_order(**overrides):
    base = dict(
        id=7,
        code="WO-20260915-001",
        name="测试工单",
        product_code="MAT-100",
        quantity=Decimal("12.5"),
        planned_start_date=datetime(2026, 9, 15, 8, 0),
        planned_end_date=datetime(2026, 9, 20, 18, 0),
        sales_order_code="SO-001",
        remarks="急单",
        created_at=datetime(2026, 9, 14, 10, 0),
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_build_kingdee_production_order_model_defaults():
    work_order = _work_order()

    model = build_kingdee_production_order_model(
        work_order=work_order,
        cfg={
            "org_number": "100",
            "unit_number": "Pcs",
            "workshop_number": "WS01",
        },
    )

    assert model["FDate"] == "2026-09-15"
    assert model["FBillNo"] == "WO-20260915-001"
    assert model["FBillType"]["FNUMBER"] == PRD_MO_DEFAULT_BILL_TYPE
    assert model["FPrdOrgId"]["FNumber"] == "100"
    assert model["FOwnerTypeId"] == "BD_OwnerOrg"
    assert model["FPPBOMType"] == "1"
    assert model["FTreeEntity"][0]["FMaterialId"]["FNumber"] == "MAT-100"
    assert model["FTreeEntity"][0]["FQty"] == 12.5
    assert model["FTreeEntity"][0]["FUnitId"]["FNumber"] == "Pcs"
    assert model["FTreeEntity"][0]["FBaseUnitId"]["FNumber"] == "Pcs"
    assert model["FTreeEntity"][0]["FWorkShopID"]["FNumber"] == "WS01"
    assert model["FTreeEntity"][0]["FPlanStartDate"] == "2026-09-15"
    assert model["FTreeEntity"][0]["FPlanFinishDate"] == "2026-09-20"
    assert model["FTreeEntity"][0]["FStockInOrgId"]["FNumber"] == "100"
    assert model["FTreeEntity"][0]["FSaleOrderNo"] == "SO-001"
    assert "快格云工单" in model["FDescription"]


def test_build_kingdee_production_order_model_omits_bill_no_when_disabled():
    work_order = _work_order()

    model = build_kingdee_production_order_model(
        work_order=work_order,
        cfg={"use_local_bill_no": False, "org_number": "100"},
    )

    assert "FBillNo" not in model


def test_build_kingdee_production_order_model_allows_fixed_values_override():
    work_order = _work_order()

    model = build_kingdee_production_order_model(
        work_order=work_order,
        cfg={
            "fixed_values": {
                "FTreeEntity.0.FCUSTOMQTY": 12.5,
                "FTreeEntity.0.FSourceType": "KUAIGE",
            },
        },
    )

    assert model["FTreeEntity"][0]["FCUSTOMQTY"] == 12.5
    assert model["FTreeEntity"][0]["FSourceType"] == "KUAIGE"
    assert "快格云工单" in model["FDescription"]


def test_build_kingdee_production_order_model_uses_stock_org_override():
    work_order = _work_order()

    model = build_kingdee_production_order_model(
        work_order=work_order,
        cfg={
            "prd_org_number": "100",
            "stock_org_number": "200",
        },
    )

    assert model["FPrdOrgId"]["FNumber"] == "100"
    assert model["FTreeEntity"][0]["FStockInOrgId"]["FNumber"] == "200"


def test_build_kingdee_mo_save_body_returns_fid_and_bill_no():
    body = KingdeeGalaxyPushAdapter().wrap_save(
        form_id=DEFAULT_FORM_ID,
        model={"FID": 0, "FTreeEntity": [{"FEntryID": 0}]},
    )

    assert body["format"] == 1
    assert body["parameters"][0] == DEFAULT_FORM_ID
    assert "FID" in body["parameters"][1]
    assert "FBillNo" in body["parameters"][1]
    assert "IgnoreInterationFlag" in body["parameters"][1]


@pytest.mark.parametrize(
    "direction,expected",
    [
        ("pull", "pull"),
        ("push", "pull"),
        ("bidirectional", "pull"),
        (None, "pull"),
    ],
)
def test_normalize_work_order_binding_sync_direction_forces_pull(direction, expected):
    assert normalize_work_order_binding_sync_direction(direction) == expected


def test_build_kingdee_production_order_model_applies_unit_code_map_via_cfg():
    work_order = _work_order()

    model = build_kingdee_production_order_model(
        work_order=work_order,
        cfg={
            "org_number": "100",
            # 调用方应先把本地单位解析/映射为金蝶 FNumber 再传入
            "unit_number": "004",
            "base_unit_number": "004",
        },
    )

    assert model["FTreeEntity"][0]["FUnitId"]["FNumber"] == "004"
    assert model["FTreeEntity"][0]["FBaseUnitId"]["FNumber"] == "004"


def test_apply_unit_code_map():
    assert apply_unit_code_map("kg", {"kg": "004", "台": "001"}) == "004"
    assert apply_unit_code_map("004", {}) == "004"
    assert apply_unit_code_map("个", {}) == "006"

    assert (
        work_order_push_skip_reason(
            SimpleNamespace(external_sync_at=datetime(2026, 9, 1), status="released"),
            already_pushed=False,
        )
        == "金蝶拉取导入的工单不可回推"
    )
    assert (
        work_order_push_skip_reason(
            SimpleNamespace(external_sync_at=None, status="released"),
            already_pushed=True,
        )
        == "已推送过金蝶生产订单"
    )
    assert work_order_push_skip_reason(
        SimpleNamespace(external_sync_at=None, status="draft"),
        already_pushed=False,
    )
    assert (
        work_order_push_skip_reason(
            SimpleNamespace(external_sync_at=None, status="released"),
            already_pushed=False,
        )
        is None
    )
