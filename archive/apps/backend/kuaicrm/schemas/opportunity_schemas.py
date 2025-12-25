"""
商机 Schema 模块

定义商机数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class OpportunityBase(BaseModel):
    """商机基础 Schema"""
    
    oppo_no: str = Field(..., max_length=50, description="商机编号")
    oppo_name: str = Field(..., max_length=200, description="商机名称")
    customer_id: Optional[int] = Field(None, description="客户ID（关联master-data）")
    stage: str = Field("初步接触", max_length=50, description="商机阶段")
    amount: Optional[Decimal] = Field(None, description="商机金额")
    expected_close_date: Optional[datetime] = Field(None, description="预计成交日期")
    source: Optional[str] = Field(None, max_length=50, description="商机来源")
    lead_id: Optional[int] = Field(None, description="关联线索ID")
    owner_id: Optional[int] = Field(None, description="负责人（用户ID）")
    probability: Decimal = Field(Decimal("0"), ge=Decimal("0"), le=Decimal("100"), description="成交概率（0-100）")
    status: str = Field("进行中", max_length=20, description="商机状态")
    
    @validator("oppo_no")
    def validate_oppo_no(cls, v):
        """验证商机编号格式"""
        if not v or not v.strip():
            raise ValueError("商机编号不能为空")
        return v.strip().upper()
    
    @validator("oppo_name")
    def validate_oppo_name(cls, v):
        """验证商机名称格式"""
        if not v or not v.strip():
            raise ValueError("商机名称不能为空")
        return v.strip()


class OpportunityCreate(OpportunityBase):
    """创建商机 Schema"""
    pass


class OpportunityUpdate(BaseModel):
    """更新商机 Schema"""
    
    oppo_name: Optional[str] = Field(None, max_length=200, description="商机名称")
    customer_id: Optional[int] = Field(None, description="客户ID")
    stage: Optional[str] = Field(None, max_length=50, description="商机阶段")
    amount: Optional[Decimal] = Field(None, description="商机金额")
    expected_close_date: Optional[datetime] = Field(None, description="预计成交日期")
    owner_id: Optional[int] = Field(None, description="负责人（用户ID）")
    probability: Optional[Decimal] = Field(None, ge=Decimal("0"), le=Decimal("100"), description="成交概率")
    status: Optional[str] = Field(None, max_length=20, description="商机状态")


class OpportunityResponse(OpportunityBase):
    """商机响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
