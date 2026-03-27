from typing import List, Optional, Any
from pydantic import BaseModel, Field

class WavePickingGenerateRequest(BaseModel):
    picking_ids: List[int] = Field(..., description="要合并的领料单ID列表")

class MergedPickingItem(BaseModel):
    warehouse_id: Optional[int] = None
    warehouse_name: str = ""
    location_code: str = ""
    material_id: Optional[int] = None
    material_code: str = ""
    material_name: str = ""
    total_quantity: float = 0.0
    unit: str = ""
    source_pickings: List[str] = []

class WavePickingResponse(BaseModel):
    wave_code: str = Field(..., description="波次编码")
    source_picking_ids: List[int] = Field(..., description="原始领料单ID列表")
    total_items: int = Field(..., description="合并后的明细行数")
    merged_items: List[MergedPickingItem] = Field(..., description="合并后的明细列表")
