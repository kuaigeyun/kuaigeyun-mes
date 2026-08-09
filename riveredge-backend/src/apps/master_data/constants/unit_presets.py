"""单位与全局换算预设（与历史 MATERIAL_UNIT 内置项对齐）。"""

from __future__ import annotations

from typing import TypedDict


class UnitPreset(TypedDict):
    code: str
    name: str
    description: str
    sort_order: int


class ConversionPreset(TypedDict):
    from_unit_code: str
    to_unit_code: str
    numerator: int
    denominator: int
    description: str


# 1 from = (numerator/denominator) × to
SYSTEM_UNIT_PRESETS: list[UnitPreset] = [
    {"code": "个", "name": "个", "description": "件数", "sort_order": 1},
    {"code": "件", "name": "件", "description": "件数", "sort_order": 2},
    {"code": "台", "name": "台", "description": "设备/整机", "sort_order": 3},
    {"code": "套", "name": "套", "description": "成套", "sort_order": 4},
    {"code": "箱", "name": "箱", "description": "包装", "sort_order": 5},
    {"code": "包", "name": "包", "description": "包装", "sort_order": 6},
    {"code": "千克", "name": "千克", "description": "重量", "sort_order": 7},
    {"code": "克", "name": "克", "description": "重量", "sort_order": 8},
    {"code": "吨", "name": "吨", "description": "重量", "sort_order": 9},
    {"code": "米", "name": "米", "description": "长度", "sort_order": 10},
    {"code": "毫米", "name": "毫米", "description": "长度", "sort_order": 11},
    {"code": "平方米", "name": "平方米", "description": "面积", "sort_order": 12},
    {"code": "升", "name": "升", "description": "容积", "sort_order": 13},
    {"code": "立方米", "name": "立方米", "description": "容积", "sort_order": 14},
]

SYSTEM_CONVERSION_PRESETS: list[ConversionPreset] = [
    {
        "from_unit_code": "千克",
        "to_unit_code": "克",
        "numerator": 1000,
        "denominator": 1,
        "description": "1千克=1000克",
    },
    {
        "from_unit_code": "吨",
        "to_unit_code": "千克",
        "numerator": 1000,
        "denominator": 1,
        "description": "1吨=1000千克",
    },
    {
        "from_unit_code": "米",
        "to_unit_code": "毫米",
        "numerator": 1000,
        "denominator": 1,
        "description": "1米=1000毫米",
    },
    {
        "from_unit_code": "立方米",
        "to_unit_code": "升",
        "numerator": 1000,
        "denominator": 1,
        "description": "1立方米=1000升",
    },
]
