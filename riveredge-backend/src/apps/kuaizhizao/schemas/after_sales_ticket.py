"""
售后服务工单 Schema
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import Field

from core.schemas.base import BaseSchema


REQUEST_TYPES = ("退货", "换货", "维修", "索赔", "咨询")
TICKET_STATUSES = ("待处理", "处理中", "已关闭")


class AfterSalesTicketItemCreate(BaseSchema):
    """售后明细创建/更新行"""

    material_id: Optional[int] = Field(None, description="物料ID")
    material_code: Optional[str] = Field(None, max_length=100, description="物料编码")
    material_name: Optional[str] = Field(None, max_length=200, description="物料名称")
    material_spec: Optional[str] = Field(None, max_length=200, description="规格")
    material_unit: Optional[str] = Field(None, max_length=20, description="单位")
    sales_order_item_id: Optional[int] = Field(None, description="来源销售订单明细ID")
    sales_delivery_item_id: Optional[int] = Field(None, description="来源销售出库明细ID")
    batch_no: Optional[str] = Field(None, max_length=100, description="批次号")
    quantity: Optional[Decimal] = Field(None, description="数量")
    claim_amount: Optional[Decimal] = Field(None, description="行索赔金额")
    notes: Optional[str] = Field(None, description="行备注")


class AfterSalesTicketItemResponse(AfterSalesTicketItemCreate):
    """售后明细响应"""

    id: int = Field(..., description="明细ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    ticket_id: int = Field(..., description="工单ID")
    line_no: int = Field(1, description="行号")


class AfterSalesTicketCreate(BaseSchema):
    """创建售后服务工单"""

    customer_id: int = Field(..., description="客户ID")
    request_type: str = Field(..., max_length=20, description="诉求类型")
    content: str = Field(..., description="问题描述")
    registered_at: Optional[datetime] = Field(None, description="登记时间（缺省为当前业务时刻）")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    items: List[AfterSalesTicketItemCreate] = Field(default_factory=list, description="明细行")


class AfterSalesTicketUpdate(BaseSchema):
    """更新售后服务工单"""

    request_type: Optional[str] = Field(None, max_length=20, description="诉求类型")
    content: Optional[str] = Field(None, description="问题描述")
    status: Optional[str] = Field(None, max_length=20, description="工单状态")
    resolution: Optional[str] = Field(None, description="处理结论")
    registered_at: Optional[datetime] = Field(None, description="登记时间")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    items: Optional[List[AfterSalesTicketItemCreate]] = Field(None, description="明细行（传入则整表替换）")


class AfterSalesTicketClose(BaseSchema):
    """关闭售后服务工单"""

    resolution: Optional[str] = Field(None, description="处理结论")


class AfterSalesTicketPullFromSalesOrderRequest(BaseSchema):
    """从销售订单上拉创建售后服务工单"""

    sales_order_id: int = Field(..., description="销售订单ID")
    request_type: Optional[str] = Field("退货", max_length=20, description="诉求类型")
    content: Optional[str] = Field(None, description="问题描述（缺省自动生成）")
    selected_item_ids: Optional[List[int]] = Field(None, description="所选销售订单明细ID（空=全部）")


class AfterSalesTicketPullFromSalesDeliveryRequest(BaseSchema):
    """从销售出库单上拉创建售后服务工单"""

    sales_delivery_id: int = Field(..., description="销售出库单ID")
    request_type: Optional[str] = Field("退货", max_length=20, description="诉求类型")
    content: Optional[str] = Field(None, description="问题描述（缺省自动生成）")
    selected_item_ids: Optional[List[int]] = Field(None, description="所选销售出库明细ID（空=全部）")


class AfterSalesTicketPushToRepairOrderRequest(BaseSchema):
    """下推维修单"""

    service_asset_id: Optional[int] = Field(None, description="装机档案ID")
    repair_mode: Optional[str] = Field("现场", max_length=20, description="维修方式")
    fault_category: Optional[str] = Field(None, max_length=100, description="故障分类")
    fault_description: Optional[str] = Field(None, description="故障描述（缺省用工单内容）")
    site_address: Optional[str] = Field(None, max_length=500, description="现场地址")


class AfterSalesTicketPushToSalesReturnRequest(BaseSchema):
    """下推销售退货单"""

    warehouse_id: int = Field(..., description="退货仓库ID")
    warehouse_name: Optional[str] = Field(None, description="退货仓库名称")
    return_quantities: Optional[Dict[int, float]] = Field(
        None, description="按销售订单明细ID的退货数量"
    )
    batch_numbers: Optional[Dict[int, str]] = Field(
        None, description="按销售订单明细ID的批次号"
    )
    return_code: Optional[str] = Field(None, description="退货单号（可选）")


class AfterSalesTicketPushPreviewLine(BaseSchema):
    """下推预览行"""

    ticket_item_id: Optional[int] = None
    sales_order_item_id: Optional[int] = None
    material_id: Optional[int] = None
    material_code: Optional[str] = None
    material_name: Optional[str] = None
    material_spec: Optional[str] = None
    material_unit: Optional[str] = None
    batch_no: Optional[str] = None
    ticket_quantity: Optional[Decimal] = None
    returnable_quantity: Optional[Decimal] = None
    return_quantity: Optional[Decimal] = None


class AfterSalesTicketPushPreviewResponse(BaseSchema):
    """下推销售退货预览"""

    ticket_id: int
    ticket_code: str
    sales_order_id: int
    sales_order_code: Optional[str] = None
    has_blocking_issues: bool = False
    blocking_reason: Optional[str] = None
    lines: List[AfterSalesTicketPushPreviewLine] = Field(default_factory=list)
    message: Optional[str] = None


class AfterSalesTicketResponse(BaseSchema):
    """售后服务工单响应"""

    id: int = Field(..., description="工单ID")
    uuid: str = Field(..., max_length=36, description="业务UUID")
    tenant_id: int = Field(..., description="租户ID")
    ticket_code: str = Field(..., description="工单编码")
    customer_id: int = Field(..., description="客户ID")
    customer_name: str = Field(..., description="客户名称")
    sales_order_id: Optional[int] = Field(None, description="关联销售订单ID")
    sales_order_code: Optional[str] = Field(None, description="关联销售订单编码")
    sales_delivery_id: Optional[int] = Field(None, description="关联销售出库单ID")
    sales_delivery_code: Optional[str] = Field(None, description="关联销售出库单编码")
    sales_return_id: Optional[int] = Field(None, description="关联销售退货单ID")
    sales_return_code: Optional[str] = Field(None, description="关联销售退货单编码")
    request_type: str = Field(..., description="诉求类型")
    status: str = Field(..., description="工单状态")
    content: str = Field(..., description="问题描述")
    resolution: Optional[str] = Field(None, description="处理结论")
    claim_amount: Optional[Decimal] = Field(None, description="索赔金额合计")
    registered_at: datetime = Field(..., description="登记时间")
    closed_at: Optional[datetime] = Field(None, description="关闭时间")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    created_by: Optional[int] = Field(None, description="创建人ID")
    updated_by: Optional[int] = Field(None, description="更新人ID")
    created_by_name: Optional[str] = Field(None, description="创建人显示名")
    updated_by_name: Optional[str] = Field(None, description="更新人显示名")
    items: List[AfterSalesTicketItemResponse] = Field(default_factory=list, description="明细行")
    item_count: int = Field(0, description="明细行数")
    existing_repair_order_code: Optional[str] = Field(None, description="已下推维修单号")
    capabilities: Optional[Dict[str, Any]] = Field(None, description="业务态动作能力")


class AfterSalesTicketListEnvelope(BaseSchema):
    """分页列表"""

    items: List[AfterSalesTicketResponse] = Field(default_factory=list, description="当前页数据")
    total: int = Field(0, description="总条数")
