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

# 菜单管理模型
from .menu import Menu

# 集成设置模型
from .integration_config import IntegrationConfig

# 文件管理模型
from .file import File

# 接口管理模型
from .api import API

# 数据源管理模型
from .data_source import DataSource

# 数据集管理模型
from .dataset import Dataset

# 消息管理模型
from .message_config import MessageConfig
from .message_template import MessageTemplate
from .message_log import MessageLog

# 定时任务模型
from .scheduled_task import ScheduledTask

# 审批流程模型
from .approval_process import ApprovalProcess
from .approval_instance import ApprovalInstance
from .approval_history import ApprovalHistory

# 脚本管理模型
from .script import Script

# 打印模板模型
from .print_template import PrintTemplate

# 打印设备模型
from .print_device import PrintDevice
from .user_preference import UserPreference

# 操作日志模型
from .operation_log import OperationLog

# 登录日志模型
from .login_log import LoginLog

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
    # 文件管理模型
    "File",
    # 接口管理模型
    "API",
    # 数据源管理模型
    "DataSource",
    # 数据集管理模型
    "Dataset",
    # 消息管理模型
    "MessageConfig",
    "MessageTemplate",
    "MessageLog",
    # 定时任务模型
    "ScheduledTask",
    # 审批流程模型
    "ApprovalProcess",
    "ApprovalInstance",
    # 脚本管理模型
    "Script",
    # 打印模板模型
    "PrintTemplate",
    # 打印设备模型
    "PrintDevice",
    "UserPreference",
    # 操作日志模型
    "OperationLog",
    # 登录日志模型
    "LoginLog",
    # 菜单管理模型
    "Menu",
]

