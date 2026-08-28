"""
销售合同里程碑收款 / 应收生成
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from apps.kuaicaiwu.constants.finance_source_types import (
    RECEIVABLE_SOURCE_CONTRACT_MILESTONE,
    RECEIVABLE_SOURCE_ORDER_MILESTONE,
)
from apps.kuaicaiwu.schemas.finance import ReceivableCreate
from apps.kuaicaiwu.services.finance_service import ReceivableService
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_milestone import SalesOrderMilestone
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.services.business_config_service import BusinessConfigService


class ContractMilestoneBillingService:
    def __init__(self) -> None:
        self.business_config_service = BusinessConfigService()
        self.receivable_service = ReceivableService()

    async def resolve_contract_billing_mode(
        self, tenant_id: int, customer_id: Optional[int], contract: SalesContract
    ) -> str:
        cfg = await self.business_config_service.get_business_config(tenant_id)
        org_rev = str(cfg.get("parameters", {}).get("finance", {}).get("revenue_recognition") or "on_shipment")
        if org_rev not in ("on_shipment", "on_invoice", "on_milestone", "mixed"):
            org_rev = "on_shipment"
        mode = org_rev
        if customer_id:
            from apps.master_data.models.customer import Customer

            customer = await Customer.get_or_none(id=customer_id, deleted_at__isnull=True)
            override = getattr(customer, "contract_billing_mode", None) if customer else None
            if override and str(override).strip() not in ("", "follow_org"):
                mode = str(override).strip()
        milestone_count = await SalesContractMilestone.filter(
            tenant_id=tenant_id, contract_id=contract.id
        ).count()
        if mode == "mixed":
            return "on_milestone" if milestone_count > 0 else "on_shipment"
        return mode

    async def should_skip_shipment_receivable_for_order(
        self, tenant_id: int, customer_id: Optional[int], contract_id: Optional[int],
        sales_order_id: Optional[int] = None,
    ) -> bool:
        if sales_order_id:
            order = await SalesOrder.get_or_none(
                tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
            )
            if order:
                order_milestone_count = await SalesOrderMilestone.filter(
                    tenant_id=tenant_id, sales_order_id=sales_order_id
                ).count()
                if order_milestone_count > 0:
                    cfg = await self.business_config_service.get_business_config(tenant_id)
                    org_rev = str(
                        cfg.get("parameters", {}).get("finance", {}).get("revenue_recognition") or "on_shipment"
                    )
                    mode = org_rev
                    if customer_id:
                        from apps.master_data.models.customer import Customer

                        customer = await Customer.get_or_none(id=customer_id, deleted_at__isnull=True)
                        override = getattr(customer, "contract_billing_mode", None) if customer else None
                        if override and str(override).strip() not in ("", "follow_org"):
                            mode = str(override).strip()
                    if mode in ("on_milestone", "mixed"):
                        return True
        if not contract_id:
            return False
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            return False
        mode = await self.resolve_contract_billing_mode(tenant_id, customer_id, contract)
        if mode == "on_milestone":
            return True
        if mode == "mixed":
            count = await SalesContractMilestone.filter(tenant_id=tenant_id, contract_id=contract_id).count()
            return count > 0
        return False

    async def generate_receivable_for_milestone(
        self,
        tenant_id: int,
        contract_id: int,
        milestone_id: int,
        created_by: int,
    ):
        contract = await SalesContract.get_or_none(tenant_id=tenant_id, id=contract_id, deleted_at__isnull=True)
        if not contract:
            raise NotFoundError("销售合同不存在")
        milestone = await SalesContractMilestone.get_or_none(
            tenant_id=tenant_id, id=milestone_id, contract_id=contract_id
        )
        if not milestone:
            raise NotFoundError("合同里程碑不存在")
        if milestone.receivable_id:
            existing = await self.receivable_service.get_receivable_by_id(tenant_id, milestone.receivable_id)
            return existing
        amount = Decimal(str(milestone.planned_amount or 0))
        if amount <= 0:
            raise BusinessLogicError("里程碑计划金额须大于 0")
        mode = await self.resolve_contract_billing_mode(tenant_id, contract.customer_id, contract)
        if mode not in ("on_milestone", "mixed"):
            raise BusinessLogicError("当前租户/客户未启用里程碑收款模式")
        receivable = await self.receivable_service.create_receivable(
            tenant_id=tenant_id,
            receivable_data=ReceivableCreate(
                source_type=RECEIVABLE_SOURCE_CONTRACT_MILESTONE,
                source_id=milestone.id,
                source_code=(contract.contract_code or "")[:50],
                customer_id=contract.customer_id,
                customer_name=contract.customer_name,
                total_amount=amount,
                received_amount=Decimal("0"),
                remaining_amount=amount,
                due_date=milestone.planned_date,
                business_date=date.today(),
                payment_terms=contract.payment_terms,
                notes=f"销售合同 {contract.contract_code} 里程碑 {milestone.milestone_name}",
            ),
            created_by=created_by,
        )
        milestone.receivable_id = receivable.id
        milestone.receivable_code = receivable.receivable_code
        milestone.status = "invoiced"
        await milestone.save(update_fields=["receivable_id", "receivable_code", "status", "updated_at"])
        return receivable

    async def generate_receivable_for_order_milestone(
        self,
        tenant_id: int,
        sales_order_id: int,
        milestone_id: int,
        created_by: int,
    ):
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError("销售订单不存在")
        milestone = await SalesOrderMilestone.get_or_none(
            tenant_id=tenant_id, id=milestone_id, sales_order_id=sales_order_id
        )
        if not milestone:
            raise NotFoundError("订单收款里程碑不存在")
        if getattr(milestone, "is_prepayment", False):
            raise BusinessLogicError("预收节点由订单审核自动生成预收收款单，不可再生成应收")
        if milestone.receivable_id:
            return await self.receivable_service.get_receivable_by_id(
                tenant_id, milestone.receivable_id
            )
        amount = Decimal(str(milestone.planned_amount or 0))
        if amount <= 0:
            raise BusinessLogicError("里程碑计划金额须大于 0")
        cfg = await self.business_config_service.get_business_config(tenant_id)
        org_rev = str(cfg.get("parameters", {}).get("finance", {}).get("revenue_recognition") or "on_shipment")
        if org_rev not in ("on_milestone", "mixed"):
            raise BusinessLogicError("当前租户未启用里程碑收款模式")
        receivable = await self.receivable_service.create_receivable(
            tenant_id=tenant_id,
            receivable_data=ReceivableCreate(
                source_type=RECEIVABLE_SOURCE_ORDER_MILESTONE,
                source_id=milestone.id,
                source_code=(order.order_code or "")[:50],
                customer_id=order.customer_id,
                customer_name=order.customer_name,
                total_amount=amount,
                received_amount=Decimal("0"),
                remaining_amount=amount,
                due_date=milestone.planned_date,
                business_date=date.today(),
                payment_terms=order.payment_terms,
                notes=f"销售订单 {order.order_code} 里程碑 {milestone.milestone_name}",
            ),
            created_by=created_by,
        )
        milestone.receivable_id = receivable.id
        milestone.receivable_code = receivable.receivable_code
        milestone.status = "invoiced"
        await milestone.save(update_fields=["receivable_id", "receivable_code", "status", "updated_at"])
        return receivable

    async def sync_milestone_on_receivable_settled(self, tenant_id: int, receivable_id: int) -> None:
        milestone = await SalesContractMilestone.get_or_none(
            tenant_id=tenant_id, receivable_id=receivable_id
        )
        if milestone:
            milestone.status = "collected"
            await milestone.save(update_fields=["status", "updated_at"])
            return
        order_ms = await SalesOrderMilestone.get_or_none(
            tenant_id=tenant_id, receivable_id=receivable_id
        )
        if not order_ms:
            return
        order_ms.status = "collected"
        await order_ms.save(update_fields=["status", "updated_at"])
