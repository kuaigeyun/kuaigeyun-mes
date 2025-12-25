"""
服务合同 Schema 模块

定义服务合同数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime


class ServiceContractBase(BaseModel):
    """服务合同基础 Schema"""
    
    contract_no: str = Field(..., max_length=50, description="合同编号")
    customer_id: int = Field(..., description="客户ID（关联master-data）")
    contract_type: str = Field(..., max_length=50, description="合同类型")
    contract_start_date: datetime = Field(..., description="合同开始日期")
    contract_end_date: datetime = Field(..., description="合同结束日期")
    contract_status: str = Field("有效", max_length=20, description="合同状态")
    
    @validator("contract_no")
    def validate_contract_no(cls, v):
        """验证合同编号格式"""
        if not v or not v.strip():
            raise ValueError("合同编号不能为空")
        return v.strip().upper()
    
    @validator("contract_end_date")
    def validate_contract_end_date(cls, v, values):
        """验证合同结束日期必须晚于开始日期"""
        if 'contract_start_date' in values and v < values['contract_start_date']:
            raise ValueError("合同结束日期必须晚于开始日期")
        return v


class ServiceContractCreate(ServiceContractBase):
    """创建服务合同 Schema"""
    pass


class ServiceContractUpdate(BaseModel):
    """更新服务合同 Schema"""
    
    contract_type: Optional[str] = Field(None, max_length=50, description="合同类型")
    contract_start_date: Optional[datetime] = Field(None, description="合同开始日期")
    contract_end_date: Optional[datetime] = Field(None, description="合同结束日期")
    contract_status: Optional[str] = Field(None, max_length=20, description="合同状态")


class ServiceContractResponse(ServiceContractBase):
    """服务合同响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
