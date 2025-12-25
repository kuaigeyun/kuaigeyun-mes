"""
考勤规则 Schema 模块
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from decimal import Decimal


class AttendanceRuleBase(BaseModel):
    """考勤规则基础 Schema"""
    
    rule_code: str = Field(..., max_length=50, description="规则编码（组织内唯一）")
    rule_name: str = Field(..., max_length=200, description="规则名称")
    rule_type: str = Field(..., max_length=50, description="规则类型（标准工时、弹性工时、综合工时等）")
    work_days: Optional[List[str]] = Field(None, description="工作日（JSON格式）")
    work_start_time: str = Field(..., max_length=10, description="上班时间（格式：HH:mm）")
    work_end_time: str = Field(..., max_length=10, description="下班时间（格式：HH:mm）")
    break_duration: int = Field(60, ge=0, description="休息时长（分钟）")
    late_tolerance: int = Field(15, ge=0, description="迟到容忍时间（分钟）")
    early_leave_tolerance: int = Field(15, ge=0, description="早退容忍时间（分钟）")
    overtime_threshold: Decimal = Field(Decimal("8.00"), ge=Decimal("0"), description="加班阈值（小时）")
    status: str = Field("启用", max_length=20, description="状态（启用、停用）")
    
    @validator("rule_code")
    def validate_rule_code(cls, v):
        if not v or not v.strip():
            raise ValueError("规则编码不能为空")
        return v.strip()


class AttendanceRuleCreate(AttendanceRuleBase):
    pass


class AttendanceRuleUpdate(BaseModel):
    rule_name: Optional[str] = Field(None, max_length=200)
    rule_type: Optional[str] = Field(None, max_length=50)
    work_days: Optional[List[str]] = None
    work_start_time: Optional[str] = Field(None, max_length=10)
    work_end_time: Optional[str] = Field(None, max_length=10)
    break_duration: Optional[int] = Field(None, ge=0)
    late_tolerance: Optional[int] = Field(None, ge=0)
    early_leave_tolerance: Optional[int] = Field(None, ge=0)
    overtime_threshold: Optional[Decimal] = Field(None, ge=Decimal("0"))
    status: Optional[str] = Field(None, max_length=20)


class AttendanceRuleResponse(AttendanceRuleBase):
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

