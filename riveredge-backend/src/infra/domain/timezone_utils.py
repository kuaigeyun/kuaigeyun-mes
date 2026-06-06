"""
时区工具模块（兼容层）

统一从 core.utils.timezone_utils 导入，保持向后兼容。
"""

from core.utils.timezone_utils import (
    now,
    now_utc,
    today_str,
    make_aware,
    to_naive_utc,
)

__all__ = ["now", "now_utc", "today_str", "make_aware", "to_naive_utc"]
