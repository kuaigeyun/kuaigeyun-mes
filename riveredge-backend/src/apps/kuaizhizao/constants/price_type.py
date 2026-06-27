"""销售价类常量（含税/不含税）。"""

DEFAULT_SALES_PRICE_TYPE = "tax_inclusive"

VALID_PRICE_TYPES = frozenset({"tax_inclusive", "tax_exclusive"})


def normalize_price_type(value: str | None, *, fallback: str = DEFAULT_SALES_PRICE_TYPE) -> str:
    pt = (value or "").strip()
    if pt in VALID_PRICE_TYPES:
        return pt
    return fallback
