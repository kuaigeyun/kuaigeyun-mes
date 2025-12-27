"""
评估报告 Schema 模块

定义评估报告数据的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class AssessmentReportBase(BaseModel):
    """评估报告基础 Schema"""
    
    report_no: str = Field(..., max_length=50, description="报告编号（组织内唯一）")
    status: str = Field("待处理", max_length=50, description="状态")
    
    @validator("report_no")
    def validate_report_no(cls, v):
        """验证报告编号格式"""
        if not v or not v.strip():
            raise ValueError("报告编号不能为空")
        return v.strip()


class AssessmentReportCreate(AssessmentReportBase):
    """创建评估报告 Schema"""
    pass


class AssessmentReportUpdate(BaseModel):
    """更新评估报告 Schema"""
    
    status: Optional[str] = Field(None, max_length=50, description="状态")


class AssessmentReportResponse(AssessmentReportBase):
    """评估报告响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
