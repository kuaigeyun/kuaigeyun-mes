"""
组织 Schema 模块

定义组织相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
import re

from pydantic import BaseModel, Field, ConfigDict, field_validator

from infra.models.tenant import TenantStatus, TenantPlan


class TenantBase(BaseModel):
    """
    组织基础 Schema
    
    包含组织的通用字段定义
    
    Attributes:
        name: 组织名称
        domain: 组织域名
        status: 组织状态
        plan: 组织套餐
        settings: 组织配置
        max_users: 最大用户数限制
        max_storage: 最大存储空间限制（MB）
        expires_at: 过期时间（可选）
    """
    
    name: str = Field(..., min_length=1, max_length=100, description="组织名称")
    domain: str = Field(..., min_length=1, max_length=100, description="组织域名（用于子域名访问）")
    status: TenantStatus = Field(default=TenantStatus.INACTIVE, description="组织状态")
    plan: TenantPlan = Field(default=TenantPlan.TRIAL, description="组织套餐（默认体验套餐）")
    settings: Dict[str, Any] = Field(default_factory=dict, description="组织配置（JSONB 存储）")
    max_users: Optional[int] = Field(default=None, ge=1, description="最大用户数限制（可选，根据套餐自动设置）")
    max_storage: Optional[int] = Field(default=None, ge=0, description="最大存储空间限制（可选，根据套餐自动设置，单位：MB）")
    sensitive_word_enabled: bool = Field(default=False, description="是否开启敏感词控制（默认关闭）")
    expires_at: Optional[datetime] = Field(default=None, description="过期时间（可选）")


class TenantAdminAccountCreate(BaseModel):
    """新建组织时一并创建的组织管理员账户"""

    username: str = Field(..., min_length=3, max_length=50, description="用户名")
    password: str = Field(..., min_length=8, max_length=128, description="登录密码")
    full_name: Optional[str] = Field(None, max_length=100, description="姓名")
    phone: Optional[str] = Field(None, description="手机号（可选）")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if v is None or v == "":
            return None
        if not re.match(r"^1[3-9]\d{9}$", str(v).strip()):
            raise ValueError("手机号格式不正确，须为11位中国大陆手机号")
        return str(v).strip()


class TenantCreate(TenantBase):
    """
    组织创建 Schema

    用于创建新组织时的数据验证

    Attributes:
        name: 组织名称（必填）
        domain: 组织域名（必填，全局唯一）
        status: 组织状态（可选，默认 inactive）
        plan: 组织套餐（可选，默认 basic）
        settings: 组织配置（可选，默认空字典）
        max_users: 最大用户数限制（可选，默认 10）
        max_storage: 最大存储空间限制（可选，默认 1024 MB）
        expires_at: 过期时间（可选）
        init_data_options: 可选初始化项 key 列表（部门/职位/角色等业务预置）。None 或 [] 表示仅加载系统级必选数据
        industry_preset: 行业预设代码（一键建账，与 init_data_options 互斥）
        admin_account: 组织管理员账户（新建组织时必填）
    """
    init_data_options: Optional[List[str]] = Field(
        default=None,
        description="可选初始化项 key 列表。None 或 []=仅系统级必选",
    )
    industry_preset: Optional[str] = Field(
        default=None,
        description="行业预设代码（一键建账）",
    )
    admin_account: Optional[TenantAdminAccountCreate] = Field(
        None,
        description="组织管理员账户（平台新建组织时必填）",
    )
    parent_tenant_id: Optional[int] = Field(
        default=None,
        ge=1,
        description="父组织 ID。传入表示创建子组织，不传表示创建主组织",
    )


class TenantUpdate(BaseModel):
    """
    组织更新 Schema
    
    用于更新组织信息时的数据验证。
    所有字段都是可选的，只更新提供的字段。
    
    Attributes:
        name: 组织名称（可选）
        domain: 组织域名（可选）
        status: 组织状态（可选）
        plan: 组织套餐（可选）
        settings: 组织配置（可选）
        max_users: 最大用户数限制（可选）
        max_storage: 最大存储空间限制（可选）
        sensitive_word_enabled: 是否开启敏感词控制（可选）
        expires_at: 过期时间（可选）
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="组织名称")
    domain: Optional[str] = Field(None, min_length=1, max_length=100, description="组织域名")
    status: Optional[TenantStatus] = Field(None, description="组织状态")
    plan: Optional[TenantPlan] = Field(None, description="组织套餐")
    settings: Optional[Dict[str, Any]] = Field(None, description="组织配置")
    max_users: Optional[int] = Field(None, ge=1, description="最大用户数限制")
    max_storage: Optional[int] = Field(None, ge=0, description="最大存储空间限制（MB）")
    sensitive_word_enabled: Optional[bool] = Field(None, description="是否开启敏感词控制")
    expires_at: Optional[datetime] = Field(None, description="过期时间")


