"""
工作台Dashboard API模块

提供工作台相关的API接口，包括待办事项、统计数据等。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional
import re
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from datetime import date, datetime, timedelta

from core.api.deps import get_current_user, get_current_tenant
from core.utils.api_cache import cache_by_kwargs
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from infra.models.user import User
from apps.kuaizhizao.services.work_order_service import WorkOrderService
from apps.kuaizhizao.services.menu_badge_counts_service import fetch_menu_badge_counts
from apps.kuaizhizao.services.exception_service import (
    ACTIVE_EXCEPTION_STATUSES,
    ACTIVE_QUALITY_EXCEPTION_STATUSES,
)
from apps.kuaizhizao.models.material_shortage_exception import MaterialShortageException
from apps.kuaizhizao.models.delivery_delay_exception import DeliveryDelayException
from apps.kuaizhizao.models.quality_exception import QualityException
from apps.kuaizhizao.models.inventory_alert import InventoryAlert
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.rework_order import ReworkOrder
from loguru import logger

router = APIRouter(prefix="/dashboard", tags=["App - Kuaige Zhizao - Dashboard"])

_MONEY_META_KEYS = frozenset({
    "amount", "total_amount", "price", "unit_price", "total_value", "total_price",
})


def _str_val(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _format_qty(value: object) -> Optional[str]:
    if value is None:
        return None
    try:
        qty = Decimal(str(value))
        if qty == qty.to_integral_value():
            return str(int(qty))
        normalized = qty.normalize()
        return format(normalized, "f").rstrip("0").rstrip(".") or "0"
    except Exception:
        return _str_val(value)


def _join_parts(*parts: Optional[str]) -> Optional[str]:
    items = [part.strip() for part in parts if part and str(part).strip()]
    return " - ".join(items) if items else None


def _todo_meta(**kwargs: object) -> Optional[dict[str, str]]:
    out: dict[str, str] = {}
    for key, value in kwargs.items():
        if key in _MONEY_META_KEYS:
            continue
        text = _str_val(value)
        if text:
            out[key] = text
    return out or None


def _date_to_due(value: object) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    return None


def _format_date(value: object) -> Optional[str]:
    due = _date_to_due(value)
    return due.strftime("%Y-%m-%d") if due else None


class TodoItem(BaseModel):
    """待办事项项"""
    id: str = Field(..., description="待办事项ID")
    type: str = Field(
        ...,
        description=(
            "待办类型：work_order / exception / quality_inspection / warehouse / outbound / "
            "purchase / sales / equipment"
        ),
    )
    title: str = Field(..., description="待办事项标题")
    description: Optional[str] = Field(None, description="待办事项描述")
    meta: Optional[dict[str, str]] = Field(None, description="待办详情 i18n 参数（不含金额）")
    priority: str = Field(..., description="优先级（high/medium/low）")
    due_date: Optional[datetime] = Field(None, description="截止日期")
    status: str = Field(..., description="状态（pending/in_progress/completed）")
    link: Optional[str] = Field(None, description="跳转链接")
    created_at: datetime = Field(..., description="创建时间")


class TodoListResponse(BaseModel):
    """待办事项列表响应"""
    items: List[TodoItem] = Field(default_factory=list, description="待办事项列表")
    total: int = Field(0, description="总数")


# 模块中心待办：按 todo id 前缀过滤
MODULE_TODO_ID_PREFIXES: dict[str, tuple[str, ...]] = {
    "sales": ("shipment_notice_", "sales_return_", "sales_delivery_"),
    "purchase": ("purchase_requisition_", "purchase_return_", "receipt_notice_", "purchase_receipt_"),
    "manufacturing": (
        "work_order_", "exception_material_", "production_return_",
        "production_picking_", "material_call_", "exception_delay_",
    ),
    "warehouse": (
        "inventory_alert_", "purchase_receipt_", "finished_goods_receipt_",
        "other_inbound_", "other_outbound_", "sales_delivery_",
        "material_borrow_", "material_return_",
    ),
    "quality": (
        "inspection_incoming_", "inspection_process_",
        "inspection_finished_", "exception_quality_",
    ),
    "equipment": ("equipment_fault_",),
}


def _filter_todos_by_module(items: List[TodoItem], module: Optional[str]) -> List[TodoItem]:
    if not module:
        return items
    prefixes = MODULE_TODO_ID_PREFIXES.get(module.strip().lower())
    if not prefixes:
        return items
    return [t for t in items if any(t.id.startswith(p) for p in prefixes)]


class StatisticsResponse(BaseModel):
    """统计数据响应"""
    production: dict = Field(default_factory=dict, description="生产统计")
    inventory: dict = Field(default_factory=dict, description="库存统计")
    quality: dict = Field(default_factory=dict, description="质量统计")


class DashboardResponse(BaseModel):
    """工作台数据响应"""
    todos: TodoListResponse = Field(..., description="待办事项")
    statistics: StatisticsResponse = Field(..., description="统计数据")


@router.get("/todos", response_model=TodoListResponse, summary="List todos")
@cache_by_kwargs(namespace="dashboard:todos", ttl=30)
async def get_todos(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    module: Optional[str] = Query(
        None,
        description="模块过滤：sales/purchase/manufacturing/warehouse/quality/equipment",
    ),
) -> TodoListResponse:
    """
    获取待办事项列表

    包括：待处理工单、生产异常、库存预警、入库/出库/借还料、收货发货通知、
    采购申请待审核与采购退货、销售退货、叫料、设备故障待处理、各类检验待检验等。
    """
    import asyncio as _asyncio

    # 每种来源独立 fetcher：内部自己 try/except，不会互相拖累；一次 gather 并发所有
    # 首次 cache miss 时耗时 ≈ max(单表查询) 而不是 sum（从 ~500ms 降到 ~50ms 级别）

    async def _fetch_work_orders() -> List[TodoItem]:
        try:
            wos = await WorkOrderService().list_work_orders(
                tenant_id=tenant_id, status="released", skip=0, limit=limit,
            )
            out: List[TodoItem] = []
            for wo in wos:
                qty = _format_qty(wo.quantity)
                meta = _todo_meta(
                    product_name=wo.product_name,
                    quantity=qty,
                    work_center_name=wo.work_center_name,
                    planned_start=_format_date(wo.planned_start_date),
                    planned_end=_format_date(wo.planned_end_date),
                )
                out.append(TodoItem(
                    id=f"work_order_{wo.id}",
                    type="work_order",
                    title=f"处理工单 {wo.code}",
                    description=_join_parts(
                        f"产品：{wo.product_name}",
                        f"数量：{qty}" if qty else None,
                        f"工作中心：{wo.work_center_name}" if wo.work_center_name else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=wo.planned_end_date,
                    status="pending",
                    link=f"/apps/kuaizhizao/production-execution/work-orders/{wo.id}",
                    created_at=wo.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取待处理工单失败: {e}")
            return []

    async def _fetch_material_shortages() -> List[TodoItem]:
        try:
            rows = await MaterialShortageException.filter(
                tenant_id=tenant_id, status__in=ACTIVE_EXCEPTION_STATUSES,
            ).limit(limit)
            out: List[TodoItem] = []
            for exc in rows:
                shortage_qty = _format_qty(exc.shortage_quantity)
                meta = _todo_meta(
                    material_name=exc.material_name,
                    shortage_quantity=shortage_qty,
                    work_order_code=exc.work_order_code,
                    required_quantity=_format_qty(exc.required_quantity),
                )
                out.append(TodoItem(
                    id=f"exception_material_{exc.id}",
                    type="exception",
                    title=f"缺料异常：{exc.material_name}",
                    description=_join_parts(
                        f"缺料数量：{shortage_qty}" if shortage_qty else None,
                        f"工单：{exc.work_order_code}",
                    ),
                    meta=meta,
                    priority=exc.alert_level or "medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/production-execution/material-shortage-exceptions",
                    created_at=exc.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取缺料异常待办失败: {e}")
            return []

    async def _fetch_delivery_delays() -> List[TodoItem]:
        try:
            rows = await DeliveryDelayException.filter(
                tenant_id=tenant_id, status__in=ACTIVE_EXCEPTION_STATUSES,
            ).limit(limit)
            out: List[TodoItem] = []
            for exc in rows:
                meta = _todo_meta(
                    work_order_code=exc.work_order_code,
                    delay_days=exc.delay_days,
                    planned_end=_format_date(exc.planned_end_date),
                )
                out.append(TodoItem(
                    id=f"exception_delay_{exc.id}",
                    type="exception",
                    title=f"延期异常：{exc.work_order_code}",
                    description=_join_parts(
                        f"延期天数：{exc.delay_days}天",
                        f"计划完工：{_format_date(exc.planned_end_date)}" if exc.planned_end_date else None,
                    ),
                    meta=meta,
                    priority="high",
                    due_date=exc.planned_end_date,
                    status="pending",
                    link="/apps/kuaizhizao/production-execution/delivery-delay-exceptions",
                    created_at=exc.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取延期异常待办失败: {e}")
            return []

    async def _fetch_quality_exceptions() -> List[TodoItem]:
        try:
            rows = await QualityException.filter(
                tenant_id=tenant_id,
                status__in=ACTIVE_QUALITY_EXCEPTION_STATUSES,
                deleted_at__isnull=True,
            ).limit(limit)
            out: List[TodoItem] = []
            for exc in rows:
                summary = (exc.problem_description or "")[:120] if exc.problem_description else None
                label = exc.material_name or exc.work_order_code or exc.exception_type
                meta = _todo_meta(
                    exception_type=exc.exception_type,
                    summary=summary,
                    severity=exc.severity,
                    work_order_code=exc.work_order_code,
                    material_name=exc.material_name,
                )
                out.append(TodoItem(
                    id=f"exception_quality_{exc.id}",
                    type="exception",
                    title=f"质量异常：{label}",
                    description=summary or exc.problem_description,
                    meta=meta,
                    priority=exc.severity or "medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/production-execution/quality-exceptions",
                    created_at=exc.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取质量异常待办失败: {e}")
            return []

    async def _fetch_inventory_alerts() -> List[TodoItem]:
        try:
            rows = await InventoryAlert.filter(
                tenant_id=tenant_id, deleted_at__isnull=True,
                status__in=["pending", "processing"],
            ).order_by("-triggered_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                lvl = (row.alert_level or "warning").lower()
                prio = "high" if lvl == "critical" else ("medium" if lvl == "warning" else "low")
                current_qty = _format_qty(row.current_quantity)
                alert_msg = (row.alert_message or "")[:120] if row.alert_message else None
                meta = _todo_meta(
                    material_name=row.material_name or row.material_code,
                    warehouse_name=row.warehouse_name,
                    current_quantity=current_qty,
                    alert_message=alert_msg,
                )
                out.append(TodoItem(
                    id=f"inventory_alert_{row.id}",
                    type="warehouse",
                    title=f"库存预警：{row.material_name or row.material_code}",
                    description=_join_parts(
                        row.warehouse_name,
                        f"当前 {current_qty}" if current_qty else None,
                    ),
                    meta=meta,
                    priority=prio,
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/inventory-alert",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取库存预警待办失败: {e}")
            return []

    async def _fetch_purchase_receipts() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                _INBOUND_PENDING_STATUSES,
            )
            rows = await PurchaseReceipt.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=tuple(_INBOUND_PENDING_STATUSES),
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for pr in rows:
                qty = _format_qty(pr.total_quantity)
                meta = _todo_meta(
                    supplier_name=pr.supplier_name,
                    warehouse_name=pr.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"purchase_receipt_{pr.id}",
                    type="warehouse",
                    title=f"待入库：{pr.receipt_code}",
                    description=_join_parts(pr.supplier_name, pr.warehouse_name, f"数量 {qty}" if qty else None),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/inbound",
                    created_at=pr.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取待入库待办失败: {e}")
            return []

    async def _fetch_finished_goods_receipts() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                _INBOUND_PENDING_STATUSES,
            )
            rows = await FinishedGoodsReceipt.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=tuple(_INBOUND_PENDING_STATUSES),
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for fg in rows:
                qty = _format_qty(fg.total_quantity)
                meta = _todo_meta(
                    work_order_code=fg.work_order_code,
                    warehouse_name=fg.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"finished_goods_receipt_{fg.id}",
                    type="warehouse",
                    title=f"成品待入库：{fg.receipt_code}",
                    description=_join_parts(fg.work_order_code, fg.warehouse_name, f"数量 {qty}" if qty else None),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/inbound",
                    created_at=fg.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取成品待入库待办失败: {e}")
            return []

    async def _fetch_production_returns() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.production_return import ProductionReturn
            rows = await ProductionReturn.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待退料"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                meta = _todo_meta(
                    work_order_code=row.work_order_code,
                    warehouse_name=row.warehouse_name,
                )
                out.append(TodoItem(
                    id=f"production_return_{row.id}",
                    type="warehouse",
                    title=f"生产退料待确认：{row.return_code}",
                    description=_join_parts(row.work_order_code, row.warehouse_name),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/inbound",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取生产退料待办失败: {e}")
            return []

    async def _fetch_other_inbounds() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.other_inbound import OtherInbound
            from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
                _INBOUND_PENDING_STATUSES,
            )
            rows = await OtherInbound.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                status__in=tuple(_INBOUND_PENDING_STATUSES),
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    reason_type=row.reason_type,
                    warehouse_name=row.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"other_inbound_{row.id}",
                    type="warehouse",
                    title=f"其他入库待确认：{row.inbound_code}",
                    description=_join_parts(row.reason_type, row.warehouse_name, f"数量 {qty}" if qty else None),
                    meta=meta,
                    priority="low",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/other-inbound",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取其他入库待办失败: {e}")
            return []

    async def _fetch_material_borrows() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.material_borrow import MaterialBorrow
            rows = await MaterialBorrow.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待借出"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                meta = _todo_meta(
                    borrower_name=row.borrower_name,
                    warehouse_name=row.warehouse_name,
                )
                out.append(TodoItem(
                    id=f"material_borrow_{row.id}",
                    type="warehouse",
                    title=f"借料待确认：{row.borrow_code}",
                    description=_join_parts(row.borrower_name, row.warehouse_name),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/material-borrows",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取借料待办失败: {e}")
            return []

    async def _fetch_material_returns() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.material_return import MaterialReturn
            rows = await MaterialReturn.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待归还"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                meta = _todo_meta(
                    borrow_code=row.borrow_code,
                    warehouse_name=row.warehouse_name,
                )
                out.append(TodoItem(
                    id=f"material_return_{row.id}",
                    type="warehouse",
                    title=f"还料待确认：{row.return_code}",
                    description=_join_parts(f"借料单 {row.borrow_code}", row.warehouse_name),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/material-returns",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取还料待办失败: {e}")
            return []

    async def _fetch_material_calls() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
            rows = await MaterialCallRequest.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="pending"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                pr = (row.priority or "normal").lower()
                if pr in ("urgent", "high"):
                    prio = "high"
                elif pr == "low":
                    prio = "low"
                else:
                    prio = "medium"
                qty = _format_qty(row.requested_quantity)
                qty_text = f"{qty}{row.material_unit}" if qty and row.material_unit else qty
                meta = _todo_meta(
                    work_order_code=row.work_order_code,
                    material_name=row.material_name,
                    quantity=qty_text or qty,
                    caller_name=row.caller_name,
                )
                out.append(TodoItem(
                    id=f"material_call_{row.id}",
                    type="warehouse",
                    title=f"叫料待处理：{row.code}",
                    description=_join_parts(
                        row.work_order_code,
                        row.material_name,
                        f"数量 {qty_text}" if qty_text else None,
                        row.caller_name,
                    ),
                    meta=meta,
                    priority=prio,
                    due_date=row.needed_at,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/batching-center",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取叫料待办失败: {e}")
            return []

    async def _fetch_receipt_notices() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.receipt_notice import ReceiptNotice
            rows = await ReceiptNotice.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待收货"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    supplier_name=row.supplier_name,
                    purchase_order_code=row.purchase_order_code,
                    quantity=qty,
                    planned_date=_format_date(row.planned_receipt_date),
                )
                out.append(TodoItem(
                    id=f"receipt_notice_{row.id}",
                    type="purchase",
                    title=f"收货通知待收货：{row.notice_code}",
                    description=_join_parts(
                        row.supplier_name,
                        row.purchase_order_code,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=_date_to_due(row.planned_receipt_date),
                    status="pending",
                    link="/apps/kuaizhizao/purchase-management/receipt-notices",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取收货通知待办失败: {e}")
            return []

    async def _fetch_production_pickings() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.production_picking import ProductionPicking
            rows = await ProductionPicking.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待领料"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                meta = _todo_meta(
                    work_order_code=row.work_order_code,
                    workshop_name=row.workshop_name,
                    picker_name=row.picker_name,
                )
                out.append(TodoItem(
                    id=f"production_picking_{row.id}",
                    type="outbound",
                    title=f"生产领料待确认：{row.picking_code}",
                    description=_join_parts(
                        f"工单 {row.work_order_code}",
                        row.workshop_name,
                        row.picker_name,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/outbound",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取生产领料待办失败: {e}")
            return []

    async def _fetch_sales_deliveries() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery
            rows = await SalesDelivery.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待出库"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    customer_name=row.customer_name,
                    warehouse_name=row.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"sales_delivery_{row.id}",
                    type="outbound",
                    title=f"销售出库待确认：{row.delivery_code}",
                    description=_join_parts(
                        row.customer_name,
                        row.warehouse_name,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/outbound",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取销售出库待办失败: {e}")
            return []

    async def _fetch_other_outbounds() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.other_outbound import OtherOutbound
            rows = await OtherOutbound.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待出库"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    reason_type=row.reason_type,
                    warehouse_name=row.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"other_outbound_{row.id}",
                    type="outbound",
                    title=f"其他出库待确认：{row.outbound_code}",
                    description=_join_parts(
                        row.reason_type,
                        row.warehouse_name,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="low",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/warehouse-management/other-outbound",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取其他出库待办失败: {e}")
            return []

    async def _fetch_purchase_requisitions() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
            from apps.kuaizhizao.constants import DocumentStatus
            rows = await PurchaseRequisition.filter(
                tenant_id=tenant_id, deleted_at__isnull=True,
                status__in=(
                    DocumentStatus.PENDING_REVIEW.value,
                    "待审核", "PENDING_REVIEW", "PENDING",
                ),
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                meta = _todo_meta(
                    requisition_name=row.requisition_name,
                    applicant_name=row.applicant_name,
                )
                out.append(TodoItem(
                    id=f"purchase_requisition_{row.id}",
                    type="purchase",
                    title=f"采购申请待审核：{row.requisition_code}",
                    description=_join_parts(row.requisition_name, row.applicant_name),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/purchase-management/purchase-requisitions",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取采购申请待办失败: {e}")
            return []

    async def _fetch_purchase_returns() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.purchase_return import PurchaseReturn
            rows = await PurchaseReturn.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待退货"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    supplier_name=row.supplier_name,
                    warehouse_name=row.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"purchase_return_{row.id}",
                    type="purchase",
                    title=f"采购退货待确认：{row.return_code}",
                    description=_join_parts(
                        row.supplier_name,
                        row.warehouse_name,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/purchase-management/purchase-returns",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取采购退货待办失败: {e}")
            return []

    async def _fetch_shipment_notices() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.shipment_notice import ShipmentNotice
            rows = await ShipmentNotice.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待发货"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                address = (row.shipping_address or "")[:80] if row.shipping_address else None
                meta = _todo_meta(
                    customer_name=row.customer_name,
                    sales_order_code=row.sales_order_code,
                    quantity=qty,
                    warehouse_name=row.warehouse_name,
                    planned_date=_format_date(row.planned_ship_date),
                    detail=address,
                )
                out.append(TodoItem(
                    id=f"shipment_notice_{row.id}",
                    type="sales",
                    title=f"发货通知待发货：{row.notice_code}",
                    description=_join_parts(
                        row.customer_name,
                        row.sales_order_code,
                        f"数量 {qty}" if qty else None,
                        row.warehouse_name,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=_date_to_due(row.planned_ship_date),
                    status="pending",
                    link="/apps/kuaizhizao/sales-management/shipment-notices",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取发货通知待办失败: {e}")
            return []

    async def _fetch_sales_returns() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.sales_return import SalesReturn
            rows = await SalesReturn.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待退货"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                qty = _format_qty(row.total_quantity)
                meta = _todo_meta(
                    customer_name=row.customer_name,
                    warehouse_name=row.warehouse_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"sales_return_{row.id}",
                    type="sales",
                    title=f"销售退货待确认：{row.return_code}",
                    description=_join_parts(
                        row.customer_name,
                        row.warehouse_name,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/sales-management/sales-returns",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取销售退货待办失败: {e}")
            return []

    async def _fetch_equipment_faults() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.equipment_fault import EquipmentFault
            rows = await EquipmentFault.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待处理"
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for row in rows:
                lvl = (row.fault_level or "").strip()
                if "紧急" in lvl or "严重" in lvl:
                    prio = "high"
                elif "一般" in lvl or "轻微" in lvl:
                    prio = "low"
                else:
                    prio = "medium"
                meta = _todo_meta(
                    equipment_name=row.equipment_name,
                    fault_type=row.fault_type,
                    fault_level=row.fault_level,
                )
                out.append(TodoItem(
                    id=f"equipment_fault_{row.id}",
                    type="equipment",
                    title=f"设备故障待处理：{row.fault_no}",
                    description=_join_parts(row.equipment_name, row.fault_type, row.fault_level),
                    meta=meta,
                    priority=prio,
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/equipment-management/equipment-faults",
                    created_at=row.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取设备故障待办失败: {e}")
            return []

    async def _fetch_incoming_inspections() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
            rows = await IncomingInspection.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待检验",
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for ins in rows:
                qty = _format_qty(ins.inspection_quantity)
                meta = _todo_meta(
                    material_name=ins.material_name,
                    supplier_name=ins.supplier_name,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"inspection_incoming_{ins.id}",
                    type="quality_inspection",
                    title=f"来料待检：{ins.inspection_code}",
                    description=_join_parts(
                        ins.material_name,
                        ins.supplier_name,
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/quality-management/incoming-inspection",
                    created_at=ins.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取来料检验待办失败: {e}")
            return []

    async def _fetch_process_inspections() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.process_inspection import ProcessInspection
            rows = await ProcessInspection.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待检验",
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for ins in rows:
                qty = _format_qty(ins.inspection_quantity)
                meta = _todo_meta(
                    operation_name=ins.operation_name,
                    work_order_code=ins.work_order_code,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"inspection_process_{ins.id}",
                    type="quality_inspection",
                    title=f"过程待检：{ins.inspection_code}",
                    description=_join_parts(
                        ins.operation_name,
                        f"工单 {ins.work_order_code}",
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/quality-management/process-inspection",
                    created_at=ins.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取过程检验待办失败: {e}")
            return []

    async def _fetch_finished_inspections() -> List[TodoItem]:
        try:
            from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
            rows = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id, deleted_at__isnull=True, status="待检验",
            ).order_by("-created_at").limit(limit)
            out: List[TodoItem] = []
            for ins in rows:
                qty = _format_qty(ins.inspection_quantity)
                meta = _todo_meta(
                    material_name=ins.material_name,
                    work_order_code=ins.work_order_code,
                    quantity=qty,
                )
                out.append(TodoItem(
                    id=f"inspection_finished_{ins.id}",
                    type="quality_inspection",
                    title=f"成品待检：{ins.inspection_code}",
                    description=_join_parts(
                        ins.material_name,
                        f"工单 {ins.work_order_code}",
                        f"数量 {qty}" if qty else None,
                    ),
                    meta=meta,
                    priority="medium",
                    due_date=None,
                    status="pending",
                    link="/apps/kuaizhizao/quality-management/finished-goods-inspection",
                    created_at=ins.created_at,
                ))
            return out
        except Exception as e:
            logger.error(f"获取成品检验待办失败: {e}")
            return []

    results = await _asyncio.gather(
        _fetch_work_orders(),
        _fetch_material_shortages(),
        _fetch_delivery_delays(),
        _fetch_quality_exceptions(),
        _fetch_inventory_alerts(),
        _fetch_purchase_receipts(),
        _fetch_finished_goods_receipts(),
        _fetch_production_returns(),
        _fetch_other_inbounds(),
        _fetch_material_borrows(),
        _fetch_material_returns(),
        _fetch_material_calls(),
        _fetch_receipt_notices(),
        _fetch_production_pickings(),
        _fetch_sales_deliveries(),
        _fetch_other_outbounds(),
        _fetch_purchase_requisitions(),
        _fetch_purchase_returns(),
        _fetch_shipment_notices(),
        _fetch_sales_returns(),
        _fetch_equipment_faults(),
        _fetch_incoming_inspections(),
        _fetch_process_inspections(),
        _fetch_finished_inspections(),
    )

    todos: List[TodoItem] = [item for sublist in results for item in sublist]

    todos.sort(key=lambda x: (
        {"high": 0, "critical": 0, "medium": 1, "low": 2}.get((x.priority or "medium").lower(), 3),
        x.created_at
    ))

    if module:
        todos = _filter_todos_by_module(todos, module)

    return TodoListResponse(
        items=todos[:limit],
        total=len(todos),
    )


@router.post("/todos/{todo_id}/handle", summary="Handle todo")
async def handle_todo(
    todo_id: str,
    action: str = Query("handle", description="处理动作（handle: 跳转处理, ignore: 忽略）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    处理待办事项
    
    根据待办事项类型执行相应的处理动作。
    工单和异常待办事项返回跳转链接，实际处理在对应的详情页完成。
    
    - **todo_id**: 待办事项ID（格式：work_order_{id} 或 exception_material_{id} 等）
    - **action**: 处理动作（handle: 处理/跳转, ignore: 忽略）
    """
    # 解析待办事项ID
    if todo_id.startswith("work_order_"):
        # 工单待办事项：返回跳转链接
        work_order_id = int(todo_id.replace("work_order_", ""))
        return {
            "success": True,
            "message": "请前往工单详情页进行处理",
            "todo_id": todo_id,
            "redirect": f"/apps/kuaizhizao/production-execution/work-orders/{work_order_id}",
        }
    elif todo_id.startswith("exception_material_"):
        return {
            "success": True,
            "message": "请前往缺料异常列表处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/production-execution/material-shortage-exceptions",
        }
    elif todo_id.startswith("exception_delay_"):
        return {
            "success": True,
            "message": "请前往延期异常列表处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/production-execution/delivery-delay-exceptions",
        }
    elif todo_id.startswith("exception_quality_"):
        return {
            "success": True,
            "message": "请前往质量异常详情页进行处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/production-execution/quality-exceptions",
        }
    elif todo_id.startswith("inventory_alert_"):
        return {
            "success": True,
            "message": "请前往库存预警处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/inventory-alert",
        }
    elif todo_id.startswith("purchase_receipt_"):
        return {
            "success": True,
            "message": "请前往采购入库处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/inbound",
        }
    elif todo_id.startswith("finished_goods_receipt_"):
        return {
            "success": True,
            "message": "请前往入库管理处理成品入库",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/inbound",
        }
    elif todo_id.startswith("production_return_"):
        return {
            "success": True,
            "message": "请前往入库管理处理生产退料",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/inbound",
        }
    elif todo_id.startswith("other_inbound_"):
        return {
            "success": True,
            "message": "请前往其他入库处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/other-inbound",
        }
    elif todo_id.startswith("material_borrow_"):
        return {
            "success": True,
            "message": "请前往借料单处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/material-borrows",
        }
    elif todo_id.startswith("material_return_"):
        return {
            "success": True,
            "message": "请前往还料单处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/material-returns",
        }
    elif todo_id.startswith("material_call_"):
        return {
            "success": True,
            "message": "请前往叫料处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/batching-center",
        }
    elif todo_id.startswith("receipt_notice_"):
        return {
            "success": True,
            "message": "请前往收货通知处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/purchase-management/receipt-notices",
        }
    elif todo_id.startswith("production_picking_"):
        return {
            "success": True,
            "message": "请前往出库管理处理生产领料",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/outbound",
        }
    elif todo_id.startswith("sales_delivery_"):
        return {
            "success": True,
            "message": "请前往出库管理处理销售出库",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/outbound",
        }
    elif todo_id.startswith("other_outbound_"):
        return {
            "success": True,
            "message": "请前往其他出库处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/warehouse-management/other-outbound",
        }
    elif todo_id.startswith("purchase_requisition_"):
        return {
            "success": True,
            "message": "请前往采购申请审核",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/purchase-management/purchase-requisitions",
        }
    elif todo_id.startswith("purchase_return_"):
        return {
            "success": True,
            "message": "请前往采购退货处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/purchase-management/purchase-returns",
        }
    elif todo_id.startswith("shipment_notice_"):
        return {
            "success": True,
            "message": "请前往发货通知处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/sales-management/shipment-notices",
        }
    elif todo_id.startswith("sales_return_"):
        return {
            "success": True,
            "message": "请前往销售退货处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/sales-management/sales-returns",
        }
    elif todo_id.startswith("equipment_fault_"):
        return {
            "success": True,
            "message": "请前往设备故障处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/equipment-management/equipment-faults",
        }
    elif todo_id.startswith("inspection_incoming_"):
        return {
            "success": True,
            "message": "请前往来料检验处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/quality-management/incoming-inspection",
        }
    elif todo_id.startswith("inspection_process_"):
        return {
            "success": True,
            "message": "请前往过程检验处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/quality-management/process-inspection",
        }
    elif todo_id.startswith("inspection_finished_"):
        return {
            "success": True,
            "message": "请前往成品检验处理",
            "todo_id": todo_id,
            "redirect": "/apps/kuaizhizao/quality-management/finished-goods-inspection",
        }
    else:
        return {
            "success": False,
            "message": f"未知的待办事项类型: {todo_id}",
            "todo_id": todo_id,
        }


