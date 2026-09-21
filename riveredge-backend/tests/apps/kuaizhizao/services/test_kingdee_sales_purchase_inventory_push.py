"""销售/采购/库存 DocumentPush model builder 单测。"""

from datetime import date, datetime
from decimal import Decimal
from types import SimpleNamespace

from apps.kuaizhizao.services.kingdee_inventory_push_service import (
    build_kingdee_inventory_misc_in_model,
    material_batch_push_skip_reason,
)
from apps.kuaizhizao.services.kingdee_purchase_order_push_service import (
    build_kingdee_purchase_order_model,
    purchase_order_push_skip_reason,
)
from apps.kuaizhizao.services.kingdee_sales_order_push_service import (
    build_kingdee_sales_order_model,
    sales_order_push_skip_reason,
)
from apps.kuaizhizao.services.document_push_service import SUPPORTED_PROFILES


def test_supported_profiles_include_sales_purchase_inventory():
    assert ("sales_order", "kingdee_sal_saleorder") in SUPPORTED_PROFILES
    assert ("purchase_order", "kingdee_pur_purchaseorder") in SUPPORTED_PROFILES
    assert ("material_batch", "kingdee_stk_miscellaneous") in SUPPORTED_PROFILES


def test_build_kingdee_sales_order_model():
    order = SimpleNamespace(
        id=1,
        order_code="SO-001",
        order_date=date(2026, 9, 1),
        delivery_date=date(2026, 9, 10),
        notes="急",
        created_at=datetime(2026, 9, 1),
        customer_id=9,
    )
    items = [
        SimpleNamespace(
            material_code="MAT-1",
            material_unit="个",
            order_quantity=Decimal("2"),
            unit_price=Decimal("10"),
            tax_rate=Decimal("13"),
            delivery_date=date(2026, 9, 10),
            notes=None,
        )
    ]
    model = build_kingdee_sales_order_model(
        order=order,
        items=items,
        cfg={"org_number": "100", "api_unit_code_map": {"个": "006"}},
        customer_number="CUST01",
    )
    assert model["FBillNo"] == "SO-001"
    assert model["FCustId"]["FNumber"] == "CUST01"
    assert model["FSaleOrderEntry"][0]["FMaterialId"]["FNumber"] == "MAT-1"
    assert model["FSaleOrderEntry"][0]["FQty"] == 2.0
    assert model["FSaleOrderEntry"][0]["FUnitID"]["FNumber"] == "006"


def test_sales_order_skip_external_sync():
    order = SimpleNamespace(
        external_sync_at=datetime.utcnow(),
        review_status="APPROVED",
        status="CONFIRMED",
    )
    assert sales_order_push_skip_reason(order) == "金蝶拉取导入的销售订单不可回推"


def test_build_kingdee_purchase_order_model():
    order = SimpleNamespace(
        id=2,
        order_code="PO-001",
        order_date=date(2026, 9, 2),
        delivery_date=date(2026, 9, 12),
        notes=None,
        created_at=datetime(2026, 9, 2),
        tax_rate=Decimal("13"),
        supplier_id=3,
    )
    items = [
        SimpleNamespace(
            material_code="RAW-1",
            unit="kg",
            ordered_quantity=Decimal("5"),
            unit_price=Decimal("3"),
            required_date=date(2026, 9, 12),
            notes=None,
        )
    ]
    model = build_kingdee_purchase_order_model(
        order=order,
        items=items,
        cfg={"org_number": "100", "api_unit_code_map": {"kg": "004"}},
        supplier_number="VEN01",
    )
    assert model["FBillNo"] == "PO-001"
    assert model["FSupplierId"]["FNumber"] == "VEN01"
    assert model["FPOOrderEntry"][0]["FQty"] == 5.0
    assert model["FPOOrderEntry"][0]["FUnitId"]["FNumber"] == "004"


def test_purchase_order_skip_already_pushed():
    order = SimpleNamespace(external_sync_at=None, review_status="APPROVED", status="CONFIRMED")
    assert purchase_order_push_skip_reason(order, already_pushed=True) == "已推送过金蝶采购订单"


def test_build_kingdee_inventory_misc_in_model():
    batch = SimpleNamespace(
        id=88,
        quantity=Decimal("12"),
        batch_no="B001",
        warehouse_name="原料仓",
        updated_at=datetime(2026, 9, 15),
        created_at=datetime(2026, 9, 1),
        status="in_stock",
    )
    model = build_kingdee_inventory_misc_in_model(
        batch=batch,
        material_code="MAT-9",
        stock_number="CK01",
        cfg={"org_number": "100", "unit_number": "006"},
    )
    assert model["FEntity"][0]["FMATERIALID"]["FNumber"] == "MAT-9"
    assert model["FEntity"][0]["FSTOCKID"]["FNumber"] == "CK01"
    assert model["FEntity"][0]["FQty"] == 12.0
    assert model["FEntity"][0]["FLot"]["FNumber"] == "B001"


def test_material_batch_skip_zero_qty():
    batch = SimpleNamespace(quantity=0, status="in_stock")
    assert material_batch_push_skip_reason(batch, material_code="M1") == "库存数量为 0，跳过推送"
