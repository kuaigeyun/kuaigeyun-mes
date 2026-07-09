"""好力 GO 财务 — 金额/单价精度常量。

展示与比对以 unit_price_literal（原文）为唯一真源；
Decimal 字段仅用于数值运算，容量需覆盖超长小数。
"""

# PostgreSQL NUMERIC 最大精度 1000；预留整数位，小数最多 500 位
FINANCE_UNIT_PRICE_MAX_DIGITS = 1000
FINANCE_UNIT_PRICE_DECIMAL_PLACES = 500
# 单价原文字符串最大长度（含整数位与小数点）
FINANCE_UNIT_PRICE_LITERAL_MAX_LEN = 1024
