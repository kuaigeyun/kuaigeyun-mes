"""
装配物料绑定 Schema 模块

Author: Luigi Lu
Date: 2026-02-28
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class AssemblyMaterialBindingCreate(BaseModel):
    """创建装配物料绑定"""
    assembly_order_item_id: Optional[int] = Field(None, description="组装单明细ID（可选）")
    parent_material_id: int = Field(..., description="父件物料ID")
    parent_material_code: str = Field(..., description="父件物料编码")
    parent_material_name: str = Field(..., description="父件物料名称")
    parent_batch_no: Optional[str] = Field(None, description="父件批次号")
    child_material_id: int = Field(..., description="子件物料ID")
    child_material_code: str = Field(..., description="子件物料编码")
    child_material_name: str = Field(..., description="子件物料名称")
    child_batch_no: str = Field(..., description="子件批次号")
    quantity: Decimal = Field(..., description="消耗数量")
    remarks: Optional[str] = Field(None, description="备注")


class AssemblyMaterialBindingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="绑定ID")
    assembly_order_id: int = Field(..., description="组装单ID")
    assembly_order_item_id: Optional[int] = Field(None, description="组装单明细ID")
    parent_material_id: int = Field(..., description="父件物料ID")
    parent_material_code: str = Field(..., description="父件物料编码")
    parent_material_name: str = Field(..., description="父件物料名称")
    parent_batch_no: Optional[str] = Field(None, description="父件批次号")
    child_material_id: int = Field(..., description="子件物料ID")
    child_material_code: str = Field(..., description="子件物料编码")
    child_material_name: str = Field(..., description="子件物料名称")
    child_batch_no: str = Field(..., description="子件批次号")
    quantity: Decimal = Field(..., description="消耗数量")
    executed_by: int = Field(..., description="执行人ID")
    executed_by_name: str = Field(..., description="执行人姓名")
    executed_at: datetime = Field(..., description="执行时间")
    remarks: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(..., description="创建时间")


class ExecuteAssemblyOrderRequest(BaseModel):
    """组装单执行请求（支持物料绑定）"""
    material_bindings: Optional[List[AssemblyMaterialBindingCreate]] = Field(
        default_factory=list,
        description="物料绑定列表（可选，用于追溯）"
    )
