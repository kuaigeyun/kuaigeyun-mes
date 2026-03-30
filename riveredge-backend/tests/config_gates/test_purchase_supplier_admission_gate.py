import sys
import types

import pytest

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError
from apps.kuaizhizao.services.purchase_service import PurchaseService


@pytest.mark.unit
def test_supplier_admission_should_block_when_buy_material_mismatch_default_supplier():
    material = types.SimpleNamespace(
        id=1,
        code="MAT-001",
        main_code="MAT-001",
        source_type="Buy",
        source_config={"source_config": {"default_supplier_id": 1001}},
    )
    with pytest.raises(BusinessLogicError, match="不在准入清单"):
        PurchaseService._validate_supplier_admission_for_material(
            supplier_id=2002,
            supplier_name="供应商B",
            material=material,
        )


@pytest.mark.unit
def test_supplier_admission_should_pass_when_buy_material_matches_default_supplier():
    material = types.SimpleNamespace(
        id=1,
        code="MAT-001",
        main_code="MAT-001",
        source_type="Buy",
        source_config={"source_config": {"default_supplier_id": "1001"}},
    )
    PurchaseService._validate_supplier_admission_for_material(
        supplier_id=1001,
        supplier_name="供应商A",
        material=material,
    )


@pytest.mark.unit
def test_supplier_admission_should_pass_for_non_buy_material():
    material = types.SimpleNamespace(
        id=2,
        code="MAT-002",
        main_code="MAT-002",
        source_type="Make",
        source_config={"source_config": {"default_supplier_id": 1001}},
    )
    PurchaseService._validate_supplier_admission_for_material(
        supplier_id=2002,
        supplier_name="供应商B",
        material=material,
    )
