"""
行业应用清单（免费版 / 付费版唯一真源）。

- 免费版：主仓 riveredge 发布，无需 License Key
- 付费版：私仓 kuaigeyun-pro 维护，启用需 License Key（与专业版应用同一套授权流程）

与前端 industryAppCatalog.ts 保持一致。
"""

from __future__ import annotations

from typing import FrozenSet

FREE_INDUSTRY_APP_CODES: FrozenSet[str] = frozenset(
    {
        "spoke-wheel",
    }
)

# 行业免费版原作者 GitHub（与 manifest author / author_github 一致）
FREE_INDUSTRY_AUTHOR_GITHUB: dict[str, str] = {
    "spoke-wheel": "xyt123lyq",
}

PRO_INDUSTRY_APP_CODES: FrozenSet[str] = frozenset(
    {
        "kuaimachinery",
        "kuaimolding",
        "kuaielectronics",
        "kuaiautoparts",
        "kuaimedical",
        "kuaifood",
        "kuaipackaging",
        "kuaihardware",
        "kuaidiecasting",
        "kuaiwiring",
        "kuaimotor",
        "kuaibattery",
        "kuainewequipment",
        "kuaisheetmetal",
        "kuaimold",
        "kuaisemiconductor",
    }
)

ALL_INDUSTRY_APP_CODES: FrozenSet[str] = FREE_INDUSTRY_APP_CODES | PRO_INDUSTRY_APP_CODES


def is_free_industry_app_code(app_code: str | None) -> bool:
    return str(app_code or "") in FREE_INDUSTRY_APP_CODES


def is_pro_industry_app_code(app_code: str | None) -> bool:
    return str(app_code or "") in PRO_INDUSTRY_APP_CODES


def is_industry_app_code(app_code: str | None) -> bool:
    return str(app_code or "") in ALL_INDUSTRY_APP_CODES


def requires_pro_license_for_app(app_code: str | None, *, is_pro: bool = False) -> bool:
    """专业版应用或付费行业应用启用前需 License Key。"""
    if is_pro:
        return True
    return is_pro_industry_app_code(app_code)
