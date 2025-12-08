"""
组织 Schema 模块

定义组织相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field, ConfigDict

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
    expires_at: Optional[datetime] = Field(default=None, description="过期时间（可选）")


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
    """
    pass


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
        expires_at: 过期时间（可选）
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="组织名称")
    domain: Optional[str] = Field(None, min_length=1, max_length=100, description="组织域名")
    status: Optional[TenantStatus] = Field(None, description="组织状态")
    plan: Optional[TenantPlan] = Field(None, description="组织套餐")
    settings: Optional[Dict[str, Any]] = Field(None, description="组织配置")
    max_users: Optional[int] = Field(None, ge=1, description="最大用户数限制")
    max_storage: Optional[int] = Field(None, ge=0, description="最大存储空间限制（MB）")
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
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="组织 ID（内部使用）")
    uuid: str = Field(..., description="组织 UUID（对外暴露，业务标识）")
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

