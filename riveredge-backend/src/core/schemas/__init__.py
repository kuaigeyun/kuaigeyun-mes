"""
系统级数据验证模块（Pydantic Schema）

包含所有系统级功能的 Schema 定义，用于请求/响应数据验证。
"""

# 基础Schema
from .base import BaseSchema

# 角色权限 Schema
from .role import RoleCreate, RoleUpdate, RoleResponse, RoleListResponse
from .permission import PermissionResponse, PermissionListResponse

# 组织架构 Schema
from .department import DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentTreeResponse
from .position import PositionCreate, PositionUpdate, PositionResponse, PositionListResponse

# 账户 Schema（扩展）
from .user import UserCreate, UserUpdate, UserResponse, UserListResponse, UserImport, UserExport

# 数据字典 Schema
from .data_dictionary import DataDictionaryCreate, DataDictionaryUpdate, DataDictionaryResponse
from .dictionary_item import DictionaryItemCreate, DictionaryItemUpdate, DictionaryItemResponse

# 系统参数 Schema
from .system_parameter import SystemParameterCreate, SystemParameterUpdate, SystemParameterResponse

# 编码规则 Schema
from .code_rule import (
    CodeRuleCreate,
    CodeRuleUpdate,
    CodeRuleResponse,
    CodeGenerationRequest,
    CodeGenerationResponse,
)

# 自定义字段 Schema
from .custom_field import (
    CustomFieldCreate,
    CustomFieldUpdate,
    CustomFieldResponse,
    CustomFieldValueRequest,
    CustomFieldValueResponse,
    BatchSetFieldValuesRequest,
    CustomFieldPageConfigResponse,
)

# 站点设置 Schema
from .site_setting import (
    SiteSettingUpdate,
    SiteSettingResponse,
)

# 邀请码 Schema
from .invitation_code import (
    InvitationCodeCreate,
    InvitationCodeUpdate,
    InvitationCodeResponse,
    InvitationCodeVerifyRequest,
    InvitationCodeVerifyResponse,
)

# 语言管理 Schema
from .language import (
    LanguageCreate,
    LanguageUpdate,
    LanguageResponse,
    TranslationUpdateRequest,
    TranslationGetResponse,
)

# 应用中心 Schema
from .application import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
)

# 菜单管理 Schema
from .menu import (
    MenuCreate,
    MenuUpdate,
    MenuResponse,
    MenuTreeResponse,
    MenuListResponse,
)

# 集成设置 Schema
from .integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
    IntegrationConfigResponse,
    TestConnectionResponse,
)

# 设备管理 Schema 已迁移到 apps/kuaizhizao/schemas
# from .equipment import (
#     EquipmentCreate,
#     EquipmentUpdate,
#     EquipmentResponse,
#     EquipmentListResponse,
# )
# from .maintenance_plan import (...)
# from .equipment_fault import (...)
# from .mold import (...)

# 文件管理 Schema
from .file import (
    FileCreate,
    FileUpdate,
    FileResponse,
    FileListResponse,
    FilePreviewResponse,
    FileUploadResponse,
)

# 接口管理 Schema
from .api import (
    APICreate,
    APIUpdate,
    APIResponse,
    APITestRequest,
    APITestResponse,
)

# 数据源管理 Schema
from .data_source import (
    DataSourceCreate,
    DataSourceUpdate,
    DataSourceResponse,
    TestConnectionResponse,
)

# 数据集管理 Schema
from .dataset import (
    DatasetCreate,
    DatasetUpdate,
    DatasetResponse,
    ExecuteQueryRequest,
    ExecuteQueryResponse,
)

# 消息管理 Schema
from .message_config import (
    MessageConfigCreate,
    MessageConfigUpdate,
    MessageConfigResponse,
)
from .message_template import (
    MessageTemplateCreate,
    MessageTemplateUpdate,
    MessageTemplateResponse,
    SendMessageRequest,
    SendMessageResponse,
)
from .message_log import MessageLogResponse

