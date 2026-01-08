"""
数据模型模块

导出所有数据模型，便于统一导入
"""

from infra.models.base import BaseModel
from infra.models.user import User
from infra.models.tenant import Tenant, TenantStatus, TenantPlan
from infra.models.tenant_config import TenantConfig
from infra.models.tenant_activity_log import TenantActivityLog
from infra.models.package import Package
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.models.industry_template import IndustryTemplate
from infra.models.platform_settings import PlatformSettings

__all__ = [
    "BaseModel",
    "User",
    "Tenant",
    "TenantStatus",
    "TenantPlan",
    "TenantConfig",
    "TenantActivityLog",
    "Package",
    "InfraSuperAdmin",
    "IndustryTemplate",
    "PlatformSettings",
]

