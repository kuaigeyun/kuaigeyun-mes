"""中文序号（合同条款等短序号，非金额大写）。"""

from __future__ import annotations

_DIGITS = "零一二三四五六七八九"


def int_to_chinese_simple(n: int) -> str:
    """
    阿拉伯序号转中文小写数字。
    1→一，10→十，11→十一，20→二十。
    """
    if n <= 0:
        raise ValueError("n must be positive")
    if n < 10:
        return _DIGITS[n]
    if n == 10:
        return "十"
    if n < 20:
        return "十" + _DIGITS[n % 10]
    if n < 100:
        tens, ones = divmod(n, 10)
        text = _DIGITS[tens] + "十"
        if ones:
            text += _DIGITS[ones]
        return text
    return str(n)
