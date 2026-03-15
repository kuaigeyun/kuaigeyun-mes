"""
仓库数据 Schema 模块

定义仓库数据的 Pydantic Schema（仓库、库区、库位），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, model_validator, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime

# 仓库类型枚举（制造业最佳实践）
WAREHOUSE_TYPE_CHOICES = (
    "normal",       # 普通仓
    "line_side",    # 线边仓
    "wip",          # 在制品仓
    "outsourcing",  # 委外仓
    "consignment",  # 寄售仓
    "vmi",          # VMI仓
    "defect",       # 不良品仓
    "quarantine",   # 待检仓
)
WarehouseType = Literal["normal", "line_side", "wip", "outsourcing", "consignment", "vmi", "defect", "quarantine"]


class WarehouseBase(BaseModel):
    """仓库基础 Schema"""

    code: str = Field(..., max_length=50, description="仓库编码")
    name: str = Field(..., max_length=200, description="仓库名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")
    warehouse_type: str = Field(default="normal", max_length=20, description="仓库类型", alias="warehouseType")
    workshop_id: Optional[int] = Field(None, description="关联车间ID（线边仓时必填）", alias="workshopId")
    workstation_id: Optional[int] = Field(None, description="关联工位ID（工位级线边仓可选）", alias="workstationId")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID", alias="workCenterId")

    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("仓库编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("仓库名称不能为空")
        return v.strip()

    @validator("warehouse_type")
    def validate_warehouse_type(cls, v):
        """验证仓库类型"""
        if v and v not in WAREHOUSE_TYPE_CHOICES:
            raise ValueError(f"仓库类型无效，可选值: {', '.join(WAREHOUSE_TYPE_CHOICES)}")
        return v or "normal"


class WarehouseCreate(WarehouseBase):
    """创建仓库 Schema"""

    @model_validator(mode="after")
    def validate_line_side_workshop(self):
        """线边仓时 workshop_id 必填"""
        if self.warehouse_type == "line_side" and not self.workshop_id:
            raise ValueError("线边仓必须关联车间")
        return self


class WarehouseUpdate(BaseModel):
    """更新仓库 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="仓库编码")
    name: Optional[str] = Field(None, max_length=200, description="仓库名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")
    warehouse_type: Optional[str] = Field(None, max_length=20, description="仓库类型", alias="warehouseType")
    workshop_id: Optional[int] = Field(None, description="关联车间ID", alias="workshopId")
    workstation_id: Optional[int] = Field(None, description="关联工位ID", alias="workstationId")
    work_center_id: Optional[int] = Field(None, description="关联工作中心ID", alias="workCenterId")

    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("仓库编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("仓库名称不能为空")
        return v.strip() if v else None

    @validator("warehouse_type")
    def validate_warehouse_type(cls, v):
        """验证仓库类型"""
        if v is not None and v not in WAREHOUSE_TYPE_CHOICES:
            raise ValueError(f"仓库类型无效，可选值: {', '.join(WAREHOUSE_TYPE_CHOICES)}")
        return v


class WarehouseResponse(WarehouseBase):
    """仓库响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: Optional[int] = Field(None, alias="tenantId", description="租户ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    workshop_name: Optional[str] = Field(None, alias="workshopName", description="关联车间名称")
    workstation_name: Optional[str] = Field(None, alias="workstationName", description="关联工位名称")
    work_center_name: Optional[str] = Field(None, alias="workCenterName", description="关联工作中心名称")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class StorageAreaBase(BaseModel):
    """库区基础 Schema"""

    code: str = Field(..., max_length=50, description="库区编码")
    name: str = Field(..., max_length=200, description="库区名称")
    warehouse_id: int = Field(..., description="所属仓库ID", alias="warehouseId")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("库区编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("库区名称不能为空")
        return v.strip()


class StorageAreaCreate(StorageAreaBase):
    """创建库区 Schema"""
    pass


class StorageAreaUpdate(BaseModel):
    """更新库区 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="库区编码")
    name: Optional[str] = Field(None, max_length=200, description="库区名称")
    warehouse_id: Optional[int] = Field(None, description="所属仓库ID", alias="warehouseId")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("库区编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("库区名称不能为空")
        return v.strip() if v else None


class StorageAreaResponse(StorageAreaBase):
    """库区响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    warehouse_id: int = Field(..., alias="warehouseId", description="所属仓库ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class StorageLocationBase(BaseModel):
    """库位基础 Schema"""

    code: str = Field(..., max_length=50, description="库位编码")
    name: str = Field(..., max_length=200, description="库位名称")
    storage_area_id: int = Field(..., description="所属库区ID", alias="storageAreaId")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用", alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("库位编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("库位名称不能为空")
        return v.strip()


class StorageLocationCreate(StorageLocationBase):
    """创建库位 Schema"""
    pass


class StorageLocationUpdate(BaseModel):
    """更新库位 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="库位编码")
    name: Optional[str] = Field(None, max_length=200, description="库位名称")
    storage_area_id: Optional[int] = Field(None, description="所属库区ID", alias="storageAreaId")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用", alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("库位编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("库位名称不能为空")
        return v.strip() if v else None


class StorageLocationResponse(StorageLocationBase):
    """库位响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    storage_area_id: int = Field(..., alias="storageAreaId", description="所属库区ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


# ==================== 级联查询响应 Schema ====================

class StorageLocationTreeResponse(StorageLocationResponse):
    """库位树形响应 Schema（用于级联查询）"""
    pass


class StorageAreaTreeResponse(StorageAreaResponse):
    """库区树形响应 Schema（用于级联查询）"""
    
    storage_locations: List[StorageLocationTreeResponse] = Field(default_factory=list, alias="storageLocations", description="库位列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class WarehouseTreeResponse(WarehouseResponse):
    """仓库树形响应 Schema（用于级联查询）"""
    
    storage_areas: List[StorageAreaTreeResponse] = Field(default_factory=list, alias="storageAreas", description="库区列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


# ==================== 批量删除请求 Schema ====================

class BatchDeleteWarehousesRequest(BaseModel):
    """批量删除仓库请求"""
    uuids: List[str] = Field(..., description="要删除的仓库UUID列表", min_items=1, max_items=100)


class BatchDeleteStorageAreasRequest(BaseModel):
    """批量删除库区请求"""
    uuids: List[str] = Field(..., description="要删除的库区UUID列表", min_items=1, max_items=100)


class BatchDeleteStorageLocationsRequest(BaseModel):
    """批量删除库位请求"""
    uuids: List[str] = Field(..., description="要删除的库位UUID列表", min_items=1, max_items=100)

