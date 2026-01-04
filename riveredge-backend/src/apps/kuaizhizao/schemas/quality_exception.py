"""
质量异常记录数据验证Schema模块

定义质量异常记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class QualityExceptionBase(BaseModel):
    """
    质量异常记录基础Schema

    包含所有质量异常记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    exception_type: str = Field(..., description="异常类型")
    work_order_id: Optional[int] = Field(None, description="关联工单ID")
    work_order_code: Optional[str] = Field(None, description="关联工单编码")
    material_id: Optional[int] = Field(None, description="关联物料ID")
    material_code: Optional[str] = Field(None, description="关联物料编码")
    material_name: Optional[str] = Field(None, description="关联物料名称")
    batch_no: Optional[str] = Field(None, description="批次号")
    inspection_record_id: Optional[int] = Field(None, description="关联检验记录ID")
    problem_description: str = Field(..., description="问题描述")
    severity: str = Field("minor", description="严重程度")
    status: str = Field("pending", description="处理状态")
    root_cause: Optional[str] = Field(None, description="根本原因")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    responsible_person_id: Optional[int] = Field(None, description="责任人ID")
    responsible_person_name: Optional[str] = Field(None, description="责任人姓名")
    planned_completion_date: Optional[datetime] = Field(None, description="计划完成日期")
    verification_result: Optional[str] = Field(None, description="验证结果")
    remarks: Optional[str] = Field(None, description="备注")


class QualityExceptionCreate(QualityExceptionBase):
    """
    质量异常记录创建Schema

    用于创建新质量异常记录的数据验证。
    """
    pass


class QualityExceptionUpdate(BaseModel):
    """
    质量异常记录更新Schema

    用于更新质量异常记录的数据验证。
    """
    model_config = ConfigDict(from_attributes=True)

    status: Optional[str] = Field(None, description="处理状态")
    root_cause: Optional[str] = Field(None, description="根本原因")
    corrective_action: Optional[str] = Field(None, description="纠正措施")
    preventive_action: Optional[str] = Field(None, description="预防措施")
    responsible_person_id: Optional[int] = Field(None, description="责任人ID")
    responsible_person_name: Optional[str] = Field(None, description="责任人姓名")
    planned_completion_date: Optional[datetime] = Field(None, description="计划完成日期")
    verification_result: Optional[str] = Field(None, description="验证结果")
    remarks: Optional[str] = Field(None, description="备注")


class QualityExceptionResponse(QualityExceptionBase):
    """
    质量异常记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    actual_completion_date: Optional[datetime] = Field(None, description="实际完成日期")
    handled_by: Optional[int] = Field(None, description="处理人ID")
    handled_by_name: Optional[str] = Field(None, description="处理人姓名")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class QualityExceptionListResponse(QualityExceptionResponse):
    """
    质量异常记录列表响应Schema

    用于质量异常记录列表API的响应数据格式。
    """
    pass

