"""
应用中心分类与组织自主启停权限（唯一真源）。

- 分类：基础 / 专业 / 行业 / 定制
- 组织级开关存 infra_tenant_configs（默认全部关闭）
- 套餐 allow_pro_apps 为 PRO/付费行业硬顶，优先于组织开关
"""

from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from core.config.industry_app_catalog import is_industry_app_code, is_pro_industry_app_code
from core.config.industry_pack import is_industry_pack_shell_code
from core.config.pro_app_catalog import PRO_APP_CODES

AppCenterCategory = Literal["basic", "pro", "industry", "dedicated"]

APPLICATION_CENTER_PERMISSION_CONFIG_KEY = "application_center.category_self_service"

BASE_APP_CODES = frozenset(
    {
        "kuaizhizao",
        "kuaiplm",
        "kuaicaiwu",
        "kuaioa",
        "master-data",
    }
)

ALL_CATEGORIES: tuple[AppCenterCategory, ...] = ("basic", "industry", "pro", "dedicated")


def default_category_permissions() -> Dict[str, Dict[str, bool]]:
    """组织未配置时：各分类均不允许组织管理员自主启停。"""
    return {
        cat: {"allow_self_service_toggle": False}
        for cat in ALL_CATEGORIES
    }


def normalize_category_permissions(raw: Any) -> Dict[str, Dict[str, bool]]:
    base = default_category_permissions()
    if not isinstance(raw, dict):
        return base
    for cat in ALL_CATEGORIES:
        block = raw.get(cat)
        if isinstance(block, dict):
            base[cat]["allow_self_service_toggle"] = bool(
                block.get("allow_self_service_toggle", False)
            )
    return base


def resolve_app_center_category(
    app_code: str,
    *,
    is_dedicated: bool = False,
    manifest_is_pro: bool = False,
) -> AppCenterCategory:
    if is_dedicated:
        return "dedicated"
    code = str(app_code or "")
    if is_industry_pack_shell_code(code) or is_industry_app_code(code):
        return "industry"
    if code in PRO_APP_CODES or manifest_is_pro:
        return "pro"
    if code in BASE_APP_CODES:
        return "basic"
    return "basic"
