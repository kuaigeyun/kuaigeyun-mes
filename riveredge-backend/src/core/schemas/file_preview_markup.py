"""文件预览批注 Schema"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class FilePreviewMarkupPayload(BaseModel):
    version: int = Field(default=1, ge=1, le=1)
    coordinate_space: str = Field(default="viewBox", max_length=32)
    view_box: Optional[str] = Field(None, alias="viewBox", max_length=200)
    shapes: List[Dict[str, Any]] = Field(default_factory=list)

    model_config = ConfigDict(populate_by_name=True)


class FilePreviewMarkupResponse(BaseModel):
    file_uuid: str
    scope: str = "default"
    payload: FilePreviewMarkupPayload
    updated_by: Optional[int] = None
    updated_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FilePreviewMarkupSaveRequest(BaseModel):
    scope: str = Field(default="default", max_length=32)
    payload: FilePreviewMarkupPayload
