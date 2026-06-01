import pytest

from apps.master_data.schemas.supply_chain_schemas import CustomerCreate, CustomerUpdate


def test_customer_create_pool_status_defaults_to_pool() -> None:
    payload = CustomerCreate(code="C001", name="客户A")
    assert payload.pool_status == "pool"


def test_customer_update_rejects_invalid_pool_status() -> None:
    with pytest.raises(ValueError):
        CustomerUpdate(poolStatus="invalid")

