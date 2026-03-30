import sys
import types

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services.sales_order_service import SalesOrderService


@pytest.mark.unit
def test_sales_status_should_normalize_pending_review():
    service = SalesOrderService()
    assert service._is_pending_review_status("PENDING_REVIEW") is True
    assert service._is_pending_review_status("待审核") is True
    assert service._is_pending_review_status("PENDING") is True
    assert service._is_pending_review_status("DRAFT") is False


@pytest.mark.unit
def test_sales_review_status_should_normalize_approved_and_pending():
    service = SalesOrderService()
    assert service._is_review_approved("APPROVED") is True
    assert service._is_review_approved("审核通过") is True
    assert service._is_review_approved("已通过") is True
    assert service._is_review_pending("PENDING") is True
    assert service._is_review_pending("待审核") is True
