"""快制造应用启动注册。"""

from __future__ import annotations

from apps.kuaizhizao.authorization.data_scope_setup import register_kuaizhizao_data_scope_profiles
from apps.kuaizhizao.reference_display.setup import register_kuaizhizao_reference_display_providers


def register() -> None:
    register_kuaizhizao_data_scope_profiles()
    register_kuaizhizao_reference_display_providers()
