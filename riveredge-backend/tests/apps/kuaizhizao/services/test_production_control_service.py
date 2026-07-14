"""Production control service unit tests."""

from datetime import datetime

from apps.kuaizhizao.schemas.production_control import DeliveryRiskItem
from apps.kuaizhizao.services.production_control_service import ProductionControlService


def test_normalize_delivery_risk_row_converts_datetime_to_string():
    row = ProductionControlService._normalize_delivery_risk_row(
        {
            "work_order_id": 1,
            "work_order_code": "WO-001",
            "product_name": "Product A",
            "status": "released",
            "planned_end_date": datetime(2026, 5, 10, 18, 0, 0),
            "delay_days": 3,
        },
        risk_type="delayed",
        risk_desc="已延期 3 天",
    )
    item = DeliveryRiskItem.model_validate(row)
    assert item.planned_end_date == "2026-05-10 18:00:00"
    assert item.risk_type == "delayed"
