"""
BOM管理模块数据验证schema

提供BOM管理相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-12-30
"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


# === BOM物料清单 ===

class BillOfMaterialsBase(BaseSchema):
    """BOM物料清单基础schema"""
    bom_code: str = Field(..., max_length=50, description="BOM编码")
    finished_product_id: int = Field(..., description="成品物料ID")
    finished_product_code: str = Field(..., max_length=50, description="成品物料编码")
    finished_product_name: str = Field(..., max_length=200, description="成品物料名称")
    finished_product_spec: Optional[str] = Field(None, max_length=200, description="成品规格")
    bom_name: str = Field(..., max_length=200, description="BOM名称")
    version: str = Field("1.0", max_length=20, description="BOM版本")
    bom_type: str = Field("生产BOM", max_length=20, description="BOM类型")
    base_quantity: float = Field(1, gt=0, description="基准数量")
    base_unit: str = Field(..., max_length=20, description="基准单位")
    status: str = Field("草稿", max_length=20, description="BOM状态")
    effective_date: date = Field(..., description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")
    routing_id: Optional[int] = Field(None, description="工艺路线ID")
    routing_code: Optional[str] = Field(None, max_length=50, description="工艺路线编码")
    total_cost: float = Field(0, ge=0, description="总成本")
    material_cost: float = Field(0, ge=0, description="材料成本")
    labor_cost: float = Field(0, ge=0, description="人工成本")
    overhead_cost: float = Field(0, ge=0, description="制造费用")
    reviewer_id: Optional[int] = Field(None, description="审核人ID")
    reviewer_name: Optional[str] = Field(None, max_length=100, description="审核人姓名")
    review_time: Optional[datetime] = Field(None, description="审核时间")
    review_status: str = Field("待审核", max_length=20, description="审核状态")
    review_remarks: Optional[str] = Field(None, description="审核备注")
    notes: Optional[str] = Field(None, description="备注")


class BillOfMaterialsCreate(BillOfMaterialsBase):
    """BOM物料清单创建schema"""
    pass


class BillOfMaterialsUpdate(BillOfMaterialsBase):
    """BOM物料清单更新schema"""
    bom_code: Optional[str] = Field(None, max_length=50, description="BOM编码")


class BillOfMaterialsResponse(BillOfMaterialsBase):
    """BOM物料清单响应schema"""
    id: int = Field(..., description="BOM ID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


class BillOfMaterialsListResponse(BillOfMaterialsResponse):
    """BOM物料清单列表响应schema（简化版）"""
    pass


# === BOM物料清单明细 ===

class BillOfMaterialsItemBase(BaseSchema):
    """BOM物料清单明细基础schema"""
    parent_item_id: Optional[int] = Field(None, description="父项ID")
    level: int = Field(1, ge=1, description="层级")
    sequence: int = Field(1, ge=1, description="顺序号")
    component_id: int = Field(..., description="子项物料ID")
    component_code: str = Field(..., max_length=50, description="子项物料编码")
    component_name: str = Field(..., max_length=200, description="子项物料名称")
    component_spec: Optional[str] = Field(None, max_length=200, description="子项规格")
    component_type: str = Field(..., max_length=20, description="子项类型")
    quantity: float = Field(..., gt=0, description="用量")
    unit: str = Field(..., max_length=20, description="单位")
    scrap_rate: float = Field(0, ge=0, le=100, description="损耗率")
    operation_id: Optional[int] = Field(None, description="工序ID")
    operation_code: Optional[str] = Field(None, max_length=50, description="工序编码")
    operation_name: Optional[str] = Field(None, max_length=200, description="工序名称")
    lead_time: int = Field(0, ge=0, description="前置时间（天）")
    setup_time: float = Field(0, ge=0, description="准备时间")
    is_alternative: bool = Field(False, description="是否为替代料")
    alternative_group: Optional[str] = Field(None, max_length=50, description="替代组")
    priority: int = Field(1, ge=1, description="优先级")
    unit_cost: float = Field(0, ge=0, description="单价")
    total_cost: float = Field(0, ge=0, description="总成本")
    effective_date: Optional[date] = Field(None, description="生效日期")
    expiry_date: Optional[date] = Field(None, description="失效日期")
    notes: Optional[str] = Field(None, description="备注")


class BillOfMaterialsItemCreate(BillOfMaterialsItemBase):
    """BOM物料清单明细创建schema"""
    pass


class BillOfMaterialsItemUpdate(BillOfMaterialsItemBase):
    """BOM物料清单明细更新schema"""
    pass


class BillOfMaterialsItemResponse(BillOfMaterialsItemBase):
    """BOM物料清单明细响应schema"""
    id: int = Field(..., description="明细ID")
    tenant_id: int = Field(..., description="租户ID")
    bom_id: int = Field(..., description="BOM ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    class Config:
        from_attributes = True


# === BOM展开结果 ===

class BOMExpansionItem(BaseSchema):
    """BOM展开结果项"""
    level: int = Field(..., description="层级")
    component_id: int = Field(..., description="物料ID")
    component_code: str = Field(..., description="物料编码")
    component_name: str = Field(..., description="物料名称")
    component_type: str = Field(..., description="物料类型")
    required_quantity: float = Field(..., description="需求数量")
    unit: str = Field(..., description="单位")
    unit_cost: float = Field(..., description="单价")
    total_cost: float = Field(..., description="总成本")
    lead_time: int = Field(..., description="前置时间（天）")
    operation_name: Optional[str] = Field(None, description="工序名称")


class BOMExpansionResult(BaseSchema):
    """BOM展开结果"""
    bom_id: int = Field(..., description="BOM ID")
    bom_code: str = Field(..., description="BOM编码")
    finished_product_code: str = Field(..., description="成品编码")
    finished_product_name: str = Field(..., description="成品名称")
    expansion_quantity: float = Field(..., description="展开数量")
    total_cost: float = Field(..., description="总成本")
    max_lead_time: int = Field(..., description="最大前置时间")
    items: List[BOMExpansionItem] = Field(..., description="展开明细")


class MaterialRequirement(BaseSchema):
    """物料需求计算结果"""
    component_id: int = Field(..., description="物料ID")
    component_code: str = Field(..., description="物料编码")
    component_name: str = Field(..., description="物料名称")
    component_type: str = Field(..., description="物料类型")
    gross_requirement: float = Field(..., description="毛需求")
    net_requirement: float = Field(..., description="净需求")
    available_inventory: float = Field(..., description="可用库存")
    planned_receipt: float = Field(..., description="计划入库")
    unit: str = Field(..., description="单位")
    lead_time: int = Field(..., description="前置时间")


class MRPRequirement(BaseSchema):
    """MRP物料需求规划结果"""
    material_id: int = Field(..., description="物料ID")
    material_code: str = Field(..., description="物料编码")
    material_name: str = Field(..., description="物料名称")
    requirements: List[dict] = Field(..., description="各时段需求")
