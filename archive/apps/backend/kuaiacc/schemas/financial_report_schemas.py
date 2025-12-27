"""
财务报表 Schema 模块

定义财务报表数据的 Pydantic Schema，用于数据验证和序列化。
按照中国企业会计准则：资产负债表、利润表、现金流量表。
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any
from datetime import datetime


class FinancialReportBase(BaseModel):
    """财务报表基础 Schema"""
    
    report_no: str = Field(..., max_length=50, description="报表编号（组织内唯一）")
    report_type: str = Field(..., max_length=50, description="报表类型（资产负债表、利润表、现金流量表、成本报表）")
    report_period: str = Field(..., max_length=20, description="报表期间（格式：2024-01、2024）")
    report_date: datetime = Field(..., description="报表日期")
    year: int = Field(..., ge=2000, le=9999, description="年度")
    month: Optional[int] = Field(None, ge=1, le=12, description="月份（月报时使用，年报为null）")
    report_data: Optional[Dict[str, Any]] = Field(None, description="报表数据（JSON格式，存储报表各项数据）")
    status: str = Field("草稿", max_length=20, description="状态（草稿、已生成、已审核、已发布）")
    reviewed_by: Optional[int] = Field(None, description="审核人ID")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")
    
    @validator("report_no")
    def validate_report_no(cls, v):
        """验证报表编号格式"""
        if not v or not v.strip():
            raise ValueError("报表编号不能为空")
        return v.strip()
    
    @validator("report_type")
    def validate_report_type(cls, v):
        """验证报表类型"""
        allowed_types = ["资产负债表", "利润表", "现金流量表", "成本报表"]
        if v not in allowed_types:
            raise ValueError(f"报表类型必须是以下之一：{', '.join(allowed_types)}")
        return v
    
    @validator("report_period")
    def validate_report_period(cls, v, values):
        """验证报表期间格式"""
        if "report_type" in values:
            if values["report_type"] in ["资产负债表", "利润表", "现金流量表"]:
                # 月报格式：2024-01，年报格式：2024
                if "-" in v:
                    parts = v.split("-")
                    if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
                        raise ValueError("月报期间格式应为：YYYY-MM（如：2024-01）")
                    if int(parts[1]) < 1 or int(parts[1]) > 12:
                        raise ValueError("月份必须在1-12之间")
                elif not v.isdigit() or len(v) != 4:
                    raise ValueError("年报期间格式应为：YYYY（如：2024）")
        return v


class FinancialReportCreate(FinancialReportBase):
    """创建财务报表 Schema"""
    pass


class FinancialReportUpdate(BaseModel):
    """更新财务报表 Schema"""
    
    report_type: Optional[str] = Field(None, max_length=50, description="报表类型")
    report_period: Optional[str] = Field(None, max_length=20, description="报表期间")
    report_date: Optional[datetime] = Field(None, description="报表日期")
    year: Optional[int] = Field(None, ge=2000, le=9999, description="年度")
    month: Optional[int] = Field(None, ge=1, le=12, description="月份")
    report_data: Optional[Dict[str, Any]] = Field(None, description="报表数据")
    status: Optional[str] = Field(None, max_length=20, description="状态")
    reviewed_by: Optional[int] = Field(None, description="审核人ID")
    reviewed_at: Optional[datetime] = Field(None, description="审核时间")


class FinancialReportResponse(FinancialReportBase):
    """财务报表响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

