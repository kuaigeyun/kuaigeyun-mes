"""
职位 Schema 模块

定义职位相关的 Pydantic Schema，用于 API 请求和响应验证。
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict


class PositionBase(BaseModel):
    """
    职位基础 Schema
    
    包含职位的基本字段，用于创建和更新操作。
    """
    name: str = Field(..., min_length=1, max_length=100, description="职位名称")
    code: Optional[str] = Field(None, max_length=50, description="职位代码（可选，用于程序识别）")
    description: Optional[str] = Field(None, description="职位描述")
    sort_order: int = Field(default=0, description="排序顺序")
    is_active: bool = Field(default=True, description="是否启用")


class PositionCreate(PositionBase):
    """
    职位创建 Schema
    
    用于创建新职位的请求数据。
    
    Attributes:
        name: 职位名称（必填，1-100 字符）
        code: 职位代码（可选，用于程序识别）
        description: 职位描述（可选）
        department_uuid: 所属部门UUID（可选）
        sort_order: 排序顺序（默认 0）
        is_active: 是否启用（默认 True）
    """
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（可选）")


class PositionUpdate(BaseModel):
    """
    职位更新 Schema
    
    用于更新职位的请求数据，所有字段可选。
    
    Attributes:
        name: 职位名称（可选，1-100 字符）
        code: 职位代码（可选）
        description: 职位描述（可选）
        department_uuid: 所属部门UUID（可选，使用UUID而不是ID）
        sort_order: 排序顺序（可选）
        is_active: 是否启用（可选）
    """
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="职位名称")
    code: Optional[str] = Field(None, max_length=50, description="职位代码（可选，用于程序识别）")
    description: Optional[str] = Field(None, description="职位描述")
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（可选，使用UUID而不是ID）")
    sort_order: Optional[int] = Field(None, description="排序顺序")
    is_active: Optional[bool] = Field(None, description="是否启用")


class PositionResponse(BaseModel):
    """
    职位响应 Schema

    用于返回职位详细信息，包括关联的部门信息。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。

    Attributes:
        uuid: 职位UUID（对外暴露，业务标识）
        tenant_id: 组织ID
        name: 职位名称
        code: 职位代码
        description: 职位描述
        department_uuid: 所属部门UUID（用于显示）
        department: 部门信息（如果关联）
        sort_order: 排序顺序
        is_active: 是否启用
        created_at: 创建时间
        updated_at: 更新时间
    """
    uuid: str = Field(..., description="职位UUID（对外暴露，业务标识）")
    tenant_id: int = Field(..., description="组织ID")
    name: str = Field(..., description="职位名称")
    code: Optional[str] = Field(None, description="职位代码")
    description: Optional[str] = Field(None, description="职位描述")
    department_id: Optional[int] = Field(None, description="所属部门ID（内部使用）")
    department: Optional[dict] = Field(None, description="部门信息（如果关联）")
    sort_order: int = Field(..., description="排序顺序")
    is_active: bool = Field(..., description="是否启用")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    
    model_config = ConfigDict(from_attributes=True)


class PositionListItem(BaseModel):
    """
    职位列表项 Schema

    用于职位列表响应。

    **注意**: 遵循自增ID+UUID混合方案，只对外暴露UUID。
    """
    uuid: str = Field(..., description="职位UUID（对外暴露，业务标识）")
    name: str = Field(..., description="职位名称")
    code: Optional[str] = Field(None, description="职位代码")
    description: Optional[str] = Field(None, description="职位描述")
    department_uuid: Optional[str] = Field(None, description="所属部门UUID（用于显示）")
    department: Optional[dict] = Field(None, description="部门信息（如果关联）")
    sort_order: int = Field(..., description="排序顺序")
    is_active: bool = Field(..., description="是否启用")
    user_count: int = Field(default=0, description="关联用户数量")
    created_at: datetime = Field(..., description="创建时间")

    model_config = ConfigDict(from_attributes=True)


class PositionListResponse(BaseModel):
    """
    职位列表响应 Schema
    
    用于返回职位列表，包含分页信息。
    """
    items: List[PositionListItem] = Field(..., description="职位列表")
    total: int = Field(..., description="总记录数")
    page: int = Field(..., description="当前页码")
    page_size: int = Field(..., description="每页数量")

