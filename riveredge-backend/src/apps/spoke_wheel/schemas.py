"""辐条轮毂总装 — Pydantic Schemas (请求/响应模型)"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SpokeWheelAssemblyCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True, validate_assignment=False, arbitrary_types_allowed=True)
    code: Optional[str] = Field(None, description="总装单号,留空由系统自动生成")
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    product_material_id: Optional[int] = None
    product_material_code: Optional[str] = None
    product_material_name: Optional[str] = None
    fixture_dial_count: int = 3
    remarks: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class SpokeWheelAssemblyUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True, validate_assignment=False, arbitrary_types_allowed=True)
    hub_assembled: Optional[bool] = None
    hub_barrel_assembled: Optional[bool] = None
    assembler_id: Optional[int] = None
    assembler_name: Optional[str] = None
    debugger_id: Optional[int] = None
    debugger_name: Optional[str] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None


class SpokeWheelAssemblyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    code: str
    work_order_id: Optional[int] = None
    work_order_code: Optional[str] = None
    product_material_id: Optional[int] = None
    product_material_code: Optional[str] = None
    product_material_name: Optional[str] = None
    hub_assembled: bool
    hub_barrel_assembled: bool
    hub_assembled_at: Optional[datetime] = None
    fixture_dial_count: int
    status: str
    assembler_id: Optional[int] = None
    assembler_name: Optional[str] = None
    debugger_id: Optional[int] = None
    debugger_name: Optional[str] = None
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    fixed_at: Optional[datetime] = None
    debug_started_at: Optional[datetime] = None
    debug_completed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    remarks: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    final_max_deviation_mm: Optional[Decimal] = None
    final_qc_passed: Optional[bool] = None
    created_at: datetime
    updated_at: datetime


class ConcentricityCheckCreate(BaseModel):
    model_config = ConfigDict(from_attributes=True, validate_assignment=False, arbitrary_types_allowed=True)
    assembly_id: int
    dial_1_value: Decimal = Field(..., description="百分表 1 读数 mm")
    dial_2_value: Decimal = Field(..., description="百分表 2 读数 mm")
    dial_3_value: Decimal = Field(..., description="百分表 3 读数 mm")
    tolerance_mm: Decimal = Field(default=Decimal("0.8"), description="允差阈值,默认 0.8mm")
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    remarks: Optional[str] = None
    measured_at: Optional[datetime] = None


class ConcentricityCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    uuid: str
    assembly_id: int
    assembly_code: str
    dial_1_value: Decimal
    dial_2_value: Decimal
    dial_3_value: Decimal
    max_deviation_mm: Decimal
    tolerance_mm: Decimal
    is_qualified: bool
    inspector_id: Optional[int] = None
    inspector_name: Optional[str] = None
    remarks: Optional[str] = None
    measured_at: Optional[datetime] = None
    created_at: datetime