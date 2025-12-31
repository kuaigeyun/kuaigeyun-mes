"""
BOM计算相关schema

提供BOM展开和物料需求计算相关的数据验证和序列化。
注意：BOM管理已移至master_data APP，本文件只保留计算相关的schema。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import Optional, List
from pydantic import Field
from core.schemas.base import BaseSchema


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


# === 物料需求计算 ===

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
