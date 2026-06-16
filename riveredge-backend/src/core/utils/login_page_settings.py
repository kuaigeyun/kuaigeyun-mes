"""登录页左栏视觉层配置校验。"""

from typing import Any, Mapping, Optional


def is_login_visual_layer_enabled(value: Any, *, default: bool = True) -> bool:
    if value is None:
        return default
    return bool(value)


def validate_login_visual_layers(
    decoration_enabled: bool,
    background_enabled: bool,
    *,
    message: str = "登录页装饰图与背景至少需开启一项",
) -> None:
    if not decoration_enabled and not background_enabled:
        raise ValueError(message)


def resolve_login_visual_layers(
    payload: Mapping[str, Any],
    current: Optional[Mapping[str, Any]] = None,
) -> tuple[bool, bool]:
    current = current or {}
    decoration_enabled = is_login_visual_layer_enabled(
        payload.get("login_decoration_enabled", current.get("login_decoration_enabled")),
    )
    background_enabled = is_login_visual_layer_enabled(
        payload.get("login_background_enabled", current.get("login_background_enabled")),
    )
    return decoration_enabled, background_enabled