@router.get("/statistics", response_model=StatisticsResponse, summary="Statistics overview")
@cache_by_kwargs(namespace="dashboard:statistics", ttl=60)
async def get_statistics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> StatisticsResponse:
    """
    获取统计数据
    
    包括：
    - 生产统计（工单数量、完成率、在制品数量、订单数、商品数、生产计划数、完工数量、不良品率、产能达成率等）
    - 库存统计（库存总量、库存周转率、预警数量等）
    - 质量统计（合格率、不良品数量、质量异常数量等）
    """
    from datetime import datetime, timedelta
    
    # 解析时间范围
    date_start_dt = None
    date_end_dt = None
    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            pass
    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
            # 结束日期包含整天，所以设置为当天的23:59:59
            date_end_dt = date_end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    
    statistics = StatisticsResponse()
    
    try:
        # 生产统计
        from apps.kuaizhizao.services.reporting_service import ReportingService
        from apps.kuaizhizao.services.defect_record_service import DefectRecordService
        from apps.kuaizhizao.models.sales_order import SalesOrder
        from apps.kuaizhizao.models.work_order import WorkOrder
        from decimal import Decimal
        
        # 获取工单统计
        work_order_query = WorkOrder.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if date_start_dt:
            work_order_query = work_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            work_order_query = work_order_query.filter(created_at__lte=date_end_dt)
        
        work_orders = await work_order_query.all()
        
        total_work_orders = len(work_orders)
        completed_work_orders = len([wo for wo in work_orders if wo.status == "completed"])
        in_progress_work_orders = len([wo for wo in work_orders if wo.status == "in_progress"])
        
        # 计算完工数量（已完成工单的计划数量总和，WorkOrder 使用 quantity 表示计划数量）
        completed_quantity = sum(
            float(wo.quantity) for wo in work_orders 
            if wo.status == "completed" and wo.quantity
        )
        
        # 获取订单统计
        sales_order_query = SalesOrder.filter(tenant_id=tenant_id)
        if date_start_dt:
            sales_order_query = sales_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            sales_order_query = sales_order_query.filter(created_at__lte=date_end_dt)
        
        sales_orders = await sales_order_query.all()
        order_count = len(sales_orders)
        
        # 计算商品数（订单中不同商品的数量）
        product_codes = set()
        for so in sales_orders:
            if hasattr(so, 'items') and so.items:
                for item in so.items:
                    if hasattr(item, 'product_code'):
                        product_codes.add(item.product_code)
        product_count = len(product_codes)
        
        # 计算生产计划数（所有工单的计划数量总和，WorkOrder 使用 quantity 表示计划数量）
        plan_quantity = sum(
            float(wo.quantity) for wo in work_orders 
            if wo.quantity
        )
        
        # 获取报工统计，计算不良品率
        reporting_service = ReportingService()
        reporting_stats = await reporting_service.get_reporting_statistics(
            tenant_id=tenant_id,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        total_reported_quantity = float(reporting_stats.get("total_reported_quantity", 0)) if reporting_stats else 0
        total_unqualified_quantity = float(reporting_stats.get("total_unqualified_quantity", 0)) if reporting_stats else 0
        first_pass_yield_rate = float(reporting_stats.get("first_pass_yield_rate", 0)) if reporting_stats else 0
        defect_rate = (total_unqualified_quantity / total_reported_quantity * 100) if total_reported_quantity > 0 else 0
        
        # 计算产能达成率（实际完工数量 / 计划数量 * 100）
        capacity_achievement_rate = (completed_quantity / plan_quantity * 100) if plan_quantity > 0 else 0
        
        statistics.production = {
            "total": total_work_orders,
            "completed": completed_work_orders,
            "in_progress": in_progress_work_orders,
            "completion_rate": round(completed_work_orders / total_work_orders * 100, 2) if total_work_orders > 0 else 0,
            "order_count": order_count,
            "product_count": product_count,
            "plan_quantity": round(plan_quantity, 2),
            "completed_quantity": round(completed_quantity, 2),
            "defect_rate": round(defect_rate, 2),
            "first_pass_yield_rate": round(first_pass_yield_rate, 2),
            "capacity_achievement_rate": round(capacity_achievement_rate, 2),
        }
    except Exception as e:
        logger.error(f"获取生产统计失败: {e}")
        statistics.production = {
            "total": 0,
            "completed": 0,
            "in_progress": 0,
            "completion_rate": 0,
            "order_count": 0,
            "product_count": 0,
            "plan_quantity": 0,
            "completed_quantity": 0,
            "defect_rate": 0,
            "first_pass_yield_rate": 0,
            "capacity_achievement_rate": 0,
        }
    
    try:
        # 库存统计
        # 获取库存预警数量
        alert_count = await InventoryAlert.filter(
            tenant_id=tenant_id,
            status="open",
        ).count()
        
        # TODO: 实现完整的库存统计逻辑（总数量、总价值、周转率等）
        # 当前先返回预警数量
        statistics.inventory = {
            "total_quantity": 0,
            "total_value": 0,
            "turnover_rate": 0,
            "alert_count": alert_count,
        }
    except Exception as e:
        logger.error(f"获取库存统计失败: {e}")
        statistics.inventory = {
            "total_quantity": 0,
            "total_value": 0,
            "turnover_rate": 0,
            "alert_count": 0,
        }
    
    try:
        # 质量统计
        from apps.kuaizhizao.services.reporting_service import ReportingService
        
        # 获取质量异常统计
        quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
        ).all()
        
        open_quality_exceptions = await QualityException.filter(
            tenant_id=tenant_id,
            status__in=ACTIVE_QUALITY_EXCEPTION_STATUSES,
            deleted_at__isnull=True,
        ).all()
        
        # 获取报工统计，计算合格率
        reporting_service = ReportingService()
        reporting_stats = await reporting_service.get_reporting_statistics(
            tenant_id=tenant_id,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        quality_rate = reporting_stats.get("qualification_rate", 0) if reporting_stats else 0
        first_pass_yield_rate = reporting_stats.get("first_pass_yield_rate", 0) if reporting_stats else 0
        
        statistics.quality = {
            "total_exceptions": len(quality_exceptions),
            "open_exceptions": len(open_quality_exceptions),
            "quality_rate": round(quality_rate, 2),
            "first_pass_yield_rate": round(first_pass_yield_rate, 2),
        }
    except Exception as e:
        logger.error(f"获取质量统计失败: {e}")
        statistics.quality = {
            "total_exceptions": 0,
            "open_exceptions": 0,
            "quality_rate": 0,
            "first_pass_yield_rate": 0,
        }
    
    return statistics


class ProcessProgressItem(BaseModel):
    """工序执行进展项"""
    process_id: str = Field(..., description="工序ID（工序编码）")
    process_name: str = Field(..., description="工序名称")
    current_progress: float = Field(..., description="当前进度（百分比）")
    task_count: int = Field(..., description="生产任务数")
    planned_quantity: float = Field(..., description="计划数")
    completed_quantity: float = Field(..., description="已完成数量")
    qualified_quantity: float = Field(..., description="合格数")
    unqualified_quantity: float = Field(..., description="不合格数")
    status: str = Field(..., description="状态（not_started/in_progress/completed）")


class ProcessProgressResponse(BaseModel):
    """工序执行进展响应"""
    items: List[ProcessProgressItem] = Field(default_factory=list, description="工序执行进展列表")


@router.get("/process-progress", response_model=ProcessProgressResponse, summary="Operation execution progress")
@cache_by_kwargs(namespace="dashboard:process_progress", ttl=30)
async def get_process_progress(
    include_unstarted: bool = Query(False, description="是否包含未开始生产任务"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProcessProgressResponse:
    """
    获取在制工序执行进展
    
    按工序名称分组，统计每个工序的执行情况。
    
    - **include_unstarted**: 是否包含未开始生产任务（默认：False）
    """
    from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
    from apps.kuaizhizao.models.work_order import WorkOrder
    from decimal import Decimal
    from collections import defaultdict
    
    try:
        # 查询在制工序（pending或in_progress状态）
        query = WorkOrderOperation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        
        if include_unstarted:
            # 包含未开始的任务
            query = query.filter(status__in=["pending", "in_progress"])
        else:
            # 只包含进行中的任务
            query = query.filter(status="in_progress")
        
        operations = await query.all()
        
        # 按工序名称分组统计
        process_stats = defaultdict(lambda: {
            "process_id": "",
            "process_name": "",
            "task_count": 0,
            "planned_quantity": Decimal("0"),
            "completed_quantity": Decimal("0"),
            "qualified_quantity": Decimal("0"),
            "unqualified_quantity": Decimal("0"),
            "statuses": set(),
        })
        
        # 获取所有相关的工单ID
        work_order_ids = list(set([op.work_order_id for op in operations]))
        
        # 批量获取工单信息（用于获取计划数量）
        work_orders = {}
        if work_order_ids:
            wo_list = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
            ).all()
            work_orders = {wo.id: wo for wo in wo_list}
        
        # 统计每个工序的数据
        for op in operations:
            process_key = op.operation_name or op.operation_code
            if not process_key:
                continue
            
            stats = process_stats[process_key]
            stats["process_id"] = op.operation_code or str(op.operation_id)
            stats["process_name"] = op.operation_name or op.operation_code
            stats["task_count"] += 1
            
            # 获取工单的计划数量（工单的quantity就是该工序的计划数量）
            work_order = work_orders.get(op.work_order_id)
            if work_order:
                stats["planned_quantity"] += work_order.quantity or Decimal("0")
            
            # 累计完成数量、合格数量、不合格数量
            stats["completed_quantity"] += op.completed_quantity or Decimal("0")
            stats["qualified_quantity"] += op.qualified_quantity or Decimal("0")
            stats["unqualified_quantity"] += op.unqualified_quantity or Decimal("0")
            stats["statuses"].add(op.status)
        
        # 转换为响应格式
        items = []
        for process_name, stats in process_stats.items():
            # 计算当前进度（已完成数量 / 计划数量 * 100）
            planned_qty = float(stats["planned_quantity"])
            completed_qty = float(stats["completed_quantity"])
            current_progress = (completed_qty / planned_qty * 100) if planned_qty > 0 else 0.0
            
            # 确定状态
            statuses = stats["statuses"]
            if "in_progress" in statuses:
                status = "in_progress"
            elif "pending" in statuses:
                status = "not_started"
            else:
                status = "completed"
            
            items.append(ProcessProgressItem(
                process_id=stats["process_id"],
                process_name=stats["process_name"],
                current_progress=round(current_progress, 2),
                task_count=stats["task_count"],
                planned_quantity=round(planned_qty, 2),
                completed_quantity=round(completed_qty, 2),
                qualified_quantity=round(float(stats["qualified_quantity"]), 2),
                unqualified_quantity=round(float(stats["unqualified_quantity"]), 2),
                status=status,
            ))
        
        # 按工序名称排序
        items.sort(key=lambda x: x.process_name)
        
        return ProcessProgressResponse(items=items)
        
    except Exception as e:
        logger.error(f"获取工序执行进展失败: {e}")
        import traceback
        traceback.print_exc()
        return ProcessProgressResponse(items=[])


class ManagementMetricsResponse(BaseModel):
    """管理指标响应"""
    average_production_cycle: float = Field(..., description="平均订单生产周期（天）")
    on_time_delivery_rate: float = Field(..., description="准交率（%）")


class PlanReliabilityMetricsResponse(BaseModel):
    """计划可信度指标响应"""
    total_active_orders: int = Field(0, description="活跃工单数")
    plan_stability_index: float = Field(0, description="计划稳定指数（0-100）")
    schedule_adherence_rate: float = Field(0, description="按计划开工率（%）")
    freeze_violation_count: int = Field(0, description="冻结违规次数")
    rolling_adjustment_count_24h: int = Field(0, description="滚动窗计划调整次数（24h）")
    reschedule_events_24h: int = Field(0, description="手工计划调整次数（24h）")


@router.get("/management-metrics", response_model=ManagementMetricsResponse, summary="Management metrics")
@cache_by_kwargs(namespace="dashboard:management_metrics", ttl=60)
async def get_management_metrics(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ManagementMetricsResponse:
    """
    获取管理指标
    
    包括：
    - 平均订单生产周期（天）：从工单创建到完成的平均天数
    - 准交率（%）：按时交付的订单占比
    """
    from datetime import datetime, timedelta
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.sales_order import SalesOrder
    
    # 解析时间范围
    date_start_dt = None
    date_end_dt = None
    if date_start:
        try:
            date_start_dt = datetime.strptime(date_start, "%Y-%m-%d")
        except ValueError:
            pass
    if date_end:
        try:
            date_end_dt = datetime.strptime(date_end, "%Y-%m-%d")
            date_end_dt = date_end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass
    
    try:
        # 计算平均订单生产周期
        # 查询已完成的工单
        work_order_query = WorkOrder.filter(
            tenant_id=tenant_id,
            status="completed",
            actual_start_date__isnull=False,
            actual_end_date__isnull=False,
        )
        
        if date_start_dt:
            work_order_query = work_order_query.filter(actual_end_date__gte=date_start_dt)
        if date_end_dt:
            work_order_query = work_order_query.filter(actual_end_date__lte=date_end_dt)
        
        completed_work_orders = await work_order_query.all()
        
        total_cycle_days = 0
        valid_orders = 0
        
        for wo in completed_work_orders:
            if wo.actual_start_date and wo.actual_end_date:
                cycle_days = (wo.actual_end_date - wo.actual_start_date).days
                if cycle_days >= 0:  # 确保是有效的时间差
                    total_cycle_days += cycle_days
                    valid_orders += 1
        
        average_production_cycle = (total_cycle_days / valid_orders) if valid_orders > 0 else 0.0
        
        # 计算准交率
        # 查询销售订单（已完成或已交付的订单）
        sales_order_query = SalesOrder.filter(
            tenant_id=tenant_id,
        ).filter(
            status__in=["completed", "delivered", "closed"]
        )
        
        if date_start_dt:
            sales_order_query = sales_order_query.filter(created_at__gte=date_start_dt)
        if date_end_dt:
            sales_order_query = sales_order_query.filter(created_at__lte=date_end_dt)
        
        sales_orders = await sales_order_query.all()
        
        on_time_count = 0
        total_delivered_count = 0
        
        for so in sales_orders:
            # 检查是否有交付日期字段
            if hasattr(so, 'delivery_date') and so.delivery_date:
                planned_delivery = so.delivery_date
                # 实际交付日期：使用updated_at作为交付时间（订单完成/交付时更新时间）
                actual_delivery = so.updated_at
                
                # 将delivery_date转换为date类型（如果是datetime则提取date部分）
                if isinstance(planned_delivery, datetime):
                    planned_delivery_date = planned_delivery.date()
                else:
                    planned_delivery_date = planned_delivery
                
                if actual_delivery:
                    actual_delivery_date = actual_delivery.date() if isinstance(actual_delivery, datetime) else actual_delivery
                    # 按时交付：实际交付日期 <= 计划交付日期
                    if actual_delivery_date <= planned_delivery_date:
                        on_time_count += 1
                    total_delivered_count += 1
        
        on_time_delivery_rate = (on_time_count / total_delivered_count * 100) if total_delivered_count > 0 else 0.0
        
        return ManagementMetricsResponse(
            average_production_cycle=round(average_production_cycle, 2),
            on_time_delivery_rate=round(on_time_delivery_rate, 2),
        )
        
    except Exception as e:
        logger.error(f"获取管理指标失败: {e}")
        import traceback
        traceback.print_exc()
        return ManagementMetricsResponse(
            average_production_cycle=0.0,
            on_time_delivery_rate=0.0,
        )


@router.get("/plan-reliability", response_model=PlanReliabilityMetricsResponse, summary="Plan reliability metrics")
@cache_by_kwargs(namespace="dashboard:plan_reliability", ttl=30)
async def get_plan_reliability_metrics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> PlanReliabilityMetricsResponse:
    """获取计划可信度看板核心指标。"""
    from apps.kuaizhizao.models.work_order import WorkOrder
    from datetime import datetime, timedelta

    now = resolve_business_datetime()
    changed_since = now - timedelta(hours=24)
    freeze_horizon_days = 2

    active_query = WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=["draft", "released", "in_progress"],
        deleted_at__isnull=True,
    )
    total_active_orders = await active_query.count()

    changed_recent_count = await WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=["draft", "released"],
        updated_at__gte=changed_since,
        deleted_at__isnull=True,
    ).count()
    plan_stability_index = max(0.0, 1.0 - (changed_recent_count / max(total_active_orders, 1)))

    adherence_orders = await WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=["in_progress", "completed"],
        planned_start_date__isnull=False,
        actual_start_date__isnull=False,
        deleted_at__isnull=True,
    ).only("planned_start_date", "actual_start_date")
    adherence_total = 0
    adherence_hit = 0
    for wo in adherence_orders:
        adherence_total += 1
        diff_hours = abs((wo.actual_start_date - wo.planned_start_date).total_seconds() / 3600.0)
        if diff_hours <= 24:
            adherence_hit += 1
    schedule_adherence_rate = (adherence_hit / adherence_total * 100) if adherence_total else 0.0

    freeze_violation_count = await WorkOrder.filter(
        tenant_id=tenant_id,
        is_frozen=True,
        frozen_at__isnull=False,
        updated_at__gt=changed_since,
        deleted_at__isnull=True,
    ).count()

    rolling_adjustment_count_24h = await WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=["draft", "released"],
        updated_at__gte=changed_since,
        planned_start_date__gt=now + timedelta(days=freeze_horizon_days),
        deleted_at__isnull=True,
    ).count()

    return PlanReliabilityMetricsResponse(
        total_active_orders=total_active_orders,
        plan_stability_index=round(plan_stability_index * 100, 2),
        schedule_adherence_rate=round(schedule_adherence_rate, 2),
        freeze_violation_count=int(freeze_violation_count),
        rolling_adjustment_count_24h=int(rolling_adjustment_count_24h),
        reschedule_events_24h=int(changed_recent_count),
    )


