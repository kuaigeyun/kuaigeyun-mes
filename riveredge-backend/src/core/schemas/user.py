"""
用户 Schema 模块（扩展）

定义用户相关的 Pydantic Schema，用于账户管理 API 请求和响应验证。
扩展自 infra.schemas.user，添加部门、职位、角色关联字段。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict

# 导入基础用户 Schema
from infra.schemas.user import UserBase, UserCreate as SoilUserCreate, UserUpdate as SoilUserUpdate, UserResponse as SoilUserResponse


class UserCreateRequest(BaseModel):
    """
    用户创建请求 Schema（前端请求体）

    用于前端创建用户的请求数据，不包含 tenant_id（由后端自动获取）。
    """
    username: str = Field(..., min_length=3, max_length=50, description="用户名（3-50 字符）")
    email: Optional[EmailStr] = Field(None, description="用户邮箱（可选）")
    password: str = Field(..., min_length=8, max_length=100, description="密码（最少 8 字符）")
    full_name: Optional[str] = Field(None, max_length=100, description="用户全名（可选）")
    phone: str = Field(..., pattern=r'^1[3-9]\d{9}$', description="手机号（必填）")
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（可选）")
    position_uuid: Optional[str] = Field(None, description="所属职位UUID（可选）")
    role_uuids: Optional[List[str]] = Field(None, description="角色UUID列表（可选）")
    is_active: bool = Field(default=True, description="是否激活")
    is_tenant_admin: bool = Field(default=False, description="是否为组织管理员")


class UserCreate(SoilUserCreate):
    """
    用户创建 Schema（扩展）

    扩展自 infra.schemas.user.UserCreate，添加部门、职位、角色关联字段。
    用于内部服务调用，包含完整的字段验证。
    """
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（可选）")
    position_uuid: Optional[str] = Field(None, description="所属职位UUID（可选）")
    role_uuids: Optional[List[str]] = Field(None, description="角色UUID列表（可选）")


class UserUpdate(SoilUserUpdate):
    """
    用户更新 Schema（扩展）
    
    扩展自 infra.schemas.user.UserUpdate，添加部门、职位、角色关联字段。
    
    Attributes:
        department_uuid: 所属部门UUID（可选，可以修改）
        position_uuid: 所属职位UUID（可选，可以修改）
        role_uuids: 角色UUID列表（可选，可以修改）
    """
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（可选，可以修改）")
    position_uuid: Optional[str] = Field(None, description="所属职位UUID（可选，可以修改）")
    role_uuids: Optional[List[str]] = Field(None, description="角色UUID列表（可选，可以修改）")


class UserResponse(SoilUserResponse):
    """
    用户响应 Schema（扩展）
    
    扩展自 infra.schemas.user.UserResponse，添加部门、职位、角色关联信息。
    
    Attributes:
        department_id: 所属部门ID（内部使用）
        department: 部门信息（如果关联）
        position_id: 所属职位ID（内部使用）
        position: 职位信息（如果关联）
        roles: 角色列表（如果关联）
    """
    department_id: Optional[int] = Field(None, description="所属部门ID（内部使用）")
    department: Optional[dict] = Field(None, description="部门信息（如果关联）")
    position_id: Optional[int] = Field(None, description="所属职位ID（内部使用）")
    position: Optional[dict] = Field(None, description="职位信息（如果关联）")
    roles: Optional[List[dict]] = Field(None, description="角色列表（如果关联）")
    
    model_config = ConfigDict(from_attributes=True)


class UserListItem(BaseModel):
    """
    用户列表项 Schema

    用于用户列表响应。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。
    """
    uuid: str = Field(..., description="用户UUID（对外暴露，业务标识）")
    username: str = Field(..., description="用户名")
    email: Optional[str] = Field(None, description="用户邮箱")
    full_name: Optional[str] = Field(None, description="用户全名")
    phone: Optional[str] = Field(None, description="手机号")
    is_active: bool = Field(..., description="是否激活")
    is_tenant_admin: bool = Field(..., description="是否为组织管理员")
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（用于显示）")
    department: Optional[dict] = Field(None, description="部门信息（如果关联）")
    position_uuid: Optional[str] = Field(None, description="所属职位UUID（用于显示）")
    position: Optional[dict] = Field(None, description="职位信息（如果关联）")
    roles: Optional[List[dict]] = Field(None, description="角色列表（如果关联）")
    last_login: Optional[datetime] = Field(None, description="最后登录时间")
    created_at: datetime = Field(..., description="创建时间")

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """
    用户列表响应 Schema
    
    用于返回用户列表，包含分页信息。
    """
    items: List[UserListItem] = Field(..., description="用户列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")


class UserImport(BaseModel):
    """
    用户导入 Schema
    
    用于批量导入用户的请求数据。
    """
    users: List[dict] = Field(..., description="用户数据列表")


class UserExport(BaseModel):
    """
    用户导出 Schema
    
    用于导出用户的筛选条件。
    """
    keyword: Optional[str] = Field(None, description="关键词搜索")
    department_uuid: Optional[str] = Field(None, description="部门UUID筛选")
    position_uuid: Optional[str] = Field(None, description="职位UUID筛选")
    is_active: Optional[bool] = Field(None, description="是否激活筛选")
    is_tenant_admin: Optional[bool] = Field(None, description="是否组织管理员筛选")

