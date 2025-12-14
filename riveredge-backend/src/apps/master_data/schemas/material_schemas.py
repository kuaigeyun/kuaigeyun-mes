"""
物料数据 Schema 模块

定义物料数据的 Pydantic Schema（物料分组、物料、BOM），用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal


class MaterialGroupBase(BaseModel):
    """物料分组基础 Schema"""
    
    code: str = Field(..., max_length=50, description="分组编码")
    name: str = Field(..., max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, description="父分组ID（用于层级结构）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("分组编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("分组名称不能为空")
        return v.strip()


class MaterialGroupCreate(MaterialGroupBase):
    """创建物料分组 Schema"""
    pass


class MaterialGroupUpdate(BaseModel):
    """更新物料分组 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="分组编码")
    name: Optional[str] = Field(None, max_length=200, description="分组名称")
    parent_id: Optional[int] = Field(None, description="父分组ID")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("分组编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("分组名称不能为空")
        return v.strip() if v else None


class MaterialGroupResponse(MaterialGroupBase):
    """物料分组响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class MaterialBase(BaseModel):
    """物料基础 Schema"""
    
    code: str = Field(..., max_length=50, description="物料编码")
    name: str = Field(..., max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, description="物料分组ID")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: str = Field(..., max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: bool = Field(False, description="是否启用批号管理")
    variant_managed: bool = Field(False, description="是否启用变体管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("物料编码不能为空")
        return v.strip().upper()
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("物料名称不能为空")
        return v.strip()
    
    @validator("base_unit")
    def validate_base_unit(cls, v):
        """验证基础单位格式"""
        if not v or not v.strip():
            raise ValueError("基础单位不能为空")
        return v.strip()


class MaterialCreate(MaterialBase):
    """创建物料 Schema"""
    pass


class MaterialUpdate(BaseModel):
    """更新物料 Schema"""
    
    code: Optional[str] = Field(None, max_length=50, description="物料编码")
    name: Optional[str] = Field(None, max_length=200, description="物料名称")
    group_id: Optional[int] = Field(None, description="物料分组ID")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    base_unit: Optional[str] = Field(None, max_length=20, description="基础单位")
    units: Optional[Dict[str, Any]] = Field(None, description="多单位管理（JSON格式）")
    batch_managed: Optional[bool] = Field(None, description="是否启用批号管理")
    variant_managed: Optional[bool] = Field(None, description="是否启用变体管理")
    variant_attributes: Optional[Dict[str, Any]] = Field(None, description="变体属性（JSON格式）")
    description: Optional[str] = Field(None, description="描述")
    brand: Optional[str] = Field(None, max_length=100, description="品牌")
    model: Optional[str] = Field(None, max_length=100, description="型号")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("物料编码不能为空")
        return v.strip().upper() if v else None
    
    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("物料名称不能为空")
        return v.strip() if v else None
    
    @validator("base_unit")
    def validate_base_unit(cls, v):
        """验证基础单位格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("基础单位不能为空")
        return v.strip() if v else None


class MaterialResponse(MaterialBase):
    """物料响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True


class BOMBase(BaseModel):
    """BOM基础 Schema"""
    
    material_id: int = Field(..., description="主物料ID")
    component_id: int = Field(..., description="子物料ID")
    quantity: Decimal = Field(..., description="用量")
    unit: str = Field(..., max_length=20, description="单位")
    is_alternative: bool = Field(False, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: int = Field(0, description="优先级（数字越小优先级越高）")
    description: Optional[str] = Field(None, description="描述")
    is_active: bool = Field(True, description="是否启用")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v <= 0:
            raise ValueError("用量必须大于0")
        return v
    
    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式"""
        if not v or not v.strip():
            raise ValueError("单位不能为空")
        return v.strip()


class BOMCreate(BOMBase):
    """创建BOM Schema"""
    pass


class BOMUpdate(BaseModel):
    """更新BOM Schema"""
    
    material_id: Optional[int] = Field(None, description="主物料ID")
    component_id: Optional[int] = Field(None, description="子物料ID")
    quantity: Optional[Decimal] = Field(None, description="用量")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    is_alternative: Optional[bool] = Field(None, description="是否为替代料")
    alternative_group_id: Optional[int] = Field(None, description="替代料组ID")
    priority: Optional[int] = Field(None, description="优先级")
    description: Optional[str] = Field(None, description="描述")
    is_active: Optional[bool] = Field(None, description="是否启用")
    
    @validator("quantity")
    def validate_quantity(cls, v):
        """验证用量"""
        if v is not None and v <= 0:
            raise ValueError("用量必须大于0")
        return v
    
    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("单位不能为空")
        return v.strip() if v else None


class BOMResponse(BOMBase):
    """BOM响应 Schema"""
    
    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")
    
    class Config:
        from_attributes = True

