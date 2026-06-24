"""外协维保单 API 模块级契约（防漏 import 导致创建时 NameError）。"""

import importlib


def test_outsource_maintenance_sheet_rule_code_imported():
    mod = importlib.import_module("apps.haoligo.api.routes_mold_outsource_maintenance_sheet")
    assert mod.HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_SHEET_NO == "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_SHEET_NO"
