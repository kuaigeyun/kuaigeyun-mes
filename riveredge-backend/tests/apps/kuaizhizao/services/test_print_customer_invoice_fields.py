import pytest

from apps.kuaizhizao.services.print_service import (
    _empty_customer_invoice_print_fields,
    _resolve_customer_invoice_print_fields,
)


@pytest.mark.asyncio
async def test_resolve_customer_invoice_print_fields_without_customer_id():
    result = await _resolve_customer_invoice_print_fields(1, None)
    assert result == _empty_customer_invoice_print_fields()


@pytest.mark.asyncio
async def test_resolve_customer_invoice_print_fields_missing_customer(monkeypatch):
    async def _missing(*_args, **_kwargs):
        return None

    from apps.master_data.models import customer as customer_module

    monkeypatch.setattr(customer_module.Customer, "get_or_none", _missing)
    result = await _resolve_customer_invoice_print_fields(1, 999)
    assert result["invoice_title"] == ""
