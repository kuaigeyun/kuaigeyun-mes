"""
叫料请求 Schema 模块

定义叫料请求相关的 Pydantic 模型。
"""

from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class MaterialCallRequestBase(BaseModel):
    """叫料请求基础字段"""
    work_order_id: int
    work_order_code: str
    material_id: int
    material_code: str
    material_name: str
    material_unit: Optional[str] = None
    requested_quantity: Decimal
    call_type: str = Field(
        default="SINGLE_MATERIAL",
        description="叫料类型：数据字典 MATERIAL_CALL_TYPE（SINGLE_MATERIAL / FULL_ORDER 等）",
    )
    call_reason: Optional[str] = Field(
        default=None,
        description="叫料原因：数据字典 MATERIAL_CALL_REASON；单物料叫料必填，整单叫料可空",
    )
    source_warehouse_id: Optional[int] = None
    target_warehouse_id: Optional[int] = None
    priority: str = "normal"
    needed_at: Optional[datetime] = None
    remarks: Optional[str] = None


class MaterialCallRequestCreate(MaterialCallRequestBase):
    """创建叫料请求专用"""
    caller_id: int
    caller_name: str


class MaterialCallRequestUpdate(BaseModel):
    """更新叫料请求专用"""
    requested_quantity: Optional[Decimal] = None
    delivered_quantity: Optional[Decimal] = None
    status: Optional[str] = None
    handler_id: Optional[int] = None
    handler_name: Optional[str] = None
    priority: Optional[str] = None
    remarks: Optional[str] = None


class MaterialCallRequestResponse(MaterialCallRequestBase):
    """叫料请求标准响应"""
    id: int
    code: str
    delivered_quantity: Decimal
    status: str
    caller_id: int
    caller_name: str
    handler_id: Optional[int] = None
    handler_name: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialCallRequestListResponse(BaseModel):
    """叫料请求列表项响应"""
    id: int
    code: str
    work_order_code: str
    material_code: str
    material_name: str
    requested_quantity: Decimal
    delivered_quantity: Decimal
    status: str
    call_type: str = "SINGLE_MATERIAL"
    priority: str
    caller_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MaterialCallBatchFromWorkOrderRequest(BaseModel):
    """按工单整单发起叫料（齐套分析缺料行逐条生成）"""

    work_order_id: int = Field(..., description="工单ID")