class ProductionBroadcastItem(BaseModel):
    """生产实时播报项"""
    id: str = Field(..., description="播报ID")
    operator_name: str = Field(..., description="操作员姓名")
    operator_avatar: Optional[str] = Field(None, description="操作员头像文件UUID（关联文件管理）")
    process_name: str = Field(..., description="工序名称")
    date: str = Field(..., description="日期")
    work_order_no: str = Field(..., description="工单号")
    product_code: str = Field(..., description="产品编码")
    product_name: str = Field(..., description="产品名称")
    qualified_quantity: float = Field(..., description="合格数")
    unqualified_quantity: float = Field(..., description="不合格数")
    created_at: str = Field(..., description="创建时间")


class ProductionBroadcastResponse(BaseModel):
    """生产实时播报响应"""
    items: List[ProductionBroadcastItem] = Field(default_factory=list, description="播报列表")


@router.get("/production-broadcast", response_model=ProductionBroadcastResponse, summary="Production live broadcast")
@cache_by_kwargs(namespace="dashboard:broadcast", ttl=30)
async def get_production_broadcast(
    limit: int = Query(10, ge=1, le=50, description="返回数量限制"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionBroadcastResponse:
    """
    获取生产实时播报
    
    返回最近的报工记录，用于实时展示生产活动。
    
    - **limit**: 返回数量限制（默认10条，最多50条）
    """
    from apps.kuaizhizao.models.reporting_record import ReportingRecord
    from apps.kuaizhizao.models.work_order import WorkOrder
    from datetime import datetime, timedelta
    
    try:
        # 查询最近的报工记录（最近7天）
        date_threshold = resolve_business_datetime() - timedelta(days=7)
        
        reporting_records = await ReportingRecord.filter(
            tenant_id=tenant_id,
            status__in=["approved", "pending"],  # 显示已审核和待审核的报工记录
        ).order_by("-reported_at").limit(limit).all()
        
        # 获取相关的工单信息
        work_order_ids = list(set([r.work_order_id for r in reporting_records if r.work_order_id]))
        work_orders = {}
        if work_order_ids:
            wo_list = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
            ).all()
            work_orders = {wo.id: wo for wo in wo_list}

        worker_ids = list({r.worker_id for r in reporting_records if getattr(r, "worker_id", None)})
        avatar_by_worker_id: dict[int, Optional[str]] = {}
        if worker_ids:
            user_rows = await User.filter(id__in=worker_ids).only("id", "avatar").all()
            avatar_by_worker_id = {u.id: u.avatar for u in user_rows}

        items = []
        for record in reporting_records:
            work_order = work_orders.get(record.work_order_id) if record.work_order_id else None
            
            items.append(ProductionBroadcastItem(
                id=str(record.id),
                operator_name=record.worker_name or "未知操作员",
                operator_avatar=avatar_by_worker_id.get(record.worker_id),
                process_name=record.operation_name or "未知工序",
                date=record.reported_at.strftime("%Y-%m-%d") if record.reported_at else resolve_business_datetime().strftime("%Y-%m-%d"),
                work_order_no=record.work_order_code or (work_order.code if work_order else "未知工单"),
                product_code=work_order.product_code if work_order else "未知产品",
                product_name=work_order.product_name if work_order else "未知产品",
                qualified_quantity=float(record.qualified_quantity or 0),
                unqualified_quantity=float(record.unqualified_quantity or 0),
                created_at=to_api_isoformat(record.reported_at) if record.reported_at else to_api_isoformat(resolve_business_datetime()),
            ))
        
        return ProductionBroadcastResponse(items=items)
        
    except Exception as e:
        logger.error(f"获取生产实时播报失败: {e}")
        import traceback
        traceback.print_exc()
        return ProductionBroadcastResponse(items=[])


@router.get("/menu-badge-counts", summary="Menu badge open-document counts")
@cache_by_kwargs(namespace="dashboard:badges", ttl=45)
async def get_menu_badge_counts(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    返回各业务单据的「未完成」数量，key 与前端菜单 path 映射一致。
    用于左侧菜单业务类单据显示数量小徽标。
    """
    return await fetch_menu_badge_counts(tenant_id)


# ==========================================
# 看板 KPI 可配置项（租户级 TenantConfig）
# ==========================================
# 销售目标可从 TenantConfig 配置；采购到货率与设备 OEE 由业务数据计算。
CONFIG_KEY_SALES_MONTHLY_TARGET = "dashboard.kpi.sales_monthly_target"

DEFAULT_SALES_MONTHLY_TARGET = 0.0


async def _read_dashboard_kpi(
    tenant_id: int,
    config_key: str,
    default: float,
    inner_key: str = "value",
) -> float:
    """
    读取看板 KPI 配置值（tenant 级），不存在则返回 default。

    config_value 约定为 JSON 对象，按约定的 inner_key（默认 "value"）取值；
    也兼容 {amount: ...} / {percent: ...} 常见命名。
    """
    from infra.services.tenant_service import TenantService

    try:
        config = await TenantService().get_tenant_config(tenant_id, config_key)
        if not config or not isinstance(config.config_value, dict):
            return default
        raw = (
            config.config_value.get(inner_key)
            or config.config_value.get("value")
            or config.config_value.get("amount")
            or config.config_value.get("percent")
        )
        if raw is None:
            return default
        return float(raw)
    except Exception as e:
        logger.warning(f"read dashboard kpi {config_key} failed: {e}")
        return default


# ---------------------------------------------------------------------------
# 单据状态白名单
# 历史数据状态值混用了"小写英文 / 中文 / DemandStatus·DocumentStatus 的大写枚举"
# 三种写法，这里集中维护，避免看板查询遗漏真实数据。
# ---------------------------------------------------------------------------

# 已审核/已确认/已完成 等"业务上视为有效销售订单"的状态
SALES_ORDER_ACTIVE_STATUS = [
    # 小写英文（历史）
    "approved", "confirmed", "completed", "delivered", "closed",
    "released", "in_progress",
    # 中文
    "已审核", "已确认", "已完成", "已发货", "已关闭", "执行中", "进行中", "已下达",
    # 大写枚举（DemandStatus / DocumentStatus）
    "APPROVED", "AUDITED", "CONFIRMED", "RELEASED", "IN_PROGRESS", "COMPLETED",
]

# 待发货订单（已审核，还未发货 / 未完成）
SALES_ORDER_PENDING_SHIP_STATUS = [
    "approved", "confirmed",
    "已审核", "已确认",
    "APPROVED", "AUDITED", "CONFIRMED", "RELEASED", "IN_PROGRESS",
]

# 已审核/已确认/已完成/已收货 等"业务上视为有效采购订单"的状态
PURCHASE_ORDER_ACTIVE_STATUS = [
    "approved", "confirmed", "partial_received", "received", "completed",
    "released", "in_progress",
    "已审核", "已确认", "部分收货", "已收货", "已完成", "执行中", "进行中", "已下达",
    "APPROVED", "AUDITED", "CONFIRMED", "RELEASED", "IN_PROGRESS", "COMPLETED",
]

# 待收货采购订单
PURCHASE_ORDER_PENDING_RECEIPT_STATUS = [
    "approved", "partial_received",
    "已审核", "部分收货",
    "APPROVED", "AUDITED", "CONFIRMED", "RELEASED", "IN_PROGRESS",
]

# 待处理申购（草稿/待审核）
PURCHASE_REQUISITION_PENDING_STATUS = [
    "草稿", "待审核",
    "draft", "pending", "pending_review",
    "DRAFT", "PENDING_REVIEW",
]

# 有效申购单（未被驳回/取消的）
PURCHASE_REQUISITION_ACTIVE_STATUS = [
    "草稿", "待审核", "已通过", "部分转单",
    "draft", "pending", "approved", "partial_converted",
    "DRAFT", "PENDING_REVIEW", "AUDITED", "APPROVED", "CONFIRMED",
]

PURCHASE_ORDER_CANCELLED_STATUS = [
    "cancelled", "CANCELLED", "已取消",
]

PURCHASE_ORDER_RECEIVED_STATUS = [
    "received", "partial_received", "completed",
    "已收货", "部分收货", "已完成",
    "RECEIVED", "COMPLETED",
]

# 执行中工单
WORK_ORDER_IN_PROGRESS_STATUS = [
    "in_progress", "进行中", "released", "已下达", "执行中",
    "IN_PROGRESS", "RELEASED",
]


async def _count_sales_orders_with_open_shipment(
    tenant_id: int,
    *,
    overdue_before: Optional[date] = None,
) -> int:
    """待发货订单：审核态订单中仍有明细剩余可发数量（勿仅按头状态，发完后头常仍为已审核）。"""
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

    order_q = SalesOrder.filter(
        tenant_id=tenant_id,
        status__in=SALES_ORDER_PENDING_SHIP_STATUS,
        deleted_at__isnull=True,
    )
    if overdue_before is not None:
        order_q = order_q.filter(delivery_date__lt=overdue_before)
    order_ids = await order_q.values_list("id", flat=True)
    if not order_ids:
        return 0
    open_order_ids = await SalesOrderItem.filter(
        tenant_id=tenant_id,
        sales_order_id__in=list(order_ids),
        remaining_quantity__gt=0,
        deleted_at__isnull=True,
    ).values_list("sales_order_id", flat=True)
    return len(set(open_order_ids))


async def _count_purchase_orders_with_open_receipt(
    tenant_id: int,
    *,
    overdue_before: Optional[date] = None,
) -> int:
    """待收货订单：审核态采购订单中仍有明细未到货数量。"""
    from apps.kuaizhizao.models.purchase_order import (
        PurchaseOrder,
        PurchaseOrderItem,
        effective_po_item_outstanding,
    )

    order_q = PurchaseOrder.filter(
        tenant_id=tenant_id,
        status__in=PURCHASE_ORDER_PENDING_RECEIPT_STATUS,
        deleted_at__isnull=True,
    )
    if overdue_before is not None:
        order_q = order_q.filter(delivery_date__lt=overdue_before)
    order_ids = list(await order_q.values_list("id", flat=True))
    if not order_ids:
        return 0
    items = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        order_id__in=order_ids,
        deleted_at__isnull=True,
    ).all()
    open_ids = {
        int(item.order_id)
        for item in items
        if effective_po_item_outstanding(item) > 0
    }
    return len(open_ids)


async def _compute_purchase_arrival_rate(
    tenant_id: int,
    range_start_date,
    range_end_date,
) -> float:
    """区间内采购订单行：已到货数量 / 订购数量（无订单或无数量时返回 0）。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem

    order_ids = await PurchaseOrder.filter(
        tenant_id=tenant_id,
        order_date__gte=range_start_date,
        order_date__lte=range_end_date,
    ).exclude(status__in=PURCHASE_ORDER_CANCELLED_STATUS).values_list("id", flat=True)
    order_id_list = list(order_ids)
    if not order_id_list:
        return 0.0

    rows = await PurchaseOrderItem.filter(
        tenant_id=tenant_id,
        order_id__in=order_id_list,
    ).values_list("ordered_quantity", "received_quantity")

    total_qty = sum(float(q or 0) for q, _ in rows)
    received_qty = sum(float(r or 0) for _, r in rows)
    if total_qty > 0:
        return round(min(100.0, received_qty / total_qty * 100), 2)

    received_orders = await PurchaseOrder.filter(
        id__in=order_id_list,
        status__in=PURCHASE_ORDER_RECEIVED_STATUS,
    ).count()
    return round(received_orders / len(order_id_list) * 100, 2) if order_id_list else 0.0


@router.get("/sales-summary", summary="Sales center summary")
@cache_by_kwargs(namespace="dashboard:sales_summary", ttl=45)
async def get_sales_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD；缺省为当月"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD；缺省为当月末"),
):
    """销售中心汇总数据：待处理报价、待发货订单、所选区间销售达成率。

    说明：
    - "待处理报价 / 待发货订单 / 逾期发货" 为当前状态快照，不随区间变化。
    - "本月销售额 / 上期销售额 / 达成率 / 新增报价" 按 date_start~date_end 过滤，默认当月。
    """
    from apps.kuaizhizao.models.quotation import Quotation
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from tortoise.functions import Sum
    from decimal import Decimal
    import asyncio

    now = resolve_business_datetime()
    range_start_dt, range_end_dt, range_start_date, range_end_date = _resolve_month_range(date_start, date_end)
    month_start = range_start_dt

    # 1. 待处理报价 (草稿/待审核)
    q1 = Quotation.filter(tenant_id=tenant_id, status__in=["草稿", "待审核"], deleted_at__isnull=True).count()
    # 2/2b. 待发货 / 逾期发货：按明细 remaining_quantity，非仅头状态
    now_date = now.date()

    q3 = SalesOrder.filter(
        tenant_id=tenant_id,
        status__in=SALES_ORDER_ACTIVE_STATUS,
        order_date__gte=range_start_date,
        order_date__lte=range_end_date,
        deleted_at__isnull=True
    ).values_list("total_amount", flat=True)

    # 4. 上期销售完成情况 (用于对比)：长度与当前区间相同，紧邻前一段
    span_days = (range_end_date - range_start_date).days + 1
    prev_end_date = range_start_date - timedelta(days=1)
    prev_start_date = prev_end_date - timedelta(days=span_days - 1)
    q4 = SalesOrder.filter(
        tenant_id=tenant_id,
        status__in=SALES_ORDER_ACTIVE_STATUS,
        order_date__gte=prev_start_date,
        order_date__lte=prev_end_date,
        deleted_at__isnull=True
    ).values_list("total_amount", flat=True)

    # 5. 区间内新增报价
    q5 = Quotation.filter(
        tenant_id=tenant_id,
        created_at__gte=range_start_dt,
        created_at__lte=range_end_dt,
        deleted_at__isnull=True
    ).count()

    (
        pending_quotations,
        pending_shipments,
        overdue_shipments,
        sales_amounts,
        last_month_amounts,
        new_quotations,
    ) = await asyncio.gather(
        q1,
        _count_sales_orders_with_open_shipment(tenant_id),
        _count_sales_orders_with_open_shipment(tenant_id, overdue_before=now_date),
        q3,
        q4,
        q5,
    )
    
    total_amount = sum(float(x or 0) for x in sales_amounts)
    last_month_amount = sum(float(x or 0) for x in last_month_amounts)
    target_amount = await _read_dashboard_kpi(
        tenant_id,
        CONFIG_KEY_SALES_MONTHLY_TARGET,
        DEFAULT_SALES_MONTHLY_TARGET,
        inner_key="amount",
    )
    achievement_rate = (total_amount / target_amount * 100) if target_amount > 0 else 0.0

    return {
        "pending_quotations": pending_quotations,
        "new_quotations_this_month": new_quotations,
        "pending_shipments": pending_shipments,
        "overdue_shipments": overdue_shipments,
        "achievement_rate": round(achievement_rate, 2),
        "total_amount": round(total_amount, 2),
        "total_amount_last_month": round(last_month_amount, 2)
    }


