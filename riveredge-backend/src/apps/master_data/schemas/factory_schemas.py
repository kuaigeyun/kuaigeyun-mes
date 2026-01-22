"""
工厂数据 Schema 模块

定义工厂数据的 Pydantic Schema（厂区、车间、产线、工位），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator, ConfigDict
from typing import Optional, List
from datetime import datetime


class PlantBase(BaseModel):
    """厂区基础 Schema"""
    
    code: str = Field(..., max_length=50, description="厂区编码")
    name: str = Field(..., max_length=200, description="厂区名称")
    description: Optional[str] = Field(None, description="描述")
    address: Optional[str] = Field(None, max_length=500, description="地址")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("厂区编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("厂区名称不能为空")
        return v.strip()


class PlantCreate(PlantBase):
    """创建厂区 Schema"""
    pass


class PlantUpdate(BaseModel):
    """更新厂区 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="厂区编码")
    name: Optional[str] = Field(None, max_length=200, description="厂区名称")
    description: Optional[str] = Field(None, description="描述")
    address: Optional[str] = Field(None, max_length=500, description="地址")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("厂区编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("厂区名称不能为空")
        return v.strip() if v else None


class PlantResponse(PlantBase):
    """厂区响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # 允许同时使用字段名和别名
        by_alias=True  # 序列化时使用别名（camelCase）
    )


class WorkshopBase(BaseModel):
    """车间基础 Schema"""
    
    code: str = Field(..., max_length=50, description="车间编码")
    name: str = Field(..., max_length=200, description="车间名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("车间编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("车间名称不能为空")
        return v.strip()


class WorkshopCreate(WorkshopBase):
    """创建车间 Schema"""
    pass


class WorkshopUpdate(BaseModel):
    """更新车间 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="车间编码")
    name: Optional[str] = Field(None, max_length=200, description="车间名称")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("车间编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("车间名称不能为空")
        return v.strip() if v else None


class WorkshopResponse(WorkshopBase):
    """车间响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # 允许同时使用字段名和别名
        by_alias=True  # 序列化时使用别名（camelCase）
    )


class ProductionLineBase(BaseModel):
    """产线基础 Schema"""
    
    code: str = Field(..., max_length=50, description="产线编码")
    name: str = Field(..., max_length=200, description="产线名称")
    workshop_id: int = Field(..., description="所属车间ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("产线编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("产线名称不能为空")
        return v.strip()


class ProductionLineCreate(ProductionLineBase):
    """创建产线 Schema"""
    pass


class ProductionLineUpdate(BaseModel):
    """更新产线 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="产线编码")
    name: Optional[str] = Field(None, max_length=200, description="产线名称")
    workshop_id: Optional[int] = Field(None, description="所属车间ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("产线编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("产线名称不能为空")
        return v.strip() if v else None


class ProductionLineResponse(ProductionLineBase):
    """产线响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    workshop_id: int = Field(..., alias="workshopId", description="所属车间ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # 允许同时使用字段名和别名
        by_alias=True  # 序列化时使用别名（camelCase）
    )


class WorkstationBase(BaseModel):
    """工位基础 Schema"""
    
    code: str = Field(..., max_length=50, description="工位编码")
    name: str = Field(..., max_length=200, description="工位名称")
    production_line_id: int = Field(..., description="所属产线ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("工位编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("工位名称不能为空")
        return v.strip()


class WorkstationCreate(WorkstationBase):
    """创建工位 Schema"""
    pass


class WorkstationUpdate(BaseModel):
    """更新工位 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="工位编码")
    name: Optional[str] = Field(None, max_length=200, description="工位名称")
    production_line_id: Optional[int] = Field(None, description="所属产线ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工位编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("工位名称不能为空")
        return v.strip() if v else None


class WorkstationResponse(WorkstationBase):
    """工位响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., alias="tenantId", description="租户ID")
    production_line_id: int = Field(..., alias="productionLineId", description="所属产线ID")
    created_at: datetime = Field(..., alias="createdAt", description="创建时间")
    updated_at: datetime = Field(..., alias="updatedAt", description="更新时间")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt", description="删除时间")
    is_active: bool = Field(True, alias="isActive", description="是否启用")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,  # 允许同时使用字段名和别名
        by_alias=True  # 序列化时使用别名（camelCase）
    )


# ==================== 级联查询响应 Schema ====================

class WorkstationTreeResponse(WorkstationResponse):
    """工位树形响应 Schema（用于级联查询）"""
    pass


class ProductionLineTreeResponse(ProductionLineResponse):
    """产线树形响应 Schema（用于级联查询）"""
    
    workstations: List[WorkstationTreeResponse] = Field(default_factory=list, alias="workstations", description="工位列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


class WorkshopTreeResponse(WorkshopResponse):
    """车间树形响应 Schema（用于级联查询）"""
    
    production_lines: List[ProductionLineTreeResponse] = Field(default_factory=list, alias="productionLines", description="产线列表")
    
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
        by_alias=True
    )


# ==================== 批量操作 Schema ====================

class BatchDeletePlantsRequest(BaseModel):
    """批量删除厂区请求"""
    uuids: List[str] = Field(..., description="要删除的厂区UUID列表", min_items=1, max_items=100)


class BatchDeleteWorkshopsRequest(BaseModel):
    """批量删除车间请求"""
    uuids: List[str] = Field(..., description="要删除的车间UUID列表", min_items=1, max_items=100)


class BatchDeleteProductionLinesRequest(BaseModel):
    """批量删除产线请求"""
    uuids: List[str] = Field(..., description="要删除的产线UUID列表", min_items=1, max_items=100)


class BatchDeleteWorkstationsRequest(BaseModel):
    """批量删除工位请求"""
    uuids: List[str] = Field(..., description="要删除的工位UUID列表", min_items=1, max_items=100)