# 定时任务 Schema
from .scheduled_task import (
    ScheduledTaskCreate,
    ScheduledTaskUpdate,
    ScheduledTaskResponse,
)

# 审批流程 Schema
from .approval_process import (
    ApprovalProcessCreate,
    ApprovalProcessUpdate,
    ApprovalProcessResponse,
)
from .approval_instance import (
    ApprovalInstanceCreate,
    ApprovalInstanceUpdate,
    ApprovalInstanceAction,
    ApprovalInstanceResponse,
)

# 脚本管理 Schema
from .script import (
    ScriptCreate,
    ScriptUpdate,
    ScriptExecuteRequest,
    ScriptResponse,
    ScriptExecuteResponse,
)

# 打印模板 Schema
from .print_template import (
    PrintTemplateCreate,
    PrintTemplateUpdate,
    PrintTemplateRenderRequest,
    PrintTemplateResponse,
    PrintTemplateRenderResponse,
)

# 打印设备 Schema
from .print_device import (
    PrintDeviceCreate,
    PrintDeviceUpdate,
    PrintDeviceTestRequest,
    PrintDevicePrintRequest,
    PrintDeviceResponse,
    PrintDeviceTestResponse,
    PrintDevicePrintResponse,
)

# 个人资料 Schema
from .user_profile import (
    UserProfileUpdate,
    UserProfileResponse,
)

# 用户偏好 Schema
from .user_preference import (
    UserPreferenceUpdate,
    UserPreferenceResponse,
)

# 用户消息 Schema
from .user_message import (
    UserMessageResponse,
    UserMessageListResponse,
    UserMessageStatsResponse,
    UserMessageMarkReadRequest,
)

# 用户任务 Schema
from .user_task import (
    UserTaskResponse,
    UserTaskListResponse,
    UserTaskStatsResponse,
    UserTaskActionRequest,
)

# 操作日志 Schema
from .operation_log import (
    OperationLogResponse,
    OperationLogListResponse,
    OperationLogStatsResponse,
)

# 登录日志 Schema
from .login_log import (
    LoginLogResponse,
    LoginLogListResponse,
    LoginLogStatsResponse,
    LoginLogCreate,
)

# 在线用户 Schema
from .online_user import (
    OnlineUserResponse,
    OnlineUserListResponse,
    OnlineUserStatisticsResponse,
)

