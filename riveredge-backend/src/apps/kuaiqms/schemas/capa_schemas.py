"""
CAPA Schema 模块

定义CAPA相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CAPABase(BaseModel):
    """CAPA基础 Schema"""
    
    capa_no: str = Field(..., max_length=50, description="CAPA编号")
    capa_type: str = Field(..., max_length=50, description="CAPA类型")
    source_type: Optional[str] = Field(None, max_length=50, description="来源类型")
    source_id: Optional[int] = Field(None, description="来源ID")
    source_no: Optional[str] = Field(None, max_length=50, description="来源编号")
    problem_description: str = Field(..., description="问题描述")
    root_cause: Optional[str] = Field(None, description="根本原因")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    planned_completion_date: Optional[datetime] = Field(None, description="计划完成日期")
    actual_completion_date: Optional[datetime] = Field(None, description="实际完成日期")
    effectiveness_evaluation: Optional[str] = Field(None, description="有效性评估")
    remark: Optional[str] = Field(None, description="备注")


class CAPACreate(CAPABase):
    """创建CAPA Schema"""
    pass


class CAPAUpdate(BaseModel):
    """更新CAPA Schema"""
    
    capa_type: Optional[str] = Field(None, max_length=50, description="CAPA类型")
    problem_description: Optional[str] = Field(None, description="问题描述")
    root_cause: Optional[str] = Field(None, description="根本原因")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    responsible_person_id: Optional[int] = Field(None, description="负责人ID")
    responsible_person_name: Optional[str] = Field(None, max_length=100, description="负责人姓名")
    planned_completion_date: Optional[datetime] = Field(None, description="计划完成日期")
    actual_completion_date: Optional[datetime] = Field(None, description="实际完成日期")
    effectiveness_evaluation: Optional[str] = Field(None, description="有效性评估")
    status: Optional[str] = Field(None, max_length=50, description="CAPA状态")
    remark: Optional[str] = Field(None, description="备注")


class CAPAResponse(CAPABase):
    """CAPA响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
