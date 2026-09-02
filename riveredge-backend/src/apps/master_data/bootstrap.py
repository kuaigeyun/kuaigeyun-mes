"""主数据应用启动注册。"""

from __future__ import annotations

from apps.master_data.authorization.data_scope_setup import register_master_data_data_scope_profiles
from apps.master_data.reference_display.setup import register_master_data_reference_display_providers


def register() -> None:
    register_master_data_data_scope_profiles()
    register_master_data_reference_display_providers()
