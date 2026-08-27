"""
组装模板数据验证 Schema
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict

from apps.kuaizhizao.schemas.warehouse import DocumentLineMaterialPreview


class AssemblyTemplateItemBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int = Field(..., description="组件物料ID")
    material_code: str = Field(..., description="组件物料编码")
    material_name: str = Field(..., description="组件物料名称")
    quantity_per_base: Decimal = Field(..., gt=0, description="单位成品用量")
    unit_price: Decimal = Field(default=Decimal("0"), ge=0, description="默认单价")
    sequence: int = Field(default=0, description="行序号")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyTemplateItemCreate(AssemblyTemplateItemBase):
    pass


class AssemblyTemplateItemCreateInput(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    material_id: int
    material_code: str
    material_name: str
    quantity_per_base: Decimal
    unit_price: Decimal = Decimal("0")
    sequence: int = 0
    remarks: Optional[str] = None


class AssemblyTemplateItemUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    quantity_per_base: Optional[Decimal] = None
    unit_price: Optional[Decimal] = None
    sequence: Optional[int] = None
    remarks: Optional[str] = None


class AssemblyTemplateItemResponse(AssemblyTemplateItemBase):
    id: int
    template_id: int
    created_at: datetime
    updated_at: datetime


class AssemblyTemplateBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_name: str = Field(..., max_length=200, description="模板名称")
    product_material_id: int = Field(..., description="成品/半成品物料ID")
    product_material_code: str = Field(..., description="成品物料编码")
    product_material_name: str = Field(..., description="成品物料名称")
    base_quantity: Decimal = Field(default=Decimal("1"), gt=0, description="基准数量")
    is_active: bool = Field(default=True, description="是否启用")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyTemplateCreate(AssemblyTemplateBase):
    template_code: Optional[str] = Field(None, description="模板编码（可选，自动生成）")
    items: Optional[List[AssemblyTemplateItemCreate]] = Field(None, description="明细行")


class AssemblyTemplateUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_name: Optional[str] = None
    product_material_id: Optional[int] = None
    product_material_code: Optional[str] = None
    product_material_name: Optional[str] = None
    base_quantity: Optional[Decimal] = None
    is_active: Optional[bool] = None
    remarks: Optional[str] = None
    items: Optional[List[AssemblyTemplateItemCreate]] = Field(None, description="明细行（全量替换）")


class AssemblyTemplateResponse(AssemblyTemplateBase):
    id: int
    uuid: str
    template_code: str
    source_type: str
    total_items: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    items: Optional[List[DocumentLineMaterialPreview]] = Field(
        None, description="明细物料名预览（列表「明细」列）",
    )


class AssemblyTemplateDetailResponse(AssemblyTemplateResponse):
    """详情/写回：完整组件行"""
    items: List[AssemblyTemplateItemResponse] = Field(default_factory=list, description="完整明细")


class AssemblyTemplateListResponse(BaseModel):
    items: List[AssemblyTemplateResponse] = Field(default_factory=list)
    total: int


class AssemblyTemplateBomPreviewLine(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    quantity_per_base: Decimal
    unit: Optional[str] = None


class AssemblyTemplateBomPreviewResponse(BaseModel):
    product_material_id: int
    product_material_code: Optional[str] = None
    product_material_name: Optional[str] = None
    base_quantity: Decimal
    lines: List[AssemblyTemplateBomPreviewLine] = Field(default_factory=list)


class ApplyAssemblyTemplateRequest(BaseModel):
    template_id: int = Field(..., description="组装模板ID")
    replace_existing: bool = Field(default=False, description="是否覆盖现有 pending 明细")
