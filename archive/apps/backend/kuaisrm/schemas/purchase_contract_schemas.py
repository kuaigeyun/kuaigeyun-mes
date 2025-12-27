"""
采购合同 Schema 模块

定义采购合同相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class PurchaseContractBase(BaseModel):
    """采购合同基础 Schema"""
    
    contract_no: str = Field(..., max_length=50, description="合同编号")
    contract_name: str = Field(..., max_length=200, description="合同名称")
    supplier_id: int = Field(..., description="供应商ID")
    contract_date: datetime = Field(..., description="合同签订日期")
    start_date: Optional[datetime] = Field(None, description="合同开始日期")
    end_date: Optional[datetime] = Field(None, description="合同结束日期")
    total_amount: Decimal = Field(0, description="合同总金额")
    currency: str = Field("CNY", max_length=10, description="币种")
    contract_content: Optional[Dict[str, Any]] = Field(None, description="合同内容")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class PurchaseContractCreate(PurchaseContractBase):
    """创建采购合同 Schema"""
    pass


class PurchaseContractUpdate(BaseModel):
    """更新采购合同 Schema"""
    
    contract_name: Optional[str] = Field(None, max_length=200, description="合同名称")
    supplier_id: Optional[int] = Field(None, description="供应商ID")
    contract_date: Optional[datetime] = Field(None, description="合同签订日期")
    start_date: Optional[datetime] = Field(None, description="合同开始日期")
    end_date: Optional[datetime] = Field(None, description="合同结束日期")
    status: Optional[str] = Field(None, max_length=50, description="合同状态")
    total_amount: Optional[Decimal] = Field(None, description="合同总金额")
    currency: Optional[str] = Field(None, max_length=10, description="币种")
    contract_content: Optional[Dict[str, Any]] = Field(None, description="合同内容")
    remark: Optional[str] = Field(None, description="备注")
    owner_id: Optional[int] = Field(None, description="负责人ID")


class PurchaseContractResponse(PurchaseContractBase):
    """采购合同响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    approval_instance_id: Optional[int] = None
    approval_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
