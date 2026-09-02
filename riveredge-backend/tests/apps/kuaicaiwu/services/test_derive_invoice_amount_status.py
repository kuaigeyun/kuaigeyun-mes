from decimal import Decimal

from apps.kuaicaiwu.schemas.finance import ReceivableResponse


def test_receivable_response_accepts_negative_invoiced_amount():
    payload = ReceivableResponse.model_validate(
        {
            "id": 1,
            "tenant_id": 1,
            "receivable_code": "AR20260901001",
            "source_type": "sales_order",
            "source_id": 1,
            "source_code": "SO20260901001",
            "customer_id": 1,
            "customer_name": "测试客户",
            "total_amount": Decimal("1000.00"),
            "received_amount": Decimal("0"),
            "remaining_amount": Decimal("1000.00"),
            "status": "未结清",
            "review_status": "已审核",
            "business_date": "2026-09-01",
            "due_date": "2026-10-01",
            "invoiced_amount": Decimal("-888.00"),
            "remaining_invoice_amount": Decimal("1888.00"),
            "invoice_status": "未开票",
            "created_at": "2026-09-01T00:00:00",
            "updated_at": "2026-09-01T00:00:00",
        }
    )
    assert payload.invoiced_amount == Decimal("-888.00")
