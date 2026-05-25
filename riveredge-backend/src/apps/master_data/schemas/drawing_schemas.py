"""
工程图纸 Schema 模块
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


DRAWING_TYPES = {"part", "assembly", "process", "other"}
DRAWING_STATUSES = {"Draft", "Released", "Obsolete"}


class FileBriefResponse(BaseModel):
    """文件简要信息（来自 core_files）"""

    uuid: str
    original_name: str = Field(..., alias="originalName")
    file_extension: Optional[str] = Field(None, alias="fileExtension")
    file_size: Optional[int] = Field(None, alias="fileSize")
    preview_url: Optional[str] = Field(None, alias="previewUrl")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class EngineeringDrawingBase(BaseModel):
    code: str = Field(..., max_length=50, description="图号")
    name: str = Field(..., max_length=200, description="图纸名称")
    revision: str = Field("A", max_length=20, description="修订版")
    drawing_type: str = Field("part", alias="drawingType", description="图纸类型")
    file_uuid: str = Field(..., alias="fileUuid", max_length=36, description="主文件 UUID")
    supplementary_file_uuids: Optional[List[str]] = Field(
        None, alias="supplementaryFileUuids", description="附加文件 UUID 列表"
    )
    material_uuids: Optional[List[str]] = Field(None, alias="materialUuids")
    process_route_uuids: Optional[List[str]] = Field(None, alias="processRouteUuids")
    operation_uuids: Optional[List[str]] = Field(None, alias="operationUuids")
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("图号不能为空")
        return v.strip().upper()

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("图纸名称不能为空")
        return v.strip()

    @field_validator("revision")
    @classmethod
    def validate_revision(cls, v: str) -> str:
        rev = (v or "A").strip().upper()
        if not rev:
            raise ValueError("修订版不能为空")
        return rev

    @field_validator("drawing_type")
    @classmethod
    def validate_drawing_type(cls, v: str) -> str:
        val = (v or "part").strip().lower()
        if val not in DRAWING_TYPES:
            raise ValueError(f"图纸类型无效，允许: {', '.join(sorted(DRAWING_TYPES))}")
        return val


class EngineeringDrawingCreate(EngineeringDrawingBase):
    pass


class EngineeringDrawingUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    drawing_type: Optional[str] = Field(None, alias="drawingType")
    file_uuid: Optional[str] = Field(None, alias="fileUuid", max_length=36)
    supplementary_file_uuids: Optional[List[str]] = Field(None, alias="supplementaryFileUuids")
    material_uuids: Optional[List[str]] = Field(None, alias="materialUuids")
    process_route_uuids: Optional[List[str]] = Field(None, alias="processRouteUuids")
    operation_uuids: Optional[List[str]] = Field(None, alias="operationUuids")
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class EngineeringDrawingResponse(EngineeringDrawingBase):
    id: int
    uuid: str
    tenant_id: int = Field(..., alias="tenantId")
    status: str
    file: Optional[FileBriefResponse] = None
    supplementary_files: Optional[List[FileBriefResponse]] = Field(
        None, alias="supplementaryFiles"
    )
    released_at: Optional[datetime] = Field(None, alias="releasedAt")
    released_by: Optional[int] = Field(None, alias="releasedBy")
    obsolete_at: Optional[datetime] = Field(None, alias="obsoleteAt")
    obsolete_reason: Optional[str] = Field(None, alias="obsoleteReason")
    created_by: Optional[int] = Field(None, alias="createdBy")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")
    linked_bom_material_id: Optional[int] = Field(None, alias="linkedBomMaterialId")
    linked_bom_version: Optional[str] = Field(None, alias="linkedBomVersion")
    last_step_bom_import_at: Optional[datetime] = Field(None, alias="lastStepBomImportAt")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class EngineeringDrawingListResponse(BaseModel):
    data: List[EngineeringDrawingResponse]
    total: int


class EngineeringDrawingObsoleteRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=2000, description="作废原因")

    model_config = ConfigDict(populate_by_name=True)


class EngineeringDrawingRevisionCreate(BaseModel):
    file_uuid: Optional[str] = Field(None, alias="fileUuid", description="新版主文件 UUID")
    supplementary_file_uuids: Optional[List[str]] = Field(None, alias="supplementaryFileUuids")
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class StepBomEdgeInput(BaseModel):
    parent_key: str = Field(..., alias="parentKey", description="父节点 key，顶层为 root")
    child_key: str = Field(..., alias="childKey")
    child_name: str = Field(..., alias="childName")
    quantity: int = Field(1, ge=1)

    model_config = ConfigDict(populate_by_name=True)


class StepBomNodeInput(BaseModel):
    key: str
    name: str
    has_children: bool = Field(False, alias="hasChildren")
    material_id: Optional[int] = Field(None, alias="materialId")
    material_code: Optional[str] = Field(None, alias="materialCode")

    model_config = ConfigDict(populate_by_name=True)


class DrawingStepBomImportRequest(BaseModel):
    root_material_id: int = Field(..., alias="rootMaterialId")
    version: str = Field("1.0", max_length=50)
    default_group_id: int = Field(..., alias="defaultGroupId")
    default_unit: str = Field("个", alias="defaultUnit", max_length=20)
    create_missing_materials: bool = Field(True, alias="createMissingMaterials")
    material_code_prefix: str = Field("STP-", alias="materialCodePrefix", max_length=20)
    edges: List[StepBomEdgeInput] = Field(..., min_length=1)
    nodes: List[StepBomNodeInput] = Field(..., min_length=1)

    model_config = ConfigDict(populate_by_name=True)


class StepBomMaterialBrief(BaseModel):
    id: int
    uuid: str
    main_code: str = Field(..., alias="mainCode")
    name: str

    model_config = ConfigDict(populate_by_name=True)


class DrawingStepBomImportResponse(BaseModel):
    root_material_id: int = Field(..., alias="rootMaterialId")
    version: str
    bom_items_created: int = Field(..., alias="bomItemsCreated")
    materials_created: List[StepBomMaterialBrief] = Field(default_factory=list, alias="materialsCreated")
    materials_matched: int = Field(..., alias="materialsMatched")
    bom_designer_path: str = Field(..., alias="bomDesignerPath")
    drawing: EngineeringDrawingResponse

    model_config = ConfigDict(populate_by_name=True)
