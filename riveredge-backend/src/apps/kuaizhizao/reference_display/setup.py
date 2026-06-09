"""快智造单据引用展示 Provider 注册。"""

from __future__ import annotations

from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.mold import Mold
from apps.kuaizhizao.models.other_inbound import OtherInbound
from apps.kuaizhizao.models.other_outbound import OtherOutbound
from apps.kuaizhizao.models.outsource_order import OutsourceOrder
from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_plan import ProductionPlan
from apps.kuaizhizao.models.production_return import ProductionReturn
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_return import PurchaseReturn
from apps.kuaizhizao.models.rework_order import ReworkOrder
from apps.kuaizhizao.models.sales_delivery import SalesDelivery
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_return import SalesReturn
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.master_data.models.performance import Holiday, Skill
from core.services.reference.reference_display_provider_registry import register_reference_display_provider
from core.services.reference.tenant_model_display_provider import make_tenant_model_display_provider

_registered = False

_EXTRA_PROVIDERS = [
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:work-order",
        model=WorkOrder,
        scope_resource="kuaizhizao:work-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:sales-order",
        model=SalesOrder,
        code_field="order_code",
        name_field="customer_name",
        order_by="order_code",
        scope_resource="kuaizhizao:sales-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:purchase-order",
        model=PurchaseOrder,
        code_field="order_code",
        name_field="supplier_name",
        order_by="order_code",
        scope_resource="kuaizhizao:purchase-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:rework-order",
        model=ReworkOrder,
        scope_resource="kuaizhizao:rework-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:outsource-order",
        model=OutsourceOrder,
        scope_resource="kuaizhizao:outsource-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:outsource-work-order",
        model=OutsourceWorkOrder,
        scope_resource="kuaizhizao:outsource-order",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:purchase-receipt",
        model=PurchaseReceipt,
        code_field="receipt_code",
        name_field="supplier_name",
        order_by="receipt_code",
        scope_resource="kuaizhizao:inbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:purchase-return",
        model=PurchaseReturn,
        code_field="return_code",
        name_field="supplier_name",
        order_by="return_code",
        scope_resource="kuaizhizao:purchase-return",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:sales-delivery",
        model=SalesDelivery,
        code_field="delivery_code",
        name_field="customer_name",
        order_by="delivery_code",
        scope_resource="kuaizhizao:outbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:sales-return",
        model=SalesReturn,
        code_field="return_code",
        name_field="customer_name",
        order_by="return_code",
        scope_resource="kuaizhizao:sales-return",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:production-plan",
        model=ProductionPlan,
        code_field="plan_code",
        name_field="plan_name",
        order_by="plan_code",
        scope_resource="kuaizhizao:plan-management-scheduling",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:equipment",
        model=Equipment,
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:mold",
        model=Mold,
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:production-picking",
        model=ProductionPicking,
        code_field="picking_code",
        name_field="work_order_code",
        order_by="picking_code",
        scope_resource="kuaizhizao:inbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:production-return",
        model=ProductionReturn,
        code_field="return_code",
        name_field="work_order_code",
        order_by="return_code",
        scope_resource="kuaizhizao:inbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:other-inbound",
        model=OtherInbound,
        code_field="inbound_code",
        name_field="reason_type",
        order_by="inbound_code",
        scope_resource="kuaizhizao:other-inbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:other-outbound",
        model=OtherOutbound,
        code_field="outbound_code",
        name_field="reason_type",
        order_by="outbound_code",
        scope_resource="kuaizhizao:other-outbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:finished-goods-receipt",
        model=FinishedGoodsReceipt,
        code_field="receipt_code",
        name_field="work_order_code",
        order_by="receipt_code",
        scope_resource="kuaizhizao:inbound",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:quality-management-incoming-inspection",
        model=IncomingInspection,
        code_field="inspection_code",
        name_field="material_name",
        order_by="inspection_code",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:quality-management-process-inspection",
        model=ProcessInspection,
        code_field="inspection_code",
        name_field="operation_name",
        order_by="inspection_code",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:quality-management-finished-goods-inspection",
        model=FinishedGoodsInspection,
        code_field="inspection_code",
        name_field="work_order_code",
        order_by="inspection_code",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:performance-holidays",
        model=Holiday,
        code_field="name",
        name_field="holiday_type",
        order_by="holiday_date",
    ),
    make_tenant_model_display_provider(
        resource_key="kuaizhizao:performance-skills",
        model=Skill,
    ),
]


def register_kuaizhizao_reference_display_providers() -> None:
    global _registered
    if _registered:
        return
    for provider in _EXTRA_PROVIDERS:
        register_reference_display_provider(provider)
    _registered = True
