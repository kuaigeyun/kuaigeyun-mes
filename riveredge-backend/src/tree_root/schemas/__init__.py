"""
系统级数据验证模块（Pydantic Schema）

包含所有系统级功能的 Schema 定义，用于请求/响应数据验证。
"""

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

# 集成设置 Schema
from .integration_config import (
    IntegrationConfigCreate,
    IntegrationConfigUpdate,
    IntegrationConfigResponse,
    TestConnectionResponse,
)

__all__ = [
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
    # 集成设置 Schema
    "IntegrationConfigCreate",
    "IntegrationConfigUpdate",
    "IntegrationConfigResponse",
    "TestConnectionResponse",
]

