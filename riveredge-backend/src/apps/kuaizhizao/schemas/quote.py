from typing import List, Optional
from pydantic import BaseModel, Field


class QuoteItemResponse(BaseModel):
    """单项成本明细"""
    item_type: str = Field(..., description="成本类型: material, labor, overhead")
    name: str = Field(..., description="项目名称（如物料名称、工序名称）")
    code: Optional[str] = Field(None, description="项目编码")
    quantity: float = Field(0.0, description="用量/工时估算")
    unit: Optional[str] = Field(None, description="单位")
    unit_cost: float = Field(0.0, description="单位成本估价")
    total_cost: float = Field(0.0, description="小计成本")
    remark: Optional[str] = Field(None, description="备注（如：读取自标准成本）")


class QuoteBreakdownResponse(BaseModel):
    """产品快速核价结果报表"""
    material_id: int = Field(..., description="核价产品的主键 ID")
    material_code: str = Field(..., description="产品编码")
    material_name: str = Field(..., description="产品名称")
    material_spec: Optional[str] = Field(None, description="产品规格")
    
    # 成本分类明细
    material_costs: List[QuoteItemResponse] = Field(default_factory=list, description="直接材料成本明细")
    manufacturing_costs: List[QuoteItemResponse] = Field(default_factory=list, description="制造成本估算（人工+机器）")
    
    # 汇总数据
    total_material_cost: float = Field(0.0, description="合计材料成本")
    total_manufacturing_cost: float = Field(0.0, description="合计制造成本")
    total_estimated_cost: float = Field(0.0, description="综合预估底价")
    
    suggested_price: float = Field(0.0, description="系统建议对外报价（基于最低指导加成）")
