"""
销售商机 Schema
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


TERMINAL_STAGE_CODES = frozenset({"WON", "LOST"})


class SalesOpportunityBase(BaseSchema):
    """销售商机基础"""

    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., max_length=200, description="客户名称")
    title: str = Field(..., max_length=200, description="商机名称")
    stage_code: str = Field(..., max_length=50, description="漏斗阶段字典值")
    status: str = Field("open", max_length=20, description="open / won / lost")
    expected_amount: Optional[Decimal] = Field(None, description="预计金额")
    expected_close_date: Optional[date] = Field(None, description="预计成交日期")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    quotation_code: Optional[str] = Field(None, max_length=50, description="关联报价单编码")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_order_code: Optional[str] = Field(None, max_length=50, description="关联销售订单编码")
    last_follow_up_at: Optional[datetime] = Field(None, description="最近跟进时间")
    next_follow_up_at: Optional[datetime] = Field(None, description="计划下次跟进时间")


class SalesOpportunityCreate(BaseSchema):
    """创建销售商机"""

    customer_id: int = Field(..., description="客户ID")
    title: str = Field(..., max_length=200, description="商机名称")
    stage_code: str = Field("INITIAL", max_length=50, description="初始阶段")
    expected_amount: Optional[Decimal] = Field(None, description="预计金额")
    expected_close_date: Optional[date] = Field(None, description="预计成交日期")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")


class SalesOpportunityUpdate(BaseSchema):
    """更新销售商机"""

    title: Optional[str] = Field(None, max_length=200, description="商机名称")
    stage_code: Optional[str] = Field(None, max_length=50, description="漏斗阶段")
    expected_amount: Optional[Decimal] = Field(None, description="预计金额")
    expected_close_date: Optional[date] = Field(None, description="预计成交日期")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    next_follow_up_at: Optional[datetime] = Field(None, description="计划下次跟进时间")


class SalesOpportunityEnsure(BaseSchema):
    """确保存在 open 商机（单据关联或客户默认跟进载体）"""

    customer_id: int = Field(..., description="客户ID")
    quotation_id: Optional[int] = Field(None, description="关联报价单ID")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    title: Optional[str] = Field(None, max_length=200, description="新建商机标题（可选）")


class SalesOpportunityResponse(SalesOpportunityBase):
    """销售商机响应"""

    id: int = Field(..., description="商机ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")


class SalesOpportunityListEnvelope(BaseSchema):
    """商机列表"""

    items: List[SalesOpportunityResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")
