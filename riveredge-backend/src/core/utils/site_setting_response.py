"""站点设置 API 响应脱敏（公司印章等敏感配置）。"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict


def mask_company_seal_for_response(
    settings: Dict[str, Any],
    *,
    include_seal_value: bool,
) -> Dict[str, Any]:
    """
    公司印章 UUID 仅对具备站点设置读权限的用户返回；
    其他用户仅可见 company_seal_configured 布尔标记。
    """
    if not settings:
        return settings

    result = deepcopy(settings)
    raw = str(result.get("company_seal") or "").strip()
    result["company_seal_configured"] = bool(raw)
    if not include_seal_value:
        result.pop("company_seal", None)
    return result


def mask_private_vault_for_response(settings: Dict[str, Any]) -> Dict[str, Any]:
    """保密文件二次密码哈希不得经站点设置 API 泄露。"""
    if not settings:
        return settings
    result = deepcopy(settings)
    configured = bool(str(result.pop("private_files_password_hash", "") or "").strip())
    result["private_files_password_configured"] = configured
    return result
