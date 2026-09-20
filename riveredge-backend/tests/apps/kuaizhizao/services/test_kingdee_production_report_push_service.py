from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from apps.kuaizhizao.services.kingdee_production_report_push_service import (
    DEFAULT_FORM_ID,
    build_kingdee_production_report_model,
)
from core.services.integration.kingdee_galaxy_push_adapter import KingdeeGalaxyPushAdapter


def test_build_kingdee_production_report_model_defaults():
    record = SimpleNamespace(
        id=12,
        work_order_code="MO-001",
        operation_code="OP10",
        operation_name="装配",
        reported_quantity=Decimal("3"),
        qualified_quantity=Decimal("2"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("1.5"),
        worker_name="张三",
        team_name=None,
        remarks="夜班",
        reported_at=datetime(2026, 9, 11, 8, 30),
        approved_at=None,
        created_at=None,
    )
    work_order = SimpleNamespace(product_code="MAT-001", product_name="成品A")
    operation = SimpleNamespace(workshop_name="一车间", work_center_name="总装线")

    model = build_kingdee_production_report_model(
        record=record,
        work_order=work_order,
        operation=operation,
        cfg={
            "org_number": "100",
            "unit_number": "Pcs",
            "workshop_number": "WS01",
            "time_unit_id": "1",
            "stand_hour_unit_id": "1",
        },
    )

    assert model["FDate"] == "2026-09-11"
    assert model["FBillType"]["FNUMBER"] == "SCHBD02_SYS"
    assert model["FPrdOrgId"]["FNumber"] == "100"
    assert model["FWorkshipIdH"]["FNumber"] == "WS01"
    assert "FStockOrgId" not in model
    assert "FProcessId" not in model["FEntity"][0]
    assert "FRealQty" not in model["FEntity"][0]
    assert model["FEntity"][0]["FMoBillNo"] == "MO-001"
    assert model["FEntity"][0]["FMaterialId"]["FNumber"] == "MAT-001"
    assert model["FEntity"][0]["FReportType"]["FNumber"] == "HBLX01_SYS"
    assert model["FEntity"][0]["FFinishQty"] == 3.0
    assert model["FEntity"][0]["FQuaQty"] == 2.0
    assert model["FEntity"][0]["FFailQty"] == 1.0
    assert model["FEntity"][0]["FHrWorkTime"] == 1.5
    assert model["FEntity"][0]["FUnitID"]["FNumber"] == "Pcs"
    assert model["FEntity"][0]["FWorkshipId"]["FNumber"] == "WS01"
    assert model["FEntity"][0]["FTimeUnitId"] == "1"
    assert model["FEntity"][0]["FStandHourUnitId"] == "1"
    assert model["FEntity"][0]["FStockInOrgId"]["FNumber"] == "100"
    assert "快格云报工" in model["FEntity"][0]["FDescriptionE"]


def test_build_kingdee_production_report_model_allows_stock_in_org_via_field_map():
    record = SimpleNamespace(
        id=12,
        work_order_code="MO-001",
        operation_code="OP10",
        operation_name="装配",
        reported_quantity=Decimal("3"),
        qualified_quantity=Decimal("2"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("1.5"),
        worker_name="张三",
        team_name=None,
        remarks=None,
        reported_at=datetime(2026, 9, 11, 8, 30),
        approved_at=None,
        created_at=None,
    )

    model = build_kingdee_production_report_model(
        record=record,
        work_order=None,
        operation=None,
        cfg={
            "org_number": "100",
            "stock_org_number": "200",
        },
    )

    assert model["FPrdOrgId"]["FNumber"] == "100"
    assert "FStockOrgId" not in model
    assert model["FEntity"][0]["FStockInOrgId"]["FNumber"] == "200"


def test_build_kingdee_production_report_model_allows_fixed_values_override():
    record = SimpleNamespace(
        id=12,
        work_order_code="MO-001",
        operation_code="OP10",
        operation_name="装配",
        reported_quantity=Decimal("3"),
        qualified_quantity=Decimal("2"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("1.5"),
        worker_name="张三",
        team_name=None,
        remarks=None,
        reported_at=datetime(2026, 9, 11, 8, 30),
        approved_at=None,
        created_at=None,
    )

    model = build_kingdee_production_report_model(
        record=record,
        work_order=None,
        operation=None,
        cfg={
            "fixed_values": {
                "FEntity.0.FCUSTOMQTY": 2.0,
                "FEntity.0.FOperator": "张三",
                "FEntity.0.FSourceType": "KUAIGE",
            },
        },
    )

    assert model["FEntity"][0]["FCUSTOMQTY"] == 2.0
    assert model["FEntity"][0]["FOperator"] == "张三"
    assert model["FEntity"][0]["FSourceType"] == "KUAIGE"


def test_build_kingdee_save_body_returns_fid_and_bill_no():
    body = KingdeeGalaxyPushAdapter().wrap_save(
        form_id=DEFAULT_FORM_ID,
        model={"FID": 0, "FEntity": [{}]},
    )

    assert body["format"] == 1
    assert body["parameters"][0] == DEFAULT_FORM_ID
    assert "FID" in body["parameters"][1]
    assert "FBillNo" in body["parameters"][1]
    assert "IgnoreInterationFlag" in body["parameters"][1]
