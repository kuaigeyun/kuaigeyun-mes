"""
异常处理记录数据验证Schema模块

定义异常处理记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2026-01-16
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict


class ExceptionProcessRecordBase(BaseModel):
    """
    异常处理记录基础Schema

    包含所有异常处理记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    exception_type: str = Field(..., description="异常类型")
    exception_id: int = Field(..., description="异常记录ID")
    process_status: str = Field("pending", description="处理流程状态")
    current_step: str = Field("detected", description="当前步骤")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    assigned_to_name: Optional[str] = Field(None, description="分配给（用户名）")
    assigned_at: Optional[datetime] = Field(None, description="分配时间")
    process_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（JSON格式）")
    started_at: Optional[datetime] = Field(None, description="开始时间")
    completed_at: Optional[datetime] = Field(None, description="完成时间")
    remarks: Optional[str] = Field(None, description="备注")


class ExceptionProcessRecordCreate(BaseModel):
    """
    异常处理记录创建Schema

    用于创建新异常处理记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    exception_type: str = Field(..., description="异常类型")
    exception_id: int = Field(..., description="异常记录ID")
    process_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（JSON格式）")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    remarks: Optional[str] = Field(None, description="备注")


class ExceptionProcessRecordUpdate(BaseModel):
    """
    异常处理记录更新Schema

    用于更新异常处理记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    process_status: Optional[str] = Field(None, description="处理流程状态")
    current_step: Optional[str] = Field(None, description="当前步骤")
    assigned_to: Optional[int] = Field(None, description="分配给（用户ID）")
    process_config: Optional[Dict[str, Any]] = Field(None, description="流程配置（JSON格式）")
    remarks: Optional[str] = Field(None, description="备注")


class ExceptionProcessRecordResponse(ExceptionProcessRecordBase):
    """
    异常处理记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    inngest_run_id: Optional[str] = Field(None, description="Inngest运行ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ExceptionProcessRecordListResponse(ExceptionProcessRecordResponse):
    """
    异常处理记录列表响应Schema

    用于异常处理记录列表API的响应数据格式。
    """
    pass


class ExceptionProcessHistoryBase(BaseModel):
    """
    异常处理历史记录基础Schema

    包含所有异常处理历史记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    process_record_id: int = Field(..., description="处理记录ID")
    action: str = Field(..., description="操作类型")
    action_by: int = Field(..., description="操作人ID")
    action_by_name: str = Field(..., description="操作人姓名")
    action_at: datetime = Field(..., description="操作时间")
    from_step: Optional[str] = Field(None, description="来源步骤")
    to_step: Optional[str] = Field(None, description="目标步骤")
    comment: Optional[str] = Field(None, description="操作说明")


class ExceptionProcessHistoryCreate(BaseModel):
    """
    异常处理历史记录创建Schema

    用于创建新异常处理历史记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    process_record_id: int = Field(..., description="处理记录ID")
    action: str = Field(..., description="操作类型")
    action_by: int = Field(..., description="操作人ID")
    from_step: Optional[str] = Field(None, description="来源步骤")
    to_step: Optional[str] = Field(None, description="目标步骤")
    comment: Optional[str] = Field(None, description="操作说明")


class ExceptionProcessHistoryResponse(ExceptionProcessHistoryBase):
    """
    异常处理历史记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class ExceptionProcessRecordDetailResponse(ExceptionProcessRecordResponse):
    """
    异常处理记录详情响应Schema

    包含历史记录的完整信息。
    """
    histories: List[ExceptionProcessHistoryResponse] = Field(default_factory=list, description="处理历史记录列表")


class ExceptionProcessStepTransitionRequest(BaseModel):
    """
    异常处理步骤流转请求Schema

    用于步骤流转的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    to_step: str = Field(..., description="目标步骤")
    comment: Optional[str] = Field(None, description="操作说明")


class ExceptionProcessAssignRequest(BaseModel):
    """
    异常处理分配请求Schema

    用于分配异常处理的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    assigned_to: int = Field(..., description="分配给（用户ID）")
    comment: Optional[str] = Field(None, description="操作说明")


class ExceptionProcessResolveRequest(BaseModel):
    """
    异常处理解决请求Schema

    用于解决异常的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    comment: Optional[str] = Field(None, description="操作说明")
    verification_result: Optional[str] = Field(None, description="验证结果")
