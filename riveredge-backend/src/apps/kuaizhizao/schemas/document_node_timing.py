"""
单据节点耗时记录数据验证Schema模块

定义单据节点耗时记录相关的Pydantic数据验证Schema。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from decimal import Decimal


class DocumentNodeTimingBase(BaseModel):
    """
    单据节点耗时记录基础Schema

    包含所有单据节点耗时记录的基本字段。
    """
    model_config = ConfigDict(from_attributes=True)

    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    document_code: str = Field(..., description="单据编码")
    node_name: str = Field(..., description="节点名称")
    node_code: str = Field(..., description="节点编码")
    start_time: Optional[datetime] = Field(None, description="节点开始时间")
    end_time: Optional[datetime] = Field(None, description="节点结束时间")
    operator_id: Optional[int] = Field(None, description="操作人ID")
    operator_name: Optional[str] = Field(None, description="操作人姓名")
    remarks: Optional[str] = Field(None, description="备注")


class DocumentNodeTimingCreate(DocumentNodeTimingBase):
    """
    单据节点耗时记录创建Schema

    用于创建新单据节点耗时记录的数据验证。
    """
    pass


class DocumentNodeTimingResponse(DocumentNodeTimingBase):
    """
    单据节点耗时记录响应Schema

    用于API响应的数据格式。
    """
    id: int = Field(..., description="记录ID")
    uuid: str = Field(..., description="业务ID")
    duration_seconds: Optional[int] = Field(None, description="节点耗时（秒）")
    duration_hours: Optional[Decimal] = Field(None, description="节点耗时（小时）")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")


class DocumentNodeTimingListResponse(DocumentNodeTimingResponse):
    """
    单据节点耗时记录列表响应Schema

    用于单据节点耗时记录列表API的响应数据格式。
    """
    pass


class DocumentTimingSummaryResponse(BaseModel):
    """
    单据耗时汇总响应Schema

    用于返回单据的耗时汇总信息。
    """
    model_config = ConfigDict(from_attributes=True)

    document_type: str = Field(..., description="单据类型")
    document_id: int = Field(..., description="单据ID")
    document_code: str = Field(..., description="单据编码")
    total_duration_seconds: Optional[int] = Field(None, description="总耗时（秒）")
    total_duration_hours: Optional[Decimal] = Field(None, description="总耗时（小时）")
    nodes: list[DocumentNodeTimingResponse] = Field(default_factory=list, description="节点列表")

