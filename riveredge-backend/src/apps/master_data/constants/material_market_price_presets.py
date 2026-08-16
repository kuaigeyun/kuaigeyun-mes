"""国内金属厂常用现货品种（手输行情编码，不绑定物料）。"""

from __future__ import annotations

from typing import TypedDict


class MarketPricePreset(TypedDict):
    code: str
    name: str


# 长江/SMM 口径常见牌号，供「加载预设」勾选后写入当日行情行。
MARKET_PRICE_PRESETS: list[MarketPricePreset] = [
    {"code": "CU-1", "name": "1#电解铜"},
    {"code": "ALU-A00", "name": "A00铝"},
    {"code": "ZN-0", "name": "0#锌"},
    {"code": "PB-1", "name": "1#铅"},
    {"code": "NI-1", "name": "1#电解镍"},
    {"code": "SN-1", "name": "1#锡"},
    {"code": "SS-304", "name": "304不锈钢"},
    {"code": "CU-BRIGHT", "name": "光亮铜"},
    {"code": "ALU-SCRAP", "name": "废铝"},
    {"code": "HR-COIL", "name": "热轧卷板"},
]