@router.get("/purchase-summary", summary="Purchase center summary")
@cache_by_kwargs(namespace="dashboard:purchase_summary", ttl=45)
async def get_purchase_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD；缺省为当月"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD；缺省为当月末"),
):
    """采购中心汇总数据：待处理申购、待收货订单、采购到货率。

    - 状态计数（待处理申购/紧急/待收货/逾期）为实时快照。
    - "新增申购数" 按 date_start~date_end 过滤，默认当月。
    """
    from apps.kuaizhizao.models.purchase_requisition import PurchaseRequisition
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem
    from tortoise.functions import Sum
    import asyncio

    now = resolve_business_datetime()
    now_date = now.date()
    range_start_dt, range_end_dt, range_start_date, range_end_date = _resolve_month_range(date_start, date_end)

    # 1. 待处理申购（草稿/待审核）
    q1 = PurchaseRequisition.filter(
        tenant_id=tenant_id,
        status__in=PURCHASE_REQUISITION_PENDING_STATUS,
        deleted_at__isnull=True,
    ).count()
    
    # 2/2b. 待收货 / 逾期未到货：按明细未到货数量，非仅头状态
    # 3. 区间内新增申购
    q3 = PurchaseRequisition.filter(
        tenant_id=tenant_id,
        created_at__gte=range_start_dt,
        created_at__lte=range_end_dt,
        deleted_at__isnull=True
    ).count()

    pending_requisitions, pending_receipts, overdue_receipts, new_requisitions = await asyncio.gather(
        q1,
        _count_purchase_orders_with_open_receipt(tenant_id),
        _count_purchase_orders_with_open_receipt(tenant_id, overdue_before=now_date),
        q3,
    )

    arrival_rate = await _compute_purchase_arrival_rate(
        tenant_id, range_start_date, range_end_date
    )

    return {
        "pending_requisitions": pending_requisitions,
        "new_requisitions_this_month": new_requisitions,
        "pending_receipts": pending_receipts,
        "overdue_receipts": overdue_receipts,
        "arrival_rate": round(arrival_rate, 2),
    }


