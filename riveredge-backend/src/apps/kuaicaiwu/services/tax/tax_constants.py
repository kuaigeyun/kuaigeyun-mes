"""税务模块常量与默认配置（租户可在税务设置中覆盖）。"""

from __future__ import annotations

from typing import Any, Dict, List

DEFAULT_TAX_RATES: List[Dict[str, Any]] = [
    {"rate": 13, "label": "13%", "is_active": True},
    {"rate": 9, "label": "9%", "is_active": True},
    {"rate": 6, "label": "6%", "is_active": True},
    {"rate": 3, "label": "3%", "is_active": True},
    {"rate": 1, "label": "1%", "is_active": True},
    {"rate": 0, "label": "0%", "is_active": True},
    {"rate": -1, "label": "免税", "is_active": True},
]

DEFAULT_SURCHARGE_RATES: Dict[str, float] = {
    "urban_construction": 7.0,
    "education": 3.0,
    "local_education": 2.0,
}

# 2221 下增值税明细科目（4-2-2-2：222101 + 22210101…）
VAT_DETAIL_ACCOUNTS: List[Dict[str, Any]] = [
    {"account_code": "222101", "account_name": "应交增值税", "parent_code": "2221", "is_leaf": False},
    {"account_code": "22210101", "account_name": "销项税额", "parent_code": "222101", "is_leaf": True},
    {"account_code": "22210102", "account_name": "进项税额", "parent_code": "222101", "is_leaf": True},
    {"account_code": "22210103", "account_name": "进项税额转出", "parent_code": "222101", "is_leaf": True},
    {"account_code": "22210104", "account_name": "已交税金", "parent_code": "222101", "is_leaf": True},
    {"account_code": "22210105", "account_name": "转出未交增值税", "parent_code": "222101", "is_leaf": True},
]

SURCHARGE_ACCOUNTS: List[Dict[str, Any]] = [
    {"account_code": "222102", "account_name": "应交城市维护建设税", "parent_code": "2221", "is_leaf": True},
    {"account_code": "222103", "account_name": "应交教育费附加", "parent_code": "2221", "is_leaf": True},
    {"account_code": "222104", "account_name": "应交地方教育附加", "parent_code": "2221", "is_leaf": True},
]

ACCOUNT_BINDING_KEYS = (
    "output_vat",
    "input_vat",
    "input_transfer_out",
    "paid_vat",
    "transfer_unpaid_vat",
    "urban_construction",
    "education",
    "local_education",
    "tax_surcharge_expense",
)

VERIFICATION_PENDING = "pending"
VERIFICATION_CERTIFIED = "certified"
VERIFICATION_TRANSFERRED_OUT = "transferred_out"
VERIFICATION_NOT_DEDUCTIBLE = "not_deductible"

TAXPAYER_GENERAL = "general"
TAXPAYER_SMALL_SCALE = "small_scale"
