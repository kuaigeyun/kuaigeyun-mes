"""平台客户端产品注册表（client_key 唯一真源）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

CLIENT_KEY_HAOLIGO: Final = "haoligo"
CLIENT_KEY_TOUCH_TERMINAL_WINDOWS: Final = "touch-terminal-windows"
CLIENT_KEY_TOUCH_TERMINAL_ANDROID: Final = "touch-terminal-android"


@dataclass(frozen=True)
class ClientProductSpec:
    client_key: str
    display_name: str
    app_code: str | None
    client_kind: str
    platform_target: str
    supports_ota: bool
    login_tile_slot: str  # none | windows | android
    sort_order: int


DEFAULT_CLIENT_PRODUCTS: tuple[ClientProductSpec, ...] = (
    ClientProductSpec(
        client_key=CLIENT_KEY_HAOLIGO,
        display_name="好力 GO 移动端",
        app_code="haoligo",
        client_kind="mobile_app",
        platform_target="android",
        supports_ota=True,
        login_tile_slot="none",
        sort_order=10,
    ),
    ClientProductSpec(
        client_key=CLIENT_KEY_TOUCH_TERMINAL_WINDOWS,
        display_name="触屏工位机终端",
        app_code="kuaizhizao",
        client_kind="touch_terminal",
        platform_target="windows",
        supports_ota=False,
        login_tile_slot="windows",
        sort_order=20,
    ),
    ClientProductSpec(
        client_key=CLIENT_KEY_TOUCH_TERMINAL_ANDROID,
        display_name="移动端 PDA",
        app_code="kuaizhizao",
        client_kind="handheld_pda",
        platform_target="android",
        supports_ota=False,
        login_tile_slot="android",
        sort_order=30,
    ),
)
