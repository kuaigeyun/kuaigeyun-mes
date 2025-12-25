"""
实验管理 Schema 模块

定义实验管理相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime


class ExperimentManagementBase(BaseModel):
    """实验管理基础 Schema"""
    
    experiment_no: str = Field(..., max_length=100, description="实验编号")
    experiment_name: str = Field(..., max_length=200, description="实验名称")
    experiment_type: str = Field(..., max_length=50, description="实验类型")
    sample_id: Optional[int] = Field(None, description="样品ID")
    sample_uuid: Optional[str] = Field(None, max_length=36, description="样品UUID")
    sample_no: Optional[str] = Field(None, max_length=100, description="样品编号")
    plan_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    plan_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    experimenter_id: Optional[int] = Field(None, description="实验人员ID")
    experimenter_name: Optional[str] = Field(None, max_length=100, description="实验人员姓名")
    experiment_status: str = Field("计划中", max_length=50, description="实验状态")
    execution_records: Optional[Any] = Field(None, description="执行记录")
    confirmation_status: str = Field("待确认", max_length=50, description="确认状态")
    confirmation_person_id: Optional[int] = Field(None, description="确认人ID")
    confirmation_person_name: Optional[str] = Field(None, max_length=100, description="确认人姓名")
    confirmation_date: Optional[datetime] = Field(None, description="确认日期")
    status: str = Field("草稿", max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ExperimentManagementCreate(ExperimentManagementBase):
    """创建实验管理 Schema"""
    pass


class ExperimentManagementUpdate(BaseModel):
    """更新实验管理 Schema"""
    
    experiment_name: Optional[str] = Field(None, max_length=200, description="实验名称")
    experiment_type: Optional[str] = Field(None, max_length=50, description="实验类型")
    sample_id: Optional[int] = Field(None, description="样品ID")
    sample_uuid: Optional[str] = Field(None, max_length=36, description="样品UUID")
    sample_no: Optional[str] = Field(None, max_length=100, description="样品编号")
    plan_start_date: Optional[datetime] = Field(None, description="计划开始日期")
    plan_end_date: Optional[datetime] = Field(None, description="计划结束日期")
    actual_start_date: Optional[datetime] = Field(None, description="实际开始日期")
    actual_end_date: Optional[datetime] = Field(None, description="实际结束日期")
    experimenter_id: Optional[int] = Field(None, description="实验人员ID")
    experimenter_name: Optional[str] = Field(None, max_length=100, description="实验人员姓名")
    experiment_status: Optional[str] = Field(None, max_length=50, description="实验状态")
    execution_records: Optional[Any] = Field(None, description="执行记录")
    confirmation_status: Optional[str] = Field(None, max_length=50, description="确认状态")
    confirmation_person_id: Optional[int] = Field(None, description="确认人ID")
    confirmation_person_name: Optional[str] = Field(None, max_length=100, description="确认人姓名")
    confirmation_date: Optional[datetime] = Field(None, description="确认日期")
    status: Optional[str] = Field(None, max_length=50, description="状态")
    remark: Optional[str] = Field(None, description="备注")


class ExperimentManagementResponse(ExperimentManagementBase):
    """实验管理响应 Schema"""
    
    id: int
    uuid: str
    tenant_id: Optional[int]
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True

