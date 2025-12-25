"""
节能管理 Schema 模块

定义节能管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from decimal import Decimal


class EnergySavingManagementBase(BaseModel):
    """节能管理基础 Schema"""
    
    management_no: str = Field(..., max_length=100, description="管理编号")
    management_name: str = Field(..., max_length=200, description="管理名称")
    management_type: str = Field(..., max_length=50, description="管理类型")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    target_value: Optional[Decimal] = Field(None, description="目标值")
    current_value: Optional[Decimal] = Field(None, description="当前值")
    achievement_rate: Optional[Decimal] = Field(None, description="达成率")
    saving_amount: Optional[Decimal] = Field(None, description="节约量")
    saving_rate: Optional[Decimal] = Field(None, description="节约率")
    measure_description: Optional[str] = Field(None, description="措施描述")
    measure_status: str = Field("待执行", max_length=50, description="措施状态")
    effect_evaluation: Optional[Any] = Field(None, description="效果评估")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergySavingManagementCreate(EnergySavingManagementBase):
    """创建节能管理 Schema"""
    pass


class EnergySavingManagementUpdate(BaseModel):
    """更新节能管理 Schema"""
    
    management_name: Optional[str] = Field(None, max_length=200, description="管理名称")
    management_type: Optional[str] = Field(None, max_length=50, description="管理类型")
    energy_type: Optional[str] = Field(None, max_length=50, description="能源类型")
    target_value: Optional[Decimal] = Field(None, description="目标值")
    current_value: Optional[Decimal] = Field(None, description="当前值")
    achievement_rate: Optional[Decimal] = Field(None, description="达成率")
    saving_amount: Optional[Decimal] = Field(None, description="节约量")
    saving_rate: Optional[Decimal] = Field(None, description="节约率")
    measure_description: Optional[str] = Field(None, description="措施描述")
    measure_status: Optional[str] = Field(None, max_length=50, description="措施状态")
    effect_evaluation: Optional[Any] = Field(None, description="效果评估")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class EnergySavingManagementResponse(EnergySavingManagementBase):
    """节能管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

