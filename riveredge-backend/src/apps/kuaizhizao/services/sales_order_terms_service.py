"""销售订单条款与收款里程碑（与框架合同共用条款目录）。"""

from __future__ import annotations

from decimal import Decimal
from typing import List, Optional

from apps.kuaizhizao.models.sales_contract_term_group import SalesContractTermGroup
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.sales_order_milestone import SalesOrderMilestone
from apps.kuaizhizao.schemas.sales_order import SalesOrderMilestoneCreate, SalesOrderMilestoneResponse
from apps.kuaizhizao.services.sales_contract_term_service import SalesContractTermService
from infra.exceptions.exceptions import BusinessLogicError


class SalesOrderTermsService:
    def __init__(self) -> None:
        self.term_service = SalesContractTermService()

    async def resolve_order_terms(
        self,
        tenant_id: int,
        term_group_id: Optional[int],
        contract_terms=None,
    ) -> tuple[Optional[int], Optional[str], Optional[list]]:
        if contract_terms is not None:
            group_name = None
            if term_group_id:
                group = await SalesContractTermGroup.get_or_none(
                    tenant_id=tenant_id, id=term_group_id, deleted_at__isnull=True
                )
                group_name = group.group_name if group else None
            snapshot = [
                t.model_dump() if hasattr(t, "model_dump") else dict(t)
                for t in contract_terms
            ]
            return term_group_id, group_name, snapshot
        if term_group_id:
            return await self.term_service.build_terms_snapshot(tenant_id, term_group_id)
        return None, None, None

    async def replace_order_milestones(
        self,
        tenant_id: int,
        sales_order_id: int,
        milestones: Optional[List[SalesOrderMilestoneCreate]],
    ) -> None:
        if milestones is None:
            return
        prepay_count = sum(1 for ms in milestones if bool(getattr(ms, "is_prepayment", False)))
        if prepay_count > 1:
            raise BusinessLogicError("收款计划中最多只能有一个预收节点")
        existing = await SalesOrderMilestone.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        )
        for row in existing:
            if row.receivable_id:
                raise BusinessLogicError("已有里程碑生成应收，不可删除或覆盖")
        await SalesOrderMilestone.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).delete()
        for ms in milestones:
            is_prepay = bool(ms.is_prepayment)
            await SalesOrderMilestone.create(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                milestone_name=ms.milestone_name,
                planned_date=ms.planned_date,
                planned_amount=Decimal(str(ms.planned_amount or 0)),
                planned_ratio=ms.planned_ratio,
                billing_trigger=ms.billing_trigger or "milestone",
                is_prepayment=is_prepay,
                bank_account_id=ms.bank_account_id if is_prepay else None,
                notes=ms.notes,
            )
        await self.sync_order_prepayment_from_milestones(tenant_id, sales_order_id)

    @classmethod
    async def sync_order_prepayment_from_milestones(
        cls, tenant_id: int, sales_order_id: int
    ) -> None:
        """预收节点回写订单表头预收字段，保证审单自动生成预收收款单逻辑不断。"""
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            return
        prepay_rows = await SalesOrderMilestone.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id, is_prepayment=True
        )
        if len(prepay_rows) > 1:
            raise BusinessLogicError("收款计划中最多只能有一个预收节点")
        if not prepay_rows:
            order.prepayment_amount = None
            order.prepayment_bank_account_id = None
        else:
            row = prepay_rows[0]
            order.prepayment_amount = Decimal(str(row.planned_amount or 0))
            order.prepayment_bank_account_id = row.bank_account_id
        await order.save(
            update_fields=["prepayment_amount", "prepayment_bank_account_id", "updated_at"]
        )

    @staticmethod
    async def load_payment_milestones(
        tenant_id: int, sales_order_id: int
    ) -> List[SalesOrderMilestoneResponse]:
        rows = await SalesOrderMilestone.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).order_by("planned_date", "id")
        if rows:
            return [SalesOrderMilestoneResponse.model_validate(r) for r in rows]

        # 存量：仅有表头预收、尚未写入收款计划时，读侧合成预收节点（不落库，保存时再落）
        order = await SalesOrder.get_or_none(
            tenant_id=tenant_id, id=sales_order_id, deleted_at__isnull=True
        )
        if not order:
            return []
        amount = Decimal(str(order.prepayment_amount or 0))
        if amount <= 0:
            return []
        planned_date = order.order_date
        if planned_date is None:
            return []
        return [
            SalesOrderMilestoneResponse(
                id=0,
                uuid="",
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                milestone_name="预收",
                planned_date=planned_date,
                planned_amount=amount,
                planned_ratio=None,
                billing_trigger="milestone",
                is_prepayment=True,
                bank_account_id=order.prepayment_bank_account_id,
                status="pending",
                receivable_id=None,
                receivable_code=None,
                notes=None,
                created_at=order.created_at,
                updated_at=order.updated_at,
            )
        ]

    @staticmethod
    async def copy_milestones_from_contract(
        tenant_id: int,
        sales_order_id: int,
        contract_id: int,
        *,
        skip_invoiced: bool = True,
    ) -> int:
        from apps.kuaizhizao.models.sales_contract_milestone import SalesContractMilestone

        source_rows = await SalesContractMilestone.filter(
            tenant_id=tenant_id, contract_id=contract_id
        ).order_by("planned_date", "id")
        if not source_rows:
            return 0
        existing = await SalesOrderMilestone.filter(
            tenant_id=tenant_id, sales_order_id=sales_order_id
        ).count()
        if existing > 0:
            return 0
        created = 0
        for ms in source_rows:
            if skip_invoiced and ms.receivable_id:
                continue
            await SalesOrderMilestone.create(
                tenant_id=tenant_id,
                sales_order_id=sales_order_id,
                milestone_name=ms.milestone_name,
                planned_date=ms.planned_date,
                planned_amount=Decimal(str(ms.planned_amount or 0)),
                planned_ratio=ms.planned_ratio,
                billing_trigger=ms.billing_trigger or "milestone",
                is_prepayment=False,
                bank_account_id=None,
                notes=ms.notes,
            )
            created += 1
        if created:
            await SalesOrderTermsService.sync_order_prepayment_from_milestones(
                tenant_id, sales_order_id
            )
        return created
