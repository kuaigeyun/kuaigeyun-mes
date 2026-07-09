"""人民币金额转中文大写（材料验收单打印）。"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP


def amount_to_cn_uppercase(amount: Decimal | float | int | str) -> str:
    """将金额转为人民币大写，如 358360 -> 叁拾伍万捌仟叁佰陆拾元整。"""
    value = Decimal(str(amount)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if value < 0:
        raise ValueError("金额不能为负")
    if value == 0:
        return "零元整"

    digits = "零壹贰叁肆伍陆柒捌玖"
    units = ["", "拾", "佰", "仟"]
    big_units = ["", "万", "亿"]

    def _section_to_cn(n: int) -> str:
        if n == 0:
            return ""
        s = ""
        zero = False
        for i in range(4):
            d = (n // (10 ** (3 - i))) % 10
            if d == 0:
                zero = True
            else:
                if zero and s:
                    s += "零"
                zero = False
                s += digits[d] + units[3 - i]
        return s.rstrip("零")

    integer_part = int(value)
    fraction = int((value - integer_part) * 100)

    parts: list[str] = []
    if integer_part == 0:
        parts.append("零")
    else:
        sections: list[int] = []
        n = integer_part
        while n > 0:
            sections.insert(0, n % 10000)
            n //= 10000
        for idx, sec in enumerate(sections):
            sec_cn = _section_to_cn(sec)
            if not sec_cn:
                if parts and parts[-1] != "零":
                    parts.append("零")
                continue
            big = big_units[len(sections) - 1 - idx]
            parts.append(sec_cn + big)
        result = "".join(parts).replace("零零", "零").strip("零")
        parts = [result or "零"]

    jiao = fraction // 10
    fen = fraction % 10
    body = parts[0] + "元"
    if jiao == 0 and fen == 0:
        return body + "整"
    if jiao > 0:
        body += digits[jiao] + "角"
    elif fen > 0:
        body += "零"
    if fen > 0:
        body += digits[fen] + "分"
    return body
