"""
仓库数据 Schema 模块

定义仓库数据的 Pydantic Schema（仓库、库区、库位），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class WarehouseBase(BaseModel):
    """仓库基础 Schema"""
    
    code: str = Field(..., max_length=50, description="仓库编码")
    name: str = Field(..., max_length=200, description="仓库名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
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


class WarehouseCreate(WarehouseBase):
    """创建仓库 Schema"""
    pass


class WarehouseUpdate(BaseModel):
    """更新仓库 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="仓库编码")
    name: Optional[str] = Field(None, max_length=200, description="仓库名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
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


class WarehouseResponse(WarehouseBase):
    """仓库响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class StorageAreaBase(BaseModel):
    """库区基础 Schema"""
    
    code: str = Field(..., max_length=50, description="库区编码")
    name: str = Field(..., max_length=200, description="库区名称")
    warehouse_id: int = Field(..., description="所属仓库ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
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
    warehouse_id: Optional[int] = Field(None, description="所属仓库ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
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
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class StorageLocationBase(BaseModel):
    """库位基础 Schema"""
    
    code: str = Field(..., max_length=50, description="库位编码")
    name: str = Field(..., max_length=200, description="库位名称")
    storage_area_id: int = Field(..., description="所属库区ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
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
    storage_area_id: Optional[int] = Field(None, description="所属库区ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
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
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True

