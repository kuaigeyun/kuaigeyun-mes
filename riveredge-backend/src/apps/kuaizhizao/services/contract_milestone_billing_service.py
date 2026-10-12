"""
销售合同里程碑收款 / 应收生成
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from apps.common.optional_pro import import_pro_module
from apps.kuaizhizao.models.sales_contract import SalesContract
from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.models.purchase_order_milestone import PurchaseOrderMilestone
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_milestone import SalesOrderMilestone
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.services.business_config_service import BusinessConfigService


class ContractMilestoneBillingService:
    def __init__(self) -> None:
        self.business_config_service = BusinessConfigService()
        self._receivable_service = None
        self._payable_service = None

    def _ensure_finance(self) -> None:
        if self._receivable_service is not None:
            return
        svc = import_pro_module("apps.kuaicaiwu.services.finance_service")
        self._receivable_service = svc.ReceivableService()
        self._payable_service = svc.PayableService()

    @property
    def receivable_service(self):
        self._ensure_finance()
        return self._receivable_service

    @property
    def payable_service(self):
        self._ensure_finance()
        return self._payable_service

    @staticmethod
    def _finance_schemas():
        return import_pro_module("apps.kuaicaiwu.schemas.finance")

    @staticmethod
    def _finance_source_types():
        return import_pro_module("apps.kuaicaiwu.constants.finance_source_types")

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

    @staticmethod
    async def order_has_delivery_billing_milestones(tenant_id: int, sales_order_id: int) -> bool:
        """订单存在按到货触发的收款节点时，出库不再走整单金额自动生成应收（改由里程碑链路）。"""
        return await SalesOrderMilestone.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            billing_trigger="delivery",
            is_prepayment=False,
        ).exists()

    @staticmethod
    async def purchase_order_has_delivery_billing_milestones(
        tenant_id: int, purchase_order_id: int
    ) -> bool:
        """采购订单存在按到货触发的付款节点时，入库不再走整单金额自动生成应付。"""
        return await PurchaseOrderMilestone.filter(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            billing_trigger="delivery",
            is_prepayment=False,
        ).exists()

    async def should_skip_shipment_receivable_for_order(
        self, tenant_id: int, customer_id: Optional[int], contract_id: Optional[int],
        sales_order_id: Optional[int] = None,
    ) -> bool:
        if sales_order_id:
            if await self.order_has_delivery_billing_milestones(tenant_id, sales_order_id):
                return True
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

    async def should_skip_receipt_payable_for_order(
        self, tenant_id: int, supplier_id: Optional[int], purchase_order_id: int
    ) -> bool:
        """采购入库整单应付与订单按到货付款计划互斥。"""
        _ = supplier_id
        return await self.purchase_order_has_delivery_billing_milestones(
            tenant_id, purchase_order_id
        )

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
        schemas = self._finance_schemas()
        source_types = self._finance_source_types()
        receivable = await self.receivable_service.create_receivable(
            tenant_id=tenant_id,
            receivable_data=schemas.ReceivableCreate(
                source_type=source_types.RECEIVABLE_SOURCE_CONTRACT_MILESTONE,
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
        *,
        force: bool = False,
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
        if not force:
            cfg = await self.business_config_service.get_business_config(tenant_id)
            org_rev = str(cfg.get("parameters", {}).get("finance", {}).get("revenue_recognition") or "on_shipment")
            if org_rev not in ("on_milestone", "mixed"):
                raise BusinessLogicError("当前租户未启用里程碑收款模式")
        schemas = self._finance_schemas()
        source_types = self._finance_source_types()
        receivable = await self.receivable_service.create_receivable(
            tenant_id=tenant_id,
            receivable_data=schemas.ReceivableCreate(
                source_type=source_types.RECEIVABLE_SOURCE_ORDER_MILESTONE,
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

    async def generate_payable_for_order_milestone(
        self,
        tenant_id: int,
        purchase_order_id: int,
        milestone_id: int,
        created_by: int,
    ):
        order = await PurchaseOrder.get_or_none(
            tenant_id=tenant_id, id=purchase_order_id, deleted_at__isnull=True
        )
        if not order:
            raise NotFoundError("采购订单不存在")
        milestone = await PurchaseOrderMilestone.get_or_none(
            tenant_id=tenant_id, id=milestone_id, purchase_order_id=purchase_order_id
        )
        if not milestone:
            raise NotFoundError("订单付款里程碑不存在")
        if getattr(milestone, "is_prepayment", False):
            raise BusinessLogicError("预付节点由订单确认自动生成预付付款单，不可再生成应付")
        if milestone.payable_id:
            return await self.payable_service.get_payable_by_id(
                tenant_id, milestone.payable_id
            )
        amount = Decimal(str(milestone.planned_amount or 0))
        if amount <= 0:
            raise BusinessLogicError("里程碑计划金额须大于 0")
        schemas = self._finance_schemas()
        source_types = self._finance_source_types()
        payable = await self.payable_service.create_payable(
            tenant_id=tenant_id,
            payable_data=schemas.PayableCreate(
                source_type=source_types.PAYABLE_SOURCE_ORDER_MILESTONE,
                source_id=milestone.id,
                source_code=(order.order_code or "")[:50],
                supplier_id=order.supplier_id,
                supplier_name=order.supplier_name,
                total_amount=amount,
                paid_amount=Decimal("0"),
                remaining_amount=amount,
                due_date=milestone.planned_date,
                business_date=date.today(),
                notes=f"采购订单 {order.order_code} 里程碑 {milestone.milestone_name}",
            ),
            created_by=created_by,
        )
        milestone.payable_id = payable.id
        milestone.payable_code = payable.payable_code
        milestone.status = "invoiced"
        await milestone.save(update_fields=["payable_id", "payable_code", "status", "updated_at"])
        return payable

    async def auto_generate_receivables_for_sales_order(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> int:
        """审单后：为开启自动应收的普通里程碑节点生成应收（不含预收、不含按到货节点）。"""
        rows = await SalesOrderMilestone.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            is_prepayment=False,
            auto_generate_receivable=True,
            receivable_id__isnull=True,
        ).order_by("planned_date", "id")
        generated = 0
        for row in rows:
            if (row.billing_trigger or "milestone") == "delivery":
                continue
            await self.generate_receivable_for_order_milestone(
                tenant_id, sales_order_id, int(row.id), created_by, force=True
            )
            generated += 1
        return generated

    async def auto_generate_payables_for_purchase_order(
        self,
        tenant_id: int,
        purchase_order_id: int,
        created_by: int,
    ) -> int:
        """确认后：为开启自动应付的普通里程碑节点生成应付（不含预付、不含按到货节点）。"""
        rows = await PurchaseOrderMilestone.filter(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            is_prepayment=False,
            auto_generate_payable=True,
            payable_id__isnull=True,
        ).order_by("planned_date", "id")
        generated = 0
        for row in rows:
            if (row.billing_trigger or "milestone") == "delivery":
                continue
            await self.generate_payable_for_order_milestone(
                tenant_id, purchase_order_id, int(row.id), created_by
            )
            generated += 1
        return generated

    async def auto_generate_delivery_milestone_receivables_on_shipment(
        self,
        tenant_id: int,
        sales_order_id: int,
        created_by: int,
    ) -> int:
        """销售出库确认：按序触发下一个「按到货 + 自动生成应收」的收款节点（每次出库最多 1 条）。"""
        row = await SalesOrderMilestone.filter(
            tenant_id=tenant_id,
            sales_order_id=sales_order_id,
            is_prepayment=False,
            billing_trigger="delivery",
            auto_generate_receivable=True,
            receivable_id__isnull=True,
        ).order_by("planned_date", "id").first()
        if not row:
            return 0
        await self.generate_receivable_for_order_milestone(
            tenant_id, sales_order_id, int(row.id), created_by, force=True
        )
        return 1

    async def auto_generate_delivery_milestone_payables_on_receipt(
        self,
        tenant_id: int,
        purchase_order_id: int,
        created_by: int,
    ) -> int:
        """采购入库确认：按序触发下一个「按到货 + 自动生成应付」的付款节点（每次入库最多 1 条）。"""
        row = await PurchaseOrderMilestone.filter(
            tenant_id=tenant_id,
            purchase_order_id=purchase_order_id,
            is_prepayment=False,
            billing_trigger="delivery",
            auto_generate_payable=True,
            payable_id__isnull=True,
        ).order_by("planned_date", "id").first()
        if not row:
            return 0
        await self.generate_payable_for_order_milestone(
            tenant_id, purchase_order_id, int(row.id), created_by
        )
        return 1

    async def sync_milestone_on_payable_settled(self, tenant_id: int, payable_id: int) -> None:
        order_ms = await PurchaseOrderMilestone.get_or_none(
            tenant_id=tenant_id, payable_id=payable_id
        )
        if not order_ms:
            return
        order_ms.status = "paid"
        await order_ms.save(update_fields=["status", "updated_at"])
