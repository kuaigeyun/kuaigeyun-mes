"""
数据模型模块

导出所有数据模型，便于统一导入
"""

from soil.models.base import BaseModel
from soil.models.user import User
from soil.models.tenant import Tenant, TenantStatus, TenantPlan
from soil.models.tenant_config import TenantConfig
from soil.models.tenant_activity_log import TenantActivityLog
from soil.models.package import Package
from soil.models.platform_superadmin import PlatformSuperAdmin

__all__ = [
    "BaseModel",
    "User",
    "Tenant",
    "TenantStatus",
    "TenantPlan",
    "TenantConfig",
    "TenantActivityLog",
    "Package",
    "PlatformSuperAdmin",
]

