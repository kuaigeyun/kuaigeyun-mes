"""
客户跟进记录 Schema
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


class CustomerFollowUpBase(BaseSchema):
    """客户跟进基础"""

    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    activity_type_code: str = Field(..., max_length=50, description="跟进方式字典值")
    content: str = Field(..., description="跟进内容")
    occurred_at: datetime = Field(..., description="跟进发生时间")
    next_follow_up_at: Optional[datetime] = Field(None, description="计划下次跟进时间")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    quotation_code: Optional[str] = Field(None, max_length=50, description="关联报价单编码")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="关联销售订单编码")
    opportunity_id: Optional[int] = Field(None, description="关联销售商机ID")
    stage_code_before: Optional[str] = Field(None, max_length=50, description="跟进时商机阶段（变更前）")
    stage_code_after: Optional[str] = Field(None, max_length=50, description="跟进后商机阶段（变更后）")


class CustomerFollowUpCreate(BaseSchema):
    """创建客户跟进（客户名称与关联单据由服务校验后填充）"""

    customer_id: int = Field(..., description="客户ID")
    activity_type_code: str = Field(..., max_length=50, description="跟进方式字典值")
    content: str = Field(..., description="跟进内容")
    occurred_at: datetime = Field(..., description="跟进发生时间")
    next_follow_up_at: Optional[datetime] = Field(None, description="计划下次跟进时间")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    opportunity_id: Optional[int] = Field(None, description="关联销售商机ID")
    stage_code_after: Optional[str] = Field(None, max_length=50, description="跟进后目标阶段（变更时提交）")


class CustomerFollowUpUpdate(BaseSchema):
    """更新客户跟进"""

    customer_name: Optional[str] = Field(None, max_length=200, description="客户名称")
    activity_type_code: Optional[str] = Field(None, max_length=50, description="跟进方式字典值")
    content: Optional[str] = Field(None, description="跟进内容")
    occurred_at: Optional[datetime] = Field(None, description="跟进发生时间")
    next_follow_up_at: Optional[datetime] = Field(None, description="计划下次跟进时间")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    opportunity_id: Optional[int] = Field(None, description="关联销售商机ID")
    stage_code_after: Optional[str] = Field(None, max_length=50, description="跟进后目标阶段（变更时提交）")


class CustomerFollowUpResponse(CustomerFollowUpBase):
    """客户跟进响应"""

    id: int = Field(..., description="跟进记录ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")


class CustomerFollowUpListResponse(CustomerFollowUpResponse):
    """列表项"""

    pass


class CustomerFollowUpListEnvelope(BaseSchema):
    """分页列表"""

    items: List[CustomerFollowUpListResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")
