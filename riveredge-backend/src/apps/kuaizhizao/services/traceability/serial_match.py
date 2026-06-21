"""
序列号 JSON 字段匹配工具（与入库明细存储格式一致）
"""

import json
from typing import Any, List


def parse_serial_numbers(serial_numbers: Any) -> List[str]:
    if serial_numbers is None:
        return []
    if isinstance(serial_numbers, list):
        return [str(x).strip() for x in serial_numbers if str(x).strip()]
    if isinstance(serial_numbers, str):
        text = serial_numbers.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except json.JSONDecodeError:
            return [seg.strip() for seg in text.split(",") if seg.strip()]
    return []


def serial_numbers_contain(serial_numbers: Any, serial_no: str) -> bool:
    target = (serial_no or "").strip()
    if not target:
        return False
    return target in parse_serial_numbers(serial_numbers)
