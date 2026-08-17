"""订单评审 Schema"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field, model_validator

from core.schemas.base import BaseSchema


SALES_REVIEW_DEPT_CODES = ("tech", "process", "purchase", "production", "quality")


class SalesReviewItemBase(BaseSchema):
    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: str = Field(..., max_length=50, description="物料编码")
    material_name: str = Field(..., max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="单位")
    quantity: Decimal = Field(..., gt=0, description="数量")
    unit_price: Decimal = Field(Decimal("0"), ge=0, description="单价")
    amount: Optional[Decimal] = Field(None, description="金额（服务端重算）")
    tech_requirements: Optional[str] = Field(None, description="技术要求")
    notes: Optional[str] = Field(None, description="备注")


class SalesReviewItemCreate(SalesReviewItemBase):
    pass


class SalesReviewItemUpdate(SalesReviewItemBase):
    id: Optional[int] = Field(None, description="明细ID（更新时）")


class SalesReviewItemResponse(SalesReviewItemBase):
    id: int
    sales_review_id: int
    line_no: int
    amount: Decimal


class SalesReviewDeptOpinionResponse(BaseSchema):
    id: int
    sales_review_id: int
    review_round: int
    dept_code: str
    result: str
    opinion: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class SalesReviewDeptOpinionSubmit(BaseSchema):
    result: str = Field(..., description="pass 或 fail")
    opinion: Optional[str] = Field(None, description="评审意见；fail 时建议填写原因")
    reviewed_by: Optional[int] = Field(
        None, description="评审人用户ID；缺省为当前操作人"
    )

    @model_validator(mode="after")
    def _validate_result(self):
        r = (self.result or "").strip().lower()
        if r not in ("pass", "fail"):
            raise ValueError("评审结果须为 pass 或 fail")
        # BaseSchema.validate_assignment=True：禁止 self.result= 触发二次校验递归
        object.__setattr__(self, "result", r)
        if r == "fail" and not (self.opinion or "").strip():
            raise ValueError("不通过时须填写评审意见")
        return self


class SalesReviewRejectRequest(BaseSchema):
    reason: Optional[str] = Field(None, description="驳回原因")


class SalesReviewBase(BaseSchema):
    customer_id: int = Field(..., description="客户ID")
    customer_code: Optional[str] = Field(None, max_length=50)
    customer_name: str = Field(..., max_length=200)
    customer_contact: Optional[str] = Field(None, max_length=100)
    customer_phone: Optional[str] = Field(None, max_length=50)
    project_name: str = Field(..., max_length=200, description="项目名称")
    review_date: Optional[date] = None
    delivery_date: Optional[date] = None
    urgency: str = Field("normal", max_length=20)
    risk_level: str = Field("medium", max_length=20)
    settlement_method: Optional[str] = Field(None, max_length=100)
    payment_cycle: Optional[str] = Field(None, max_length=100)
    delivery_location: Optional[str] = Field(None, max_length=200)
    transport_method: Optional[str] = Field(None, max_length=100)
    material_desc: Optional[str] = None
    spec_desc: Optional[str] = None
    process_desc: Optional[str] = None
    packaging_req: Optional[str] = None
    production_notes: Optional[str] = None
    sales_opinion: Optional[str] = None
    final_conclusion: Optional[str] = None
    remarks: Optional[str] = None
    attachments: Optional[List[Any]] = None
    quotation_id: Optional[int] = None
    quotation_code: Optional[str] = None
    customer_follow_up_id: Optional[int] = None
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None


class SalesReviewCreate(SalesReviewBase):
    review_code: Optional[str] = Field(None, description="手工单号；空则按规则生成")
    items: List[SalesReviewItemCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def _require_items(self):
        if not self.items:
            raise ValueError("评审单必须至少包含一条明细")
        return self


class SalesReviewUpdate(BaseSchema):
    customer_id: Optional[int] = None
    customer_code: Optional[str] = None
    customer_name: Optional[str] = None
    customer_contact: Optional[str] = None
    customer_phone: Optional[str] = None
    project_name: Optional[str] = None
    review_date: Optional[date] = None
    delivery_date: Optional[date] = None
    urgency: Optional[str] = None
    risk_level: Optional[str] = None
    settlement_method: Optional[str] = None
    payment_cycle: Optional[str] = None
    delivery_location: Optional[str] = None
    transport_method: Optional[str] = None
    material_desc: Optional[str] = None
    spec_desc: Optional[str] = None
    process_desc: Optional[str] = None
    packaging_req: Optional[str] = None
    production_notes: Optional[str] = None
    sales_opinion: Optional[str] = None
    final_conclusion: Optional[str] = None
    remarks: Optional[str] = None
    attachments: Optional[List[Any]] = None
    quotation_id: Optional[int] = None
    quotation_code: Optional[str] = None
    customer_follow_up_id: Optional[int] = None
    salesman_id: Optional[int] = None
    salesman_name: Optional[str] = None
    items: Optional[List[SalesReviewItemCreate]] = None


class SalesReviewResponse(SalesReviewBase):
    id: int
    uuid: str
    tenant_id: int
    review_code: str
    status: str
    review_round: int
    sales_order_id: Optional[int] = None
    sales_order_code: Optional[str] = None
    total_quantity: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    items: List[SalesReviewItemResponse] = Field(default_factory=list)
    dept_opinions: List[SalesReviewDeptOpinionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None


class SalesReviewListItem(BaseSchema):
    id: int
    review_code: str
    customer_id: int
    customer_name: str
    project_name: str
    status: str
    review_round: int
    urgency: str
    risk_level: str
    delivery_date: Optional[date] = None
    review_date: Optional[date] = None
    total_quantity: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    salesman_name: Optional[str] = None
    sales_order_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int] = None
    created_by_name: Optional[str] = None
    updated_by: Optional[int] = None
    updated_by_name: Optional[str] = None


class SalesReviewListEnvelope(BaseSchema):
    items: List[SalesReviewListItem]
    total: int
    skip: int = 0
    limit: int = 50


class SalesReviewPushPreview(BaseSchema):
    can_push: bool
    blocking_reason: Optional[str] = None
    review_code: str
    customer_name: str
    item_count: int
    total_quantity: Decimal
    total_amount: Decimal
    items: List[Dict[str, Any]] = Field(default_factory=list)


class SalesReviewPushResult(BaseSchema):
    success: bool
    message: str
    sales_order_id: Optional[int] = None
    sales_order_code: Optional[str] = None
