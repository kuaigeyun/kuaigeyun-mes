"""轻财务应用启动注册。"""

from __future__ import annotations

from apps.kuaicaiwu.reference_display.setup import register_kuaicaiwu_reference_display_providers


def register() -> None:
    register_kuaicaiwu_reference_display_providers()
