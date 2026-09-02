"""物料批号有效期解析（保质期 + 入库生产日期）。"""

from datetime import date
from types import SimpleNamespace

from apps.master_data.services.material_batch_service import MaterialBatchService


def test_resolve_batch_expiry_from_shelf_life():
    material = SimpleNamespace(shelf_life_managed=True, shelf_life_days=180)
    prod = date(2026, 9, 2)
    assert MaterialBatchService.resolve_batch_expiry_date(
        material=material,
        production_date=prod,
        explicit_expiry=None,
    ) == date(2027, 3, 1)


def test_resolve_batch_expiry_explicit_over_shelf_life():
    material = SimpleNamespace(shelf_life_managed=True, shelf_life_days=30)
    explicit = date(2028, 1, 1)
    assert MaterialBatchService.resolve_batch_expiry_date(
        material=material,
        production_date=date(2026, 9, 2),
        explicit_expiry=explicit,
    ) == explicit


def test_resolve_batch_expiry_without_shelf_life_returns_none():
    material = SimpleNamespace(shelf_life_managed=False, shelf_life_days=None)
    assert MaterialBatchService.resolve_batch_expiry_date(
        material=material,
        production_date=date(2026, 9, 2),
        explicit_expiry=None,
    ) is None


def test_resolve_inbound_item_expiry_prefers_explicit():
    material = SimpleNamespace(shelf_life_managed=True, shelf_life_days=10)
    explicit = date(2026, 12, 31)
    assert MaterialBatchService.resolve_inbound_item_expiry_date(
        material=material,
        production_date=date(2026, 9, 2),
        explicit_expiry=explicit,
    ) == explicit
