"""人民币金额转中文大写（合同/验收单等打印）。"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def amount_to_cn_uppercase(amount: Decimal | float | int | str | None) -> str:
    """将金额转为人民币大写，如 358360 -> 叁拾伍万捌仟叁佰陆拾元整。无效/空值返回空串。"""
    if amount is None:
        return ""
    if isinstance(amount, str) and not amount.strip():
        return ""
    try:
        normalized = str(amount).strip().replace(",", "")
        value = Decimal(normalized).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return ""
    if value < 0:
        return ""
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

    cents = int(value * 100)
    integer_part = cents // 100
    fraction = cents % 100

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


def _rmb_uppercase_for_print(amount: object, currency_code: object) -> str:
    code = str(currency_code or "CNY").strip().upper()
    if code != "CNY":
        return ""
    return amount_to_cn_uppercase(amount)  # type: ignore[arg-type]


def enrich_print_amount_uppercase_fields(document_data: dict) -> None:
    """补齐打印模板常用的大写字段，避免模板引用时 Jinja 严格模式报错。"""
    currency_code = document_data.get("currency_code")
    amount_keys = (
        ("total_amount", "total_amount_uppercase"),
        ("released_amount", "released_amount_uppercase"),
        ("remaining_amount", "remaining_amount_uppercase"),
    )
    for amount_key, uppercase_key in amount_keys:
        document_data[uppercase_key] = _rmb_uppercase_for_print(
            document_data.get(amount_key),
            currency_code,
        )
