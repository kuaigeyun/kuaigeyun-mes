import sys
import types
from decimal import Decimal

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services.purchase_service import PurchaseService


@pytest.mark.unit
def test_purchase_price_fluctuation_should_block_when_exceed_limit():
    material = types.SimpleNamespace(
        id=1,
        code="MAT-001",
        main_code="MAT-001",
        defaults={"purchase": {"standard_price": "100"}},
        source_config={},
    )

    with pytest.raises(BusinessLogicError, match="采购单价偏差"):
        PurchaseService._validate_purchase_price_fluctuation_for_material(
            material=material,
            unit_price=Decimal("130"),
            fluctuation_limit_percent=20.0,
        )


@pytest.mark.unit
def test_purchase_price_fluctuation_should_pass_within_limit():
    material = types.SimpleNamespace(
        id=1,
        code="MAT-001",
        main_code="MAT-001",
        defaults={"purchase": {"purchase_price": "100"}},
        source_config={},
    )

    PurchaseService._validate_purchase_price_fluctuation_for_material(
        material=material,
        unit_price=Decimal("118"),
        fluctuation_limit_percent=20.0,
    )


@pytest.mark.unit
def test_purchase_price_fluctuation_should_skip_when_no_benchmark():
    material = types.SimpleNamespace(
        id=2,
        code="MAT-002",
        main_code="MAT-002",
        defaults=None,
        source_config={},
    )

    PurchaseService._validate_purchase_price_fluctuation_for_material(
        material=material,
        unit_price=Decimal("999"),
        fluctuation_limit_percent=5.0,
    )
