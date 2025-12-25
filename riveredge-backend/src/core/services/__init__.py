"""
系统级业务服务模块

包含所有系统级功能的业务逻辑处理，按业务领域分类组织。
"""

# 用户管理服务
from .user.user_service import UserService
from .user.user_profile_service import UserProfileService
from .user.user_preference_service import UserPreferenceService
from .user.user_message_service import UserMessageService
from .user.user_task_service import UserTaskService

# 权限管理服务
from .authorization.role_service import RoleService
from .authorization.permission_service import PermissionService
from .authorization.position_service import PositionService

# 组织架构服务
from .organization.department_service import DepartmentService

# 系统配置服务
from .system.system_parameter_service import SystemParameterService
from .system.site_setting_service import SiteSettingService
from .system.language_service import LanguageService
from .system.menu_service import MenuService

# 数据管理服务
from .data.dataset_service import DatasetService
from .data.data_source_service import DataSourceService
from .data.data_dictionary_service import DataDictionaryService
from .data.data_backup_service import DataBackupService

# 文件管理服务
from .file.file_service import FileService
from .file.file_preview_service import FilePreviewService

# 审批流程服务
from .approval.approval_process_service import ApprovalProcessService
from .approval.approval_instance_service import ApprovalInstanceService
from .approval.approval_history_service import ApprovalHistoryService

# 消息通知服务
from .messaging.message_service import MessageService
from .messaging.message_config_service import MessageConfigService
from .messaging.message_template_service import MessageTemplateService

# 日志审计服务
from .logging.operation_log_service import OperationLogService
from .logging.login_log_service import LoginLogService
from .logging.online_user_service import OnlineUserService

# 任务调度服务
from .scheduling.scheduled_task_service import ScheduledTaskService
from .scheduling.script_service import ScriptService

# 打印管理服务
from .print.print_template_service import PrintTemplateService
from .print.print_device_service import PrintDeviceService

# 业务规则服务
from .business.code_rule_service import CodeRuleService
from .business.code_generation_service import CodeGenerationService
from .business.custom_field_service import CustomFieldService

# 应用管理服务
from .application.application_service import ApplicationService
from .application.api_service import APIService

# 集成配置服务
from .integration.integration_config_service import IntegrationConfigService

# 帮助系统服务
from .help.help_document_service import HelpDocumentService

# 邀请管理服务
from .invitation.invitation_code_service import InvitationCodeService

# 插件管理服务
from .plugin_manager.plugin_manager import PluginManagerService
from .plugin_manager.plugin_discovery import PluginDiscoveryService
from .plugin_manager.plugin_loader import PluginLoaderService

__all__ = [
    # 用户管理
    "UserService",
    "UserProfileService",
    "UserPreferenceService",
    "UserMessageService",
    "UserTaskService",

    # 权限管理
    "RoleService",
    "PermissionService",
    "PositionService",

    # 组织架构
    "DepartmentService",

    # 系统配置
    "SystemParameterService",
    "SiteSettingService",
    "LanguageService",
    "MenuService",

    # 数据管理
    "DatasetService",
    "DataSourceService",
    "DataDictionaryService",
    "DataBackupService",

    # 文件管理
    "FileService",
    "FilePreviewService",

    # 审批流程
    "ApprovalProcessService",
    "ApprovalInstanceService",
    "ApprovalHistoryService",

    # 消息通知
    "MessageService",
    "MessageConfigService",
    "MessageTemplateService",

    # 日志审计
    "OperationLogService",
    "LoginLogService",
    "OnlineUserService",

    # 任务调度
    "ScheduledTaskService",
    "ScriptService",

    # 打印管理
    "PrintTemplateService",
    "PrintDeviceService",

    # 业务规则
    "CodeRuleService",
    "CodeGenerationService",
    "CustomFieldService",

    # 应用管理
    "ApplicationService",
    "APIService",

    # 集成配置
    "IntegrationConfigService",

    # 帮助系统
    "HelpDocumentService",

    # 邀请管理
    "InvitationCodeService",

    # 插件管理
    "PluginManagerService",
    "PluginDiscoveryService",
    "PluginLoaderService",
]

