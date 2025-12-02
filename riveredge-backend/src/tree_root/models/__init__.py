"""
系统级数据模型模块

包含所有系统级功能的数据模型定义。
"""

# 基础模型
from .base import BaseModel

# 角色权限模型
from .role import Role
from .permission import Permission, PermissionType
from .role_permission import RolePermission
from .user_role import UserRole

# 组织架构模型
from .department import Department
from .position import Position

# 数据字典模型
from .data_dictionary import DataDictionary
from .dictionary_item import DictionaryItem

# 系统参数模型
from .system_parameter import SystemParameter

# 编码规则模型
from .code_rule import CodeRule
from .code_sequence import CodeSequence

# 自定义字段模型
from .custom_field import CustomField
from .custom_field_value import CustomFieldValue

# 站点设置模型
from .site_setting import SiteSetting
from .invitation_code import InvitationCode

# 语言管理模型
from .language import Language

# 应用中心模型
from .application import Application

# 集成设置模型
from .integration_config import IntegrationConfig

__all__ = [
    # 基础模型
    "BaseModel",
    # 角色权限模型
    "Role",
    "Permission",
    "PermissionType",
    "RolePermission",
    "UserRole",
    # 组织架构模型
    "Department",
    "Position",
    # 数据字典模型
    "DataDictionary",
    "DictionaryItem",
    # 系统参数模型
    "SystemParameter",
    # 编码规则模型
    "CodeRule",
    "CodeSequence",
    # 自定义字段模型
    "CustomField",
    "CustomFieldValue",
    # 站点设置模型
    "SiteSetting",
    "InvitationCode",
    # 语言管理模型
    "Language",
    # 应用中心模型
    "Application",
    # 集成设置模型
    "IntegrationConfig",
]

