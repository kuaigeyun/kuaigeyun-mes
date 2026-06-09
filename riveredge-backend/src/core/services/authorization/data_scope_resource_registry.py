"""按资源注册数据范围字段画像（应用启动时注册，非硬编码在 DataScopeService 内）。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DataScopeResourceProfile:
    """描述某 RBAC 资源在 ORM 行上的范围字段映射。"""

    applicant_user_id_field: str = "applicant_user_id"
    department_uuid_field: Optional[str] = "department_uuid"
    created_by_user_id_field: Optional[str] = None
    partner_code_field: Optional[str] = None
    partner_dimension: Optional[str] = None
    """无数据策略配置时的默认解析器（scope_custom resolver 名）；禁止在业务 service 内手写行过滤。"""
    no_policy_default_resolver: Optional[str] = None


_PROFILES: dict[str, DataScopeResourceProfile] = {}


def normalize_resource_key(resource: str) -> str:
    return (resource or "").strip().lower()


def register_resource_profile(resource: str, profile: DataScopeResourceProfile) -> None:
    key = normalize_resource_key(resource)
    if not key:
        raise ValueError("resource 不能为空")
    _PROFILES[key] = profile


def get_resource_profile(resource: str) -> DataScopeResourceProfile:
    key = normalize_resource_key(resource)
    return _PROFILES.get(key) or DataScopeResourceProfile()
