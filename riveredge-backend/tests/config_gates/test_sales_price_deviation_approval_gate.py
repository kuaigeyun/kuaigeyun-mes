import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from apps.kuaizhizao.services import sales_order_service
from apps.kuaizhizao.services.sales_order_service import SalesOrderService


class _NoopTx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _ItemsQuery:
    def __init__(self, items):
        self._items = items

    async def all(self):
        return self._items


@pytest.mark.unit
@pytest.mark.asyncio
async def test_price_deviation_should_require_approval_when_exceed_threshold(monkeypatch):
    service = SalesOrderService()

    async def _get_threshold(_tenant_id: int) -> float:
        return 10.0

    service.business_config_service.get_sales_price_deviation_approval_threshold_percent = _get_threshold

    item = types.SimpleNamespace(material_id=1, material_code="MAT-001", material_name="物料A", unit_price=Decimal("120"))
    material = types.SimpleNamespace(id=1, defaults={"defaultSalePrice": 100})

    class _SalesOrderItem:
        @staticmethod
        def filter(**_kwargs):
            return _ItemsQuery([item])

    class _Material:
        @staticmethod
        def filter(**_kwargs):
            return _ItemsQuery([material])

    monkeypatch.setattr(sales_order_service, "SalesOrderItem", _SalesOrderItem)
    monkeypatch.setattr(sales_order_service, "Material", _Material)

    required, reason = await service._check_price_deviation_requires_approval(
        tenant_id=1,
        sales_order_id=1,
    )
    assert required is True
    assert reason is not None
    assert "超过阈值" in reason


@pytest.mark.unit
@pytest.mark.asyncio
async def test_submit_should_not_auto_approve_when_price_deviation_requires_approval(monkeypatch):
    service = SalesOrderService()

    order = types.SimpleNamespace(
        id=1,
        uuid="u-1",
        status="DRAFT",
        customer_id=10,
        customer_name="客户A",
        total_amount=Decimal("100"),
        order_code="SO-001",
    )
    updates = []

    async def _get_order(*_args, **_kwargs):
        return order

    async def _noop(*_args, **_kwargs):
        return None

    async def _check_audit_required(_tenant_id: int, _node_key: str) -> bool:
        return False

    async def _force_approval(**_kwargs):
        return True, "偏差超限"

    async def _approve_should_not_run(*_args, **_kwargs):
        raise AssertionError("命中价格偏差审批阈值时不应自动审核")

    class _OrderQuery:
        @staticmethod
        async def update(**kwargs):
            updates.append(kwargs)
            return None

    def _order_filter(**_kwargs):
        return _OrderQuery()

    async def _get_user_name(self, _user_id: int):
        return "测试用户"

    async def _start_approval(**_kwargs):
        return None

    monkeypatch.setattr(service, "get_sales_order_by_id", _get_order)
    monkeypatch.setattr(service, "_validate_customer_credit_limit_before_release", _noop)
    monkeypatch.setattr(service, "_validate_sales_order_margin_before_release", _noop)
    monkeypatch.setattr(service, "_check_price_deviation_requires_approval", _force_approval)
    monkeypatch.setattr(service.business_config_service, "check_audit_required", _check_audit_required)
    monkeypatch.setattr(service, "approve_sales_order", _approve_should_not_run)
    monkeypatch.setattr(service, "_log_state_transition", _noop)
    monkeypatch.setattr(service, "_sync_demand_if_exists", _noop)
    monkeypatch.setattr(sales_order_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(sales_order_service.SalesOrder, "filter", _order_filter)
    monkeypatch.setattr("apps.base_service.AppBaseService.get_user_name", _get_user_name)
    monkeypatch.setattr(
        "core.services.approval.approval_instance_service.ApprovalInstanceService.start_approval",
        _start_approval,
    )

    await service.submit_sales_order(
        tenant_id=1,
        sales_order_id=1,
        submitted_by=100,
    )

    assert updates
    assert updates[0]["status"] == sales_order_service.DemandStatus.PENDING_REVIEW
    assert updates[0]["review_status"] == sales_order_service.ReviewStatus.PENDING