__all__ = [
    # 基础Schema
    "BaseSchema",
    # 角色权限 Schema
    "RoleCreate",
    "RoleUpdate",
    "RoleResponse",
    "RoleListResponse",
    "PermissionResponse",
    "PermissionListResponse",
    # 组织架构 Schema
    "DepartmentCreate",
    "DepartmentUpdate",
    "DepartmentResponse",
    "DepartmentTreeResponse",
    "PositionCreate",
    "PositionUpdate",
    "PositionResponse",
    "PositionListResponse",
    # 账户 Schema
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "UserListResponse",
    "UserImport",
    "UserExport",
    # 数据字典 Schema
    "DataDictionaryCreate",
    "DataDictionaryUpdate",
    "DataDictionaryResponse",
    "DictionaryItemCreate",
    "DictionaryItemUpdate",
    "DictionaryItemResponse",
    # 系统参数 Schema
    "SystemParameterCreate",
    "SystemParameterUpdate",
    "SystemParameterResponse",
    # 编码规则 Schema
    "CodeRuleCreate",
    "CodeRuleUpdate",
    "CodeRuleResponse",
    "CodeGenerationRequest",
    "CodeGenerationResponse",
    # 自定义字段 Schema
    "CustomFieldCreate",
    "CustomFieldUpdate",
    "CustomFieldResponse",
    "CustomFieldValueRequest",
    "CustomFieldValueResponse",
    "BatchSetFieldValuesRequest",
    "CustomFieldPageConfigResponse",
    # 站点设置 Schema
    "SiteSettingUpdate",
    "SiteSettingResponse",
    # 邀请码 Schema
    "InvitationCodeCreate",
    "InvitationCodeUpdate",
    "InvitationCodeResponse",
    "InvitationCodeVerifyRequest",
    "InvitationCodeVerifyResponse",
    # 语言管理 Schema
    "LanguageCreate",
    "LanguageUpdate",
    "LanguageResponse",
    "TranslationUpdateRequest",
    "TranslationGetResponse",
    # 应用中心 Schema
    "ApplicationCreate",
    "ApplicationUpdate",
    "ApplicationResponse",
    # 菜单管理 Schema
    "MenuCreate",
    "MenuUpdate",
    "MenuResponse",
    "MenuTreeResponse",
    "MenuListResponse",
    # 集成设置 Schema
    "IntegrationConfigCreate",
    "IntegrationConfigUpdate",
    "IntegrationConfigResponse",
    "TestConnectionResponse",
    # 文件管理 Schema
    "FileCreate",
    "FileUpdate",
    "FileResponse",
    "FileListResponse",
    "FilePreviewResponse",
    "FileUploadResponse",
    # 接口管理 Schema
    "APICreate",
    "APIUpdate",
    "APIResponse",
    "APITestRequest",
    "APITestResponse",
    # 数据源管理 Schema
    "DataSourceCreate",
    "DataSourceUpdate",
    "DataSourceResponse",
    "TestConnectionResponse",
    # 数据集管理 Schema
    "DatasetCreate",
    "DatasetUpdate",
    "DatasetResponse",
    "ExecuteQueryRequest",
    "ExecuteQueryResponse",
    # 消息管理 Schema
    "MessageConfigCreate",
    "MessageConfigUpdate",
    "MessageConfigResponse",
    "MessageTemplateCreate",
    "MessageTemplateUpdate",
    "MessageTemplateResponse",
    "SendMessageRequest",
    "SendMessageResponse",
    "MessageLogResponse",
    # 定时任务 Schema
    "ScheduledTaskCreate",
    "ScheduledTaskUpdate",
    "ScheduledTaskResponse",
    # 审批流程 Schema
    "ApprovalProcessCreate",
    "ApprovalProcessUpdate",
    "ApprovalProcessResponse",
    "ApprovalInstanceCreate",
    "ApprovalInstanceUpdate",
    "ApprovalInstanceAction",
    "ApprovalInstanceResponse",
    # 脚本管理 Schema
    "ScriptCreate",
    "ScriptUpdate",
    "ScriptExecuteRequest",
    "ScriptResponse",
    "ScriptExecuteResponse",
    # 打印模板 Schema
    "PrintTemplateCreate",
    "PrintTemplateUpdate",
    "PrintTemplateRenderRequest",
    "PrintTemplateResponse",
    "PrintTemplateRenderResponse",
    # 打印设备 Schema
    "PrintDeviceCreate",
    "PrintDeviceUpdate",
    "PrintDeviceTestRequest",
    "PrintDevicePrintRequest",
    "PrintDeviceResponse",
    "PrintDeviceTestResponse",
    "PrintDevicePrintResponse",
    # 个人资料 Schema
    "UserProfileUpdate",
    "UserProfileResponse",
    # 用户偏好 Schema
    "UserPreferenceUpdate",
    "UserPreferenceResponse",
    # 用户消息 Schema
    "UserMessageResponse",
    "UserMessageListResponse",
    "UserMessageStatsResponse",
    "UserMessageMarkReadRequest",
    # 用户任务 Schema
    "UserTaskResponse",
    "UserTaskListResponse",
    "UserTaskStatsResponse",
    "UserTaskActionRequest",
    # 操作日志 Schema
    "OperationLogResponse",
    "OperationLogListResponse",
    "OperationLogStatsResponse",
    # 登录日志 Schema
    "LoginLogResponse",
    "LoginLogListResponse",
    "LoginLogStatsResponse",
    "LoginLogCreate",
    # 在线用户 Schema
    "OnlineUserResponse",
    "OnlineUserListResponse",
    "OnlineUserStatisticsResponse",
]