class TenantResponse(TenantBase):
    """
    组织响应 Schema
    
    用于 API 响应时的数据序列化
    
    Attributes:
        id: 组织 ID（内部使用）
        uuid: 组织 UUID（对外暴露，业务标识）
        name: 组织名称
        domain: 组织域名
        status: 组织状态
        plan: 组织套餐
        settings: 组织配置
        max_users: 最大用户数限制
        max_storage: 最大存储空间限制（MB）
        expires_at: 过期时间（可选）
        last_login_at: 组织内用户最后登录时间（取各用户 last_login 最大值）
        user_count: 已使用用户数
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="组织 ID（内部使用）")
    uuid: str = Field(..., description="组织 UUID（对外暴露，业务标识）")
    parent_tenant_id: Optional[int] = Field(None, description="父组织 ID（仅子组织有值）")
    is_subtenant: bool = Field(default=False, description="是否子组织")
    last_login_at: Optional[datetime] = Field(None, description="组织内用户最后登录时间")
    user_count: int = Field(default=0, description="已使用用户数")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class TenantListResponse(BaseModel):
    """
    组织列表响应 Schema
    
    用于分页列表响应
    
    Attributes:
        items: 组织列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: list[TenantResponse] = Field(..., description="组织列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class TenantSearchOption(BaseModel):
    """
    组织搜索选项 Schema
    
    用于组织搜索结果的单个组织信息
    
    Attributes:
        tenant_id: 组织 ID
        tenant_name: 组织名称
        tenant_domain: 组织域名
    """
    
    tenant_id: int = Field(..., description="组织 ID")
    tenant_name: str = Field(..., description="组织名称")
    tenant_domain: str = Field(..., description="组织域名")
    
    model_config = ConfigDict(from_attributes=True)


class TenantSearchResponse(BaseModel):
    """
    组织搜索响应 Schema
    
    用于返回组织搜索结果
    
    Attributes:
        items: 组织列表
        total: 总数量
    """
    
    items: list[TenantSearchOption] = Field(..., description="组织列表")
    total: int = Field(..., description="总数量")


class TenantCheckResponse(BaseModel):
    """
    组织检查响应 Schema
    
    用于检查组织域名是否存在
    
    Attributes:
        exists: 组织是否存在
        tenant_id: 组织 ID（如果存在）
        tenant_name: 组织名称（如果存在）
    """
    
    exists: bool = Field(..., description="组织是否存在")
    tenant_id: Optional[int] = Field(None, description="组织 ID（如果存在）")
    tenant_name: Optional[str] = Field(None, description="组织名称（如果存在）")


class TenantUsageResponse(BaseModel):
    """
    组织使用量统计响应 Schema
    
    用于返回组织的实际使用量统计信息
    
    Attributes:
        tenant_id: 组织 ID
        user_count: 当前用户数
        max_users: 最大用户数限制
        storage_used_mb: 当前存储空间使用量（MB）
        max_storage_mb: 最大存储空间限制（MB）
        user_usage_percent: 用户数使用百分比
        storage_usage_percent: 存储空间使用百分比
    """
    
    tenant_id: int = Field(..., description="组织 ID")
    user_count: int = Field(..., description="当前用户数")
    max_users: int = Field(..., description="最大用户数限制")
    storage_used_mb: int = Field(..., description="当前存储空间使用量（MB）")
    max_storage_mb: int = Field(..., description="最大存储空间限制（MB）")
    user_usage_percent: float = Field(..., description="用户数使用百分比")
    storage_usage_percent: float = Field(..., description="存储空间使用百分比")
    warnings: list[str] = Field(default_factory=list, description="配额预警信息列表")


class TenantActivityLogResponse(BaseModel):
    """
    组织活动日志响应 Schema
    
    用于返回组织活动日志信息
    
    Attributes:
        id: 日志 ID（内部使用）
        uuid: 日志 UUID（对外暴露，业务标识）
        tenant_id: 组织 ID
        action: 操作类型
        description: 操作描述
        operator_id: 操作人 ID（可选）
        operator_name: 操作人名称（可选）
        created_at: 操作时间
    """
    
    id: int = Field(..., description="日志 ID（内部使用）")
    uuid: str = Field(..., description="日志 UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织 ID")
    action: str = Field(..., description="操作类型")
    description: str = Field(..., description="操作描述")
    operator_id: Optional[int] = Field(None, description="操作人 ID（可选）")
    operator_name: Optional[str] = Field(None, description="操作人名称（可选）")
    created_at: datetime = Field(..., description="操作时间")
    
    model_config = ConfigDict(from_attributes=True)


class TenantActivityLogListResponse(BaseModel):
    """
    组织活动日志列表响应 Schema
    
    用于分页列表响应
    
    Attributes:
        items: 日志列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: list[TenantActivityLogResponse] = Field(..., description="日志列表")
    total: int = Field(..., description="总数量")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class SharedUserQuotaTenantUsage(BaseModel):
    """共享用户池中的单组织用量"""

    tenant_id: int = Field(..., description="组织 ID")
    tenant_name: str = Field(..., description="组织名称")
    is_subtenant: bool = Field(..., description="是否子组织")
    user_count: int = Field(..., description="有效用户数（启用且未删除）")


class SharedUserQuotaResponse(BaseModel):
    """主组织共享用户池统计结果"""

    root_tenant_id: int = Field(..., description="主组织 ID")
    root_tenant_name: str = Field(..., description="主组织名称")
    max_users: int = Field(..., description="主组织用户配额上限")
    used_users: int = Field(..., description="主组织 + 子组织已用有效用户数")
    remaining_users: int = Field(..., description="剩余可用用户数（不小于 0）")
    over_quota: bool = Field(..., description="是否超配额")
    tenants: list[SharedUserQuotaTenantUsage] = Field(
        default_factory=list,
        description="按组织分布的用量明细（含主组织）",
    )


class SyncTenantLimitsFromPlanResponse(BaseModel):
    """从当前套餐同步配额结果"""

    tenant_id: int = Field(..., description="主组织 ID")
    plan: str = Field(..., description="当前套餐")
    max_users: int = Field(..., description="同步后的用户配额上限")
    max_storage: int = Field(..., description="同步后的存储配额上限（MB）")
    previous_max_users: int = Field(..., description="同步前的用户配额上限")
    previous_max_storage: int = Field(..., description="同步前的存储配额上限（MB）")
    used_users: int = Field(..., description="当前共享池已用有效用户数")
    remaining_users: int = Field(..., description="剩余可用用户数（不小于 0）")
    over_quota: bool = Field(..., description="是否超配额（超配额时不影响已有用户，但禁止新增）")

