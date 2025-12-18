"""
产品数据 Schema 模块

定义产品数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime


class ProductBase(BaseModel):
    """产品基础 Schema"""

    code: str = Field(..., max_length=50, description="产品编码")
    name: str = Field(..., max_length=200, description="产品名称")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    unit: str = Field(..., max_length=20, description="单位")
    bom_data: Optional[Dict[str, Any]] = Field(None, description="BOM 数据（JSON格式）")
    process_route_ids: Optional[List[int]] = Field(None, description="适用的工艺路线ID列表")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    is_active: bool = Field(True, description="是否启用")

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if not v or not v.strip():
            raise ValueError("产品编码不能为空")
        return v.strip().upper()

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if not v or not v.strip():
            raise ValueError("产品名称不能为空")
        return v.strip()

    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式"""
        if not v or not v.strip():
            raise ValueError("单位不能为空")
        return v.strip()


class ProductCreate(ProductBase):
    """创建产品 Schema"""
    pass


class ProductUpdate(BaseModel):
    """更新产品 Schema"""

    code: Optional[str] = Field(None, max_length=50, description="产品编码")
    name: Optional[str] = Field(None, max_length=200, description="产品名称")
    specification: Optional[str] = Field(None, max_length=500, description="规格")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    bom_data: Optional[Dict[str, Any]] = Field(None, description="BOM 数据（JSON格式）")
    version: Optional[str] = Field(None, max_length=20, description="版本号")
    is_active: Optional[bool] = Field(None, description="是否启用")

    @validator("code")
    def validate_code(cls, v):
        """验证编码格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("产品编码不能为空")
        return v.strip().upper() if v else None

    @validator("name")
    def validate_name(cls, v):
        """验证名称格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("产品名称不能为空")
        return v.strip() if v else None

    @validator("unit")
    def validate_unit(cls, v):
        """验证单位格式"""
        if v is not None and (not v or not v.strip()):
            raise ValueError("单位不能为空")
        return v.strip() if v else None


class ProductResponse(ProductBase):
    """产品响应 Schema"""

    id: int = Field(..., description="主键ID")
    uuid: str = Field(..., description="UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    deleted_at: Optional[datetime] = Field(None, description="删除时间")

    class Config:
        from_attributes = True


class BOMItemResponse(BaseModel):
    """BOM项响应 Schema"""

    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    quantity: float = Field(..., description="数量")
    unit: str = Field(..., description="单位")
    version: Optional[str] = Field(None, description="版本")

    class Config:
        from_attributes = True


class ProductBOMResponse(BaseModel):
    """产品BOM响应 Schema"""

    product_id: int = Field(..., description="产品ID")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    product_version: Optional[str] = Field(None, description="产品版本")
    bom_items: List[BOMItemResponse] = Field(default_factory=list, description="BOM明细列表")

    class Config:
        from_attributes = True


class ProductGroupResponse(BaseModel):
    """产品分组响应 Schema"""

    group_key: str = Field(..., description="分组键（如首字母）")
    group_name: str = Field(..., description="分组名称")
    products: List[ProductResponse] = Field(default_factory=list, description="分组内的产品列表")

    class Config:
        from_attributes = True