@router.get("/manufacturing-summary", summary="Manufacturing center summary")
@cache_by_kwargs(namespace="dashboard:manufacturing_summary", ttl=45)
async def get_manufacturing_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD；缺省为今日"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD；缺省为今日"),
):
    """制造中心汇总数据。

    - 状态计数（待排产/进行中/返工/待审核报工）为实时快照。
    - today_output：区间内成品入库单（已入库）合计数量（按实际入库时间），非工序报工合格数。
    - 合格率：区间内报工记录的合格数 /（合格+不合格），按 date_start~date_end 过滤；缺省为今日。
    """
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.reporting_record import ReportingRecord
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    import asyncio

    now = resolve_business_datetime()
    if date_start:
        range_start_dt = datetime.strptime(date_start, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        range_start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if date_end:
        range_end_dt = datetime.strptime(date_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        range_end_dt = now.replace(hour=23, minute=59, second=59, microsecond=0)

    # 1. 待排产工单 (草稿状态)
    q1 = WorkOrder.filter(tenant_id=tenant_id, status__in=["draft", "草稿", "DRAFT"], deleted_at__isnull=True).count()
    # 2. 进行中工单
    q2 = WorkOrder.filter(tenant_id=tenant_id, status__in=WORK_ORDER_IN_PROGRESS_STATUS, deleted_at__isnull=True).count()
    
    # 增加：返工单 (进行中)
    q2_rework = ReworkOrder.filter(
        tenant_id=tenant_id, 
        status__in=["released", "in_progress", "已下达", "进行中"], 
        deleted_at__isnull=True
    ).count()

    # 3. 区间内生产产出
    q3 = ReportingRecord.filter(
        tenant_id=tenant_id,
        reported_at__gte=range_start_dt,
        reported_at__lte=range_end_dt,
    ).values_list("qualified_quantity", "unqualified_quantity", "reported_quantity", "rework_order_id")
    
    # 增加：待审核报工
    q4 = ReportingRecord.filter(tenant_id=tenant_id, status="pending").count()

    # 区间内成品入库数量（已入库，按 receipt_time）
    q_fg = FinishedGoodsReceipt.filter(
        tenant_id=tenant_id,
        status="已入库",
        receipt_time__gte=range_start_dt,
        receipt_time__lte=range_end_dt,
        deleted_at__isnull=True,
    ).values_list("total_quantity",)

    pending_scheduling, in_progress_count, rework_count, prod_records, pending_reporting, fg_rows = await asyncio.gather(
        q1, q2, q2_rework, q3, q4, q_fg
    )

    finished_goods_inbound_qty = sum(float(r[0] or 0) for r in fg_rows)
    total_qualified = sum(float(r[0] or 0) for r in prod_records)
    total_unqualified = sum(float(r[1] or 0) for r in prod_records)
    total_reported = total_qualified + total_unqualified
    qualified_rate = (total_qualified / total_reported * 100) if total_reported > 0 else 0.0

    first_pass_qualified = 0.0
    first_pass_reported = 0.0
    for row in prod_records:
        if row[3] is not None:
            continue
        qualified_qty = float(row[0] or 0)
        reported_qty = float(row[2] or 0)
        if reported_qty <= 0:
            reported_qty = qualified_qty + float(row[1] or 0)
        first_pass_qualified += qualified_qty
        first_pass_reported += reported_qty
    first_pass_yield_rate = (
        round(first_pass_qualified / first_pass_reported * 100, 2) if first_pass_reported > 0 else 0.0
    )

    return {
        "pending_scheduling": pending_scheduling,
        "in_progress_count": in_progress_count,
        "rework_count": rework_count,
        "today_output": finished_goods_inbound_qty,
        "qualified_rate": round(qualified_rate, 2),
        "first_pass_yield_rate": first_pass_yield_rate,
        "pending_reporting": pending_reporting
    }


@router.get("/equipment-summary", summary="Equipment dashboard summary")
@cache_by_kwargs(namespace="dashboard:equipment_summary", ttl=60)
async def get_equipment_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD；缺省为今日"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD；缺省为今日"),
):
    """设备看板汇总：报修中设备、待校验、综合效率（由台账状态推算）。"""
    from apps.kuaizhizao.models.equipment import Equipment
    from apps.kuaizhizao.models.maintenance_plan import MaintenanceExecution
    import asyncio

    now = resolve_business_datetime()
    now_date = now.date()
    if date_start:
        range_start_dt = datetime.strptime(date_start, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        range_start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if date_end:
        range_end_dt = datetime.strptime(date_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        range_end_dt = now.replace(hour=23, minute=59, second=59, microsecond=0)

    equipment_base = Equipment.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_active=True).exclude(
        status__in=["报废", "停用", "scrapped", "disabled"]
    )
    faulty_statuses = ["维修中", "故障", "maintenance", "fault"]

    q_total = equipment_base.count()
    q_faulty = equipment_base.filter(status__in=faulty_statuses).count()
    q_calibration = equipment_base.filter(
        needs_calibration=True,
        next_calibration_date__isnull=False,
        next_calibration_date__lte=now_date,
    ).count()
    q_maintenance = MaintenanceExecution.filter(
        tenant_id=tenant_id,
        execution_date__gte=range_start_dt,
        execution_date__lte=range_end_dt,
        deleted_at__isnull=True,
    ).count()

    total_count, faulty_count, calibration_needed, maintenance_tasks = await asyncio.gather(
        q_total, q_faulty, q_calibration, q_maintenance
    )

    total_count = int(total_count or 0)
    faulty_count = int(faulty_count or 0)
    calibration_needed = int(calibration_needed or 0)

    if total_count > 0:
        availability_rate = round((total_count - faulty_count) / total_count * 100, 2)
        failure_rate = round(faulty_count / total_count * 100, 2)
    else:
        availability_rate = 0.0
        failure_rate = 0.0

    # 无独立 OEE 采集时，以可用率作为看板展示值（与 availability 一致，避免假数据）
    average_oee = availability_rate

    return {
        "total_count": total_count,
        "faulty_count": faulty_count,
        "calibration_needed": calibration_needed,
        "average_oee": average_oee,
        "availability_rate": availability_rate,
        "failure_rate": failure_rate,
        "repairing_count": faulty_count,
        "today_maintenance_tasks": int(maintenance_tasks or 0),
        "oee": average_oee,
    }


# ==========================================
# 运营看板 - 扩展 API（TOP10 / 执行中工单 / 仓储）
# ==========================================

def _resolve_month_range(
    date_start: Optional[str],
    date_end: Optional[str],
):
    """
    解析查询区间；缺省为"当月 1 号 00:00:00 ~ 当月最后一天 23:59:59"。
    返回 (start_dt, end_dt, start_date, end_date)。
    """
    now = resolve_business_datetime()
    if date_start:
        start_dt = datetime.strptime(date_start, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if date_end:
        end_dt = datetime.strptime(date_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        # 当月末
        if now.month == 12:
            next_month = now.replace(year=now.year + 1, month=1, day=1)
        else:
            next_month = now.replace(month=now.month + 1, day=1)
        end_dt = (next_month - timedelta(days=1)).replace(hour=23, minute=59, second=59, microsecond=0)

    return start_dt, end_dt, start_dt.date(), end_dt.date()


@router.get("/sales-top10", summary="Top 10 sold products")
@cache_by_kwargs(namespace="dashboard:sales_top10", ttl=60)
async def get_sales_top10(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认本月"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD，默认本月"),
    limit: int = Query(10, ge=1, le=50, description="条数"),
):
    """按销售明细（已审核/已确认/已完成订单）数量聚合的产品 TOP 排行（按销售数量倒序）。"""
    from apps.kuaizhizao.models.sales_order import SalesOrder
    from apps.kuaizhizao.models.sales_order_item import SalesOrderItem

    start_dt, end_dt, start_date, end_date = _resolve_month_range(date_start, date_end)

    # 拉取区间内的有效销售订单 ID
    order_ids = await SalesOrder.filter(
        tenant_id=tenant_id,
        status__in=SALES_ORDER_ACTIVE_STATUS,
        order_date__gte=start_date,
        order_date__lte=end_date,
        deleted_at__isnull=True,
    ).values_list("id", flat=True)

    if not order_ids:
        return {"items": []}

    rows = await SalesOrderItem.filter(sales_order_id__in=list(order_ids)).values(
        "material_id", "material_code", "material_name", "order_quantity", "total_amount"
    )

    agg: dict = {}
    for r in rows:
        mid = r.get("material_id") or 0
        key = mid or (r.get("material_code") or r.get("material_name") or "unknown")
        bucket = agg.setdefault(key, {
            "material_id": mid,
            "material_code": r.get("material_code") or "",
            "material_name": r.get("material_name") or "",
            "quantity": 0.0,
            "amount": 0.0,
        })
        bucket["quantity"] += float(r.get("order_quantity") or 0)
        bucket["amount"] += float(r.get("total_amount") or 0)

    items = sorted(agg.values(), key=lambda x: x["quantity"], reverse=True)[:limit]
    for it in items:
        it["quantity"] = round(it["quantity"], 2)
        it["amount"] = round(it["amount"], 2)

    return {"items": items}


@router.get("/purchase-top10", summary="Top 10 purchased materials")
@cache_by_kwargs(namespace="dashboard:purchase_top10", ttl=60)
async def get_purchase_top10(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认本月"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD，默认本月"),
    limit: int = Query(10, ge=1, le=50, description="条数"),
):
    """按采购订单明细（已审核/部分收货/已完成）数量与金额聚合的原料 TOP 排行。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder, PurchaseOrderItem

    start_dt, end_dt, start_date, end_date = _resolve_month_range(date_start, date_end)

    order_ids = await PurchaseOrder.filter(
        tenant_id=tenant_id,
        status__in=PURCHASE_ORDER_ACTIVE_STATUS,
        order_date__gte=start_date,
        order_date__lte=end_date,
    ).values_list("id", flat=True)

    if not order_ids:
        return {"items": []}

    rows = await PurchaseOrderItem.filter(order_id__in=list(order_ids)).values(
        "material_id", "material_code", "material_name", "ordered_quantity", "total_price"
    )

    agg: dict = {}
    for r in rows:
        mid = r.get("material_id") or 0
        key = mid or (r.get("material_code") or r.get("material_name") or "unknown")
        bucket = agg.setdefault(key, {
            "material_id": mid,
            "material_code": r.get("material_code") or "",
            "material_name": r.get("material_name") or "",
            "quantity": 0.0,
            "amount": 0.0,
        })
        bucket["quantity"] += float(r.get("ordered_quantity") or 0)
        bucket["amount"] += float(r.get("total_price") or 0)

    items = sorted(agg.values(), key=lambda x: x["quantity"], reverse=True)[:limit]
    for it in items:
        it["quantity"] = round(it["quantity"], 2)
        it["amount"] = round(it["amount"], 2)

    return {"items": items}


@router.get("/work-orders-active", summary="Active work orders and operation progress")
@cache_by_kwargs(namespace="dashboard:work_orders_active", ttl=20)
async def get_work_orders_active(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    limit: int = Query(50, ge=1, le=200, description="工单条数上限"),
):
    """
    执行中工单 + 每道工序的状态/进度。

    工序 status 映射：completed → done，in_progress → active，其它 → pending。
    工序进度 progress（仅 active 用）：min(100, qualified_quantity / plan * 100)。
    """
    from apps.kuaizhizao.models.work_order import WorkOrder
    from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation

    work_orders = await WorkOrder.filter(
        tenant_id=tenant_id,
        status__in=WORK_ORDER_IN_PROGRESS_STATUS,
        deleted_at__isnull=True,
    ).order_by("-actual_start_date", "-created_at").limit(limit).values(
        "id", "code", "product_code", "product_name", "quantity",
        "qualified_quantity", "completed_quantity",
    )

    if not work_orders:
        return {"items": []}

    wo_ids = [w["id"] for w in work_orders]
    ops = await WorkOrderOperation.filter(
        work_order_id__in=wo_ids,
        deleted_at__isnull=True,
    ).order_by("sequence").values(
        "work_order_id", "operation_name", "sequence", "status",
        "qualified_quantity",
    )

    ops_by_wo: dict = {}
    for op in ops:
        ops_by_wo.setdefault(op["work_order_id"], []).append(op)

    from apps.kuaizhizao.services.work_order_operation_steps import build_work_order_operation_steps

    items = []
    for w in work_orders:
        plan = float(w.get("quantity") or 0)
        raw_steps = ops_by_wo.get(w["id"], [])
        steps = build_work_order_operation_steps(raw_steps, plan)

        items.append({
            "work_order_id": w.get("id"),
            "id": w.get("code") or str(w.get("id")),
            "product_code": w.get("product_code") or "",
            "product": w.get("product_name") or "",
            "planned": float(w.get("quantity") or 0),
            "qualified": float(w.get("qualified_quantity") or 0),
            "completed": float(w.get("completed_quantity") or 0),
            "steps": steps,
        })

    return {"items": items}


@router.get("/warehouse-summary", summary="Warehouse center KPI summary")
@cache_by_kwargs(namespace="dashboard:warehouse_summary", ttl=60)
async def get_warehouse_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    仓储四指标：
    - total_stock      总库存数量（MaterialBatch 在库 + LineSideInventory 可用）
    - in_stock_batches 在库批次数（MaterialBatch status="in_stock"）
    - pending_inbound  待入库单数（与入库 Hub 可确认态一致，含草稿下推单）
    - pending_outbound 待出库单数（SalesDelivery + OtherOutbound status="待出库"）
    """
    from apps.master_data.models.material_batch import MaterialBatch
    from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.other_inbound import OtherInbound
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    from apps.kuaizhizao.services.document_action_policy.warehouse_inbound_hub import (
        _INBOUND_PENDING_STATUSES,
    )
    import asyncio

    _pending_in = tuple(_INBOUND_PENDING_STATUSES)

    batch_qty_q = MaterialBatch.filter(
        tenant_id=tenant_id, status="in_stock"
    ).values_list("quantity", flat=True)
    line_qty_q = LineSideInventory.filter(
        tenant_id=tenant_id, status__in=["available", "reserved"]
    ).values_list("quantity", flat=True)
    batch_count_q = MaterialBatch.filter(tenant_id=tenant_id, status="in_stock").count()

    pr_q = PurchaseReceipt.filter(
        tenant_id=tenant_id, status__in=_pending_in, deleted_at__isnull=True
    ).count()
    fg_q = FinishedGoodsReceipt.filter(
        tenant_id=tenant_id, status__in=_pending_in, deleted_at__isnull=True
    ).count()
    oi_q = OtherInbound.filter(
        tenant_id=tenant_id, status__in=_pending_in, deleted_at__isnull=True
    ).count()

    sd_q = SalesDelivery.filter(tenant_id=tenant_id, status="待出库", deleted_at__isnull=True).count()
    oo_q = OtherOutbound.filter(tenant_id=tenant_id, status="待出库", deleted_at__isnull=True).count()

    batch_qty, line_qty, batch_count, pr, fg, oi, sd, oo = await asyncio.gather(
        batch_qty_q, line_qty_q, batch_count_q, pr_q, fg_q, oi_q, sd_q, oo_q
    )

    total_stock = sum(float(x or 0) for x in batch_qty) + sum(float(x or 0) for x in line_qty)

    return {
        "total_stock": round(total_stock, 2),
        "in_stock_batches": int(batch_count or 0),
        "pending_inbound": int((pr or 0) + (fg or 0) + (oi or 0)),
        "pending_outbound": int((sd or 0) + (oo or 0)),
    }


@router.get("/warehouse-trend", summary="Warehouse inbound/outbound daily trend")
@cache_by_kwargs(namespace="dashboard:warehouse_trend", ttl=60)
async def get_warehouse_trend(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD，默认本月 1 号"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD，默认今天"),
):
    """
    仓储月度入库/出库按日聚合。
    入库源：PurchaseReceipt + FinishedGoodsReceipt + OtherInbound (receipt_time)
    出库源：SalesDelivery + OtherOutbound (delivery_time)
    返回按日排序：items[{date: 'MM-DD', in: number, out: number}]。
    """
    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.other_inbound import OtherInbound
    from apps.kuaizhizao.models.sales_delivery import SalesDelivery
    from apps.kuaizhizao.models.other_outbound import OtherOutbound
    import asyncio

    now = resolve_business_datetime()
    start_dt = (
        datetime.strptime(date_start, "%Y-%m-%d")
        if date_start else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    end_dt_raw = (
        datetime.strptime(date_end, "%Y-%m-%d")
        if date_end else now
    )
    end_dt = end_dt_raw.replace(hour=23, minute=59, second=59, microsecond=0)

    in_queries = [
        PurchaseReceipt.filter(
            tenant_id=tenant_id,
            receipt_time__gte=start_dt, receipt_time__lte=end_dt,
            deleted_at__isnull=True,
        ).values_list("receipt_time", "total_quantity"),
        FinishedGoodsReceipt.filter(
            tenant_id=tenant_id,
            receipt_time__gte=start_dt, receipt_time__lte=end_dt,
            deleted_at__isnull=True,
        ).values_list("receipt_time", "total_quantity"),
        OtherInbound.filter(
            tenant_id=tenant_id,
            receipt_time__gte=start_dt, receipt_time__lte=end_dt,
            deleted_at__isnull=True,
        ).values_list("receipt_time", "total_quantity"),
    ]
    out_queries = [
        SalesDelivery.filter(
            tenant_id=tenant_id,
            delivery_time__gte=start_dt, delivery_time__lte=end_dt,
            deleted_at__isnull=True,
        ).values_list("delivery_time", "total_quantity"),
        OtherOutbound.filter(
            tenant_id=tenant_id,
            delivery_time__gte=start_dt, delivery_time__lte=end_dt,
            deleted_at__isnull=True,
        ).values_list("delivery_time", "total_quantity"),
    ]

    in_results, out_results = await asyncio.gather(
        asyncio.gather(*in_queries),
        asyncio.gather(*out_queries),
    )

    bucket: dict = {}

    def _add(dt, qty, key: str):
        if not dt:
            return
        d = dt.strftime("%m-%d")
        b = bucket.setdefault(d, {"date": d, "in": 0.0, "out": 0.0, "_sort": dt.strftime("%Y-%m-%d")})
        b[key] += float(qty or 0)

    for rs in in_results:
        for dt, qty in rs:
            _add(dt, qty, "in")
    for rs in out_results:
        for dt, qty in rs:
            _add(dt, qty, "out")

    items = [
        {"date": b["date"], "in": round(b["in"], 2), "out": round(b["out"], 2)}
        for b in sorted(bucket.values(), key=lambda x: x["_sort"])
    ]

    return {"items": items}


@router.get("/purchase-trend", summary="Purchase order daily trend")
@cache_by_kwargs(namespace="dashboard:purchase_trend", ttl=60)
async def get_purchase_trend(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """采购订单按日金额/数量趋势（本月默认）。"""
    from apps.kuaizhizao.models.purchase_order import PurchaseOrder

    start_dt, end_dt, start_date, end_date = _resolve_month_range(date_start, date_end)
    rows = await PurchaseOrder.filter(
        tenant_id=tenant_id,
        status__in=PURCHASE_ORDER_ACTIVE_STATUS,
        order_date__gte=start_date,
        order_date__lte=end_date,
    ).values_list("order_date", "total_amount", "total_quantity")

    bucket: dict = {}
    for od, amt, qty in rows:
        if not od:
            continue
        d = od.strftime("%m-%d") if hasattr(od, "strftime") else str(od)[5:10]
        sort_key = od.strftime("%Y-%m-%d") if hasattr(od, "strftime") else str(od)
        b = bucket.setdefault(sort_key, {"date": d, "amount": 0.0, "quantity": 0.0, "_sort": sort_key})
        b["amount"] += float(amt or 0)
        b["quantity"] += float(qty or 0)

    items = [
        {"date": b["date"], "amount": round(b["amount"], 2), "quantity": round(b["quantity"], 2)}
        for b in sorted(bucket.values(), key=lambda x: x["_sort"])
    ]
    return {"items": items}


@router.get("/manufacturing-trend", summary="Manufacturing output daily trend")
@cache_by_kwargs(namespace="dashboard:manufacturing_trend", ttl=60)
async def get_manufacturing_trend(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """制造产出按日趋势：成品入库数量 + 报工合格数。"""
    from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
    from apps.kuaizhizao.models.reporting_record import ReportingRecord

    now = resolve_business_datetime()
    start_dt = (
        datetime.strptime(date_start, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
        if date_start else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    end_dt = (
        datetime.strptime(date_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=0)
        if date_end else now.replace(hour=23, minute=59, second=59, microsecond=0)
    )

    fg_rows = await FinishedGoodsReceipt.filter(
        tenant_id=tenant_id,
        status="已入库",
        receipt_time__gte=start_dt,
        receipt_time__lte=end_dt,
        deleted_at__isnull=True,
    ).values_list("receipt_time", "total_quantity")

    rep_rows = await ReportingRecord.filter(
        tenant_id=tenant_id,
        reported_at__gte=start_dt,
        reported_at__lte=end_dt,
    ).values_list("reported_at", "qualified_quantity")

    bucket: dict = {}

    def _add(dt, qty: float, key: str):
        if not dt:
            return
        d = dt.strftime("%m-%d")
        sk = dt.strftime("%Y-%m-%d")
        b = bucket.setdefault(sk, {"date": d, "output": 0.0, "qualified": 0.0, "_sort": sk})
        b[key] += float(qty or 0)

    for dt, qty in fg_rows:
        _add(dt, qty, "output")
    for dt, qty in rep_rows:
        _add(dt, qty, "qualified")

    items = [
        {"date": b["date"], "output": round(b["output"], 2), "qualified": round(b["qualified"], 2)}
        for b in sorted(bucket.values(), key=lambda x: x["_sort"])
    ]
    return {"items": items}


@router.get("/equipment-trend", summary="Equipment fault daily trend")
@cache_by_kwargs(namespace="dashboard:equipment_trend", ttl=60)
async def get_equipment_trend(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    date_start: Optional[str] = Query(None, description="起始日期 YYYY-MM-DD"),
    date_end: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
):
    """设备故障报修按日计数趋势。"""
    from apps.kuaizhizao.models.equipment_fault import EquipmentFault

    now = resolve_business_datetime()
    start_dt = (
        datetime.strptime(date_start, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
        if date_start else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    )
    end_dt = (
        datetime.strptime(date_end, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=0)
        if date_end else now.replace(hour=23, minute=59, second=59, microsecond=0)
    )

    rows = await EquipmentFault.filter(
        tenant_id=tenant_id,
        created_at__gte=start_dt,
        created_at__lte=end_dt,
        deleted_at__isnull=True,
    ).values_list("created_at")

    bucket: dict = {}
    for (dt,) in rows:
        if not dt:
            continue
        sk = dt.strftime("%Y-%m-%d")
        bucket[sk] = bucket.get(sk, 0) + 1

    items = [
        {"date": datetime.strptime(sk, "%Y-%m-%d").strftime("%m-%d"), "count": cnt, "_sort": sk}
        for sk, cnt in sorted(bucket.items())
    ]
    for it in items:
        it.pop("_sort", None)
    return {"items": items}


@router.get("/performance-summary", summary="Performance center summary")
@cache_by_kwargs(namespace="dashboard:performance_summary", ttl=60)
async def get_performance_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """绩效中心 KPI：待确认汇总、本月已确认、技能配置数。"""
    from apps.master_data.models.performance import Skill
    from apps.master_data.models.employee_performance import PerformanceSummary

    pending = await PerformanceSummary.filter(
        tenant_id=tenant_id,
        status="calculated",
        deleted_at__isnull=True,
    ).count()
    confirmed = await PerformanceSummary.filter(
        tenant_id=tenant_id,
        status__in=["confirmed", "已确认"],
        deleted_at__isnull=True,
    ).count()
    skills = await Skill.filter(tenant_id=tenant_id, deleted_at__isnull=True).count()

    return {
        "pending_summaries": pending,
        "confirmed_summaries": confirmed,
        "skill_records": skills,
    }


async def get_dashboard(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DashboardResponse:
    """
    获取工作台数据
    
    整合待办事项和统计数据
    """
    todos = await get_todos(current_user=current_user, tenant_id=tenant_id)
    statistics = await get_statistics(current_user=current_user, tenant_id=tenant_id)
    
    return DashboardResponse(
        todos=todos,
        statistics=statistics,
    )

