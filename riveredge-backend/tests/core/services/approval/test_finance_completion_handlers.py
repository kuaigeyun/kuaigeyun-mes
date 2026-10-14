"""应收应付审批完成回调须调用正确 Service，禁止虚构 FinanceService。"""

from pathlib import Path


def test_finance_completion_handlers_use_real_service_classes():
    src = Path(__file__).resolve().parents[4] / (
        "src/core/services/approval/approval_instance_service.py"
    )
    text = src.read_text(encoding="utf-8")
    assert "from apps.kuaicaiwu.services.finance_service import FinanceService" not in text
    assert "from apps.kuaicaiwu.services.finance_service import PayableService" in text
    assert "from apps.kuaicaiwu.services.finance_service import ReceivableService" in text
    assert "from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService" in text
    assert "is_auto_approve=True" in text
