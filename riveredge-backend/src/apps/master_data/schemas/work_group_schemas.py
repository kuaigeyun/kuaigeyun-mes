"""
工作小组 Schema 模块

定义工作小组的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class WorkGroupMemberItem(BaseModel):
    """工作小组成员项 Schema"""

    employee_id: int = Field(..., alias="employeeId", description="员工ID")
    employee_name: Optional[str] = Field(None, alias="employeeName", description="员工姓名")
    performance_weight: Decimal = Field(1, alias="performanceWeight", description="绩效权重")
    sort_order: int = Field(0, alias="sortOrder", description="排序")

    model_config = ConfigDict(populate_by_name=True)


class WorkGroupMemberResponse(WorkGroupMemberItem):
    """工作小组成员响应 Schema"""

    id: int = Field(..., description="主键ID")
    work_group_id: int = Field(..., alias="workGroupId", description="工作小组ID")
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class WorkGroupBase(BaseModel):
    """工作小组基础 Schema"""

    code: str = Field(..., max_length=50, description="工作小组编码")
    name: str = Field(..., max_length=200, description="工作小组名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        if not v or not v.strip():
            raise ValueError("工作小组编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("工作小组名称不能为空")
        return v.strip()


class WorkGroupCreate(WorkGroupBase):
    """创建工作小组 Schema"""

    members: Optional[List[WorkGroupMemberItem]] = Field(
        default_factory=list,
        alias="members",
        description="成员列表（含绩效权重）"
    )

    model_config = ConfigDict(populate_by_name=True)


class WorkGroupUpdate(BaseModel):
    """更新工作小组 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="工作小组编码")
    name: Optional[str] = Field(None, max_length=200, description="工作小组名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")
    members: Optional[List[WorkGroupMemberItem]] = Field(None, alias="members", description="成员列表")

    model_config = ConfigDict(populate_by_name=True)

    @validator("code")
    def validate_code(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError("工作小组编码不能为空")
        return v.strip().upper() if v else None

    @validator("name")
    def validate_name(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError("工作小组名称不能为空")
        return v.strip() if v else None


class WorkGroupResponse(WorkGroupBase):
    """工作小组响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    created_by_name: Optional[str] = Field(None, alias="createdByName", description="创建人姓名")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName", description="更新人姓名")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    members: List[WorkGroupMemberResponse] = Field(
        default_factory=list,
        alias="members",
        description="成员列表"
    )

    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)


class WorkGroupListResult(BaseModel):
    """工作小组分页列表"""

    items: List[WorkGroupResponse]
    total: int

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class BatchDeleteWorkGroupsRequest(BaseModel):
    """批量删除工作小组请求"""
    uuids: List[str] = Field(..., description="要删除的工作小组UUID列表", min_items=1, max_items=100)
