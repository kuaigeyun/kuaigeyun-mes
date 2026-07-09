"""财务单价 Decimal 字段：禁止 Tortoise 默认 quantize（decimal_places=500 会 InvalidOperation）。"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

from tortoise.fields import DecimalField


class FinanceUnitPriceDecimalField(DecimalField):
    """
    单价数值列。展示/比对以 *_literal TEXT 为准。
    读写不做 quantize；读回时 normalize 去掉 NUMERIC 固定 scale 填充的尾零。
    DB 类型用无约束 NUMERIC，避免固定 decimal_places 填充。
    """

    # asyncpg 已返回 Decimal 时仍走 to_python_value，避免跳过 normalize
    skip_to_python_if_native = False

    @property
    def SQL_TYPE(self) -> str:  # type: ignore[override]
        return "NUMERIC"

    def to_python_value(self, value: Any) -> Optional[Decimal]:
        if value is not None:
            if not isinstance(value, Decimal):
                value = Decimal(str(value))
            # 去掉 PG NUMERIC(p,s) 读回时的填充尾零；不改变有效数字
            value = value.normalize()
        self.validate(value)
        return value

    def to_db_value(self, value: Any, instance) -> Any:
        if value is not None and not isinstance(value, Decimal):
            value = Decimal(str(value))
        self.validate(value)
        return value
