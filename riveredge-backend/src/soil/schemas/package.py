"""
套餐管理 Schema 模块

定义套餐相关的 Pydantic Schema，用于 API 请求和响应的数据验证
"""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel, Field, ConfigDict

from soil.models.tenant import TenantPlan


class PackageBase(BaseModel):
    """
    套餐基础 Schema
    
    包含套餐的通用字段定义
    
    Attributes:
        name: 套餐名称
        plan: 套餐类型（TenantPlan 枚举）
        max_users: 最大用户数限制
        max_storage_mb: 最大存储空间限制（MB）
        allow_pro_apps: 是否允许使用 PRO 应用
        description: 套餐描述
        price: 套餐价格（可选）
        features: 套餐功能列表（可选）
    """
    
    name: str = Field(..., min_length=1, max_length=100, description="套餐名称")
    plan: TenantPlan = Field(..., description="套餐类型")
    max_users: int = Field(..., ge=1, description="最大用户数限制")
    max_storage_mb: int = Field(..., ge=0, description="最大存储空间限制（MB）")
    allow_pro_apps: bool = Field(default=False, description="是否允许使用 PRO 应用")
    description: Optional[str] = Field(default=None, max_length=500, description="套餐描述")
    price: Optional[float] = Field(default=None, ge=0, description="套餐价格（可选）")
    features: Optional[List[str]] = Field(default=None, description="套餐功能列表（可选）")


class PackageCreate(PackageBase):
    """
    套餐创建 Schema
    
    用于创建新套餐时的数据验证
    """
    pass


class PackageUpdate(BaseModel):
    """
    套餐更新 Schema
    
    用于更新套餐信息时的数据验证。
    所有字段都是可选的，只更新提供的字段。
    """
    
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="套餐名称")
    max_users: Optional[int] = Field(None, ge=1, description="最大用户数限制")
    max_storage_mb: Optional[int] = Field(None, ge=0, description="最大存储空间限制（MB）")
    allow_pro_apps: Optional[bool] = Field(None, description="是否允许使用 PRO 应用")
    description: Optional[str] = Field(None, max_length=500, description="套餐描述")
    price: Optional[float] = Field(None, ge=0, description="套餐价格")
    features: Optional[List[str]] = Field(None, description="套餐功能列表")


class PackageResponse(PackageBase):
    """
    套餐响应 Schema
    
    用于 API 响应时的数据序列化
    
    Attributes:
        id: 套餐 ID
        created_at: 创建时间
        updated_at: 更新时间
    """
    
    id: int = Field(..., description="套餐 ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PackageListResponse(BaseModel):
    """
    套餐列表响应 Schema
    
    用于分页列表查询的响应
    
    Attributes:
        items: 套餐列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
    """
    
    items: List[PackageResponse] = Field(default_factory=list, description="套餐列表")
    total: int = Field(default=0, description="总数量")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=10, description="每页数量")

