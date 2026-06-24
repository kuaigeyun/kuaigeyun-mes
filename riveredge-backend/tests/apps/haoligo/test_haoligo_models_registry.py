"""HaoliGO Tortoise 模型包注册契约（防 __all__ 声明但未 import 导致 ConfigurationError）。"""

import importlib


def test_equipment_upkeep_models_registered_in_package():
    mod = importlib.import_module("apps.haoligo.models")
    assert hasattr(mod, "HaoligoEquipmentUpkeepSheet")
    assert hasattr(mod, "HaoligoEquipmentUpkeepCompleteSheet")
    assert mod.HaoligoEquipmentUpkeepSheet is not None
    assert mod.HaoligoEquipmentUpkeepCompleteSheet is not None
