"""图纸仓库文件夹 Schema"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DrawingFolderCreate(BaseModel):
    name: str = Field(..., max_length=100)
    parent_uuid: Optional[str] = Field(None, alias="parentUuid")
    sort_order: int = Field(0, alias="sortOrder")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        name = (v or "").strip()
        if not name:
            raise ValueError("文件夹名称不能为空")
        return name


class DrawingFolderUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    parent_uuid: Optional[str] = Field(None, alias="parentUuid")
    sort_order: Optional[int] = Field(None, alias="sortOrder")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        name = v.strip()
        if not name:
            raise ValueError("文件夹名称不能为空")
        return name


class DrawingFolderResponse(BaseModel):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    name: str
    parent_id: Optional[int] = Field(None, alias="parentId")
    parent_uuid: Optional[str] = Field(None, alias="parentUuid")
    sort_order: int = Field(..., alias="sortOrder")
    is_active: bool = Field(..., alias="isActive")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    updated_by_name: Optional[str] = Field(None, alias="updatedByName")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    children: List["DrawingFolderResponse"] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class DrawingFolderTreeResponse(BaseModel):
    data: List[DrawingFolderResponse]


class DrawingMoveFolderRequest(BaseModel):
    folder_uuid: Optional[str] = Field(None, alias="folderUuid")

    model_config = ConfigDict(populate_by_name=True)


DrawingFolderResponse.model_rebuild()
