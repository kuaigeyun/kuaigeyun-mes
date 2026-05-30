"""
凭证过账服务：由 AccountingEvent 生成草稿凭证。
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.accounting_event import AccountingEvent
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.services.voucher_template_service import VoucherTemplateService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PostingService:
    def __init__(self):
        self.template_service = VoucherTemplateService()

    async def create_draft_voucher_from_event(
        self,
        tenant_id: int,
        event_id: int,
        created_by: int,
    ) -> Voucher:
        event = await AccountingEvent.get_or_none(tenant_id=tenant_id, id=event_id)
        if not event:
            raise NotFoundError(f"会计事件不存在: {event_id}")

        existing = await Voucher.filter(
            tenant_id=tenant_id,
            source_event_id=event_id,
            deleted_at__isnull=True,
        ).first()
        if existing:
            return existing

        draft_lines = await self.template_service.build_draft_lines_from_event(tenant_id, event)
        if not draft_lines:
            raise ValidationError(f"事件 {event.event_code} 无法生成凭证分录（请维护科目表）")

        voucher_date = event.event_date or datetime.now().date()
        total_debit = sum(Decimal(str(l["debit_amount"])) for l in draft_lines)
        total_credit = sum(Decimal(str(l["credit_amount"])) for l in draft_lines)
        if total_debit != total_credit:
            raise ValidationError("凭证借贷不平衡")

        today = datetime.now().strftime("%Y%m%d")
        voucher_code = f"PZ{today}{uuid.uuid4().hex[:6].upper()}"

        async with in_transaction():
            voucher = await Voucher.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                voucher_code=voucher_code,
                voucher_date=voucher_date,
                period_year=voucher_date.year,
                period_month=voucher_date.month,
                status="draft",
                summary=event.notes or event.event_type,
                source_event_id=event.id,
                source_doc_type=event.source_doc_type,
                source_doc_id=event.source_doc_id,
                total_debit=total_debit,
                total_credit=total_credit,
                created_by=created_by,
            )
            for line in draft_lines:
                await VoucherLine.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    voucher_id=voucher.id,
                    line_no=line["line_no"],
                    account_id=line["account_id"],
                    account_code=line["account_code"],
                    account_name=line["account_name"],
                    summary=line.get("summary"),
                    debit_amount=line["debit_amount"],
                    credit_amount=line["credit_amount"],
                )
        return voucher

    async def post_voucher(self, tenant_id: int, voucher_id: int, posted_by: int) -> Voucher:
        voucher = await Voucher.get_or_none(
            tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True
        )
        if not voucher:
            raise NotFoundError(f"凭证不存在: {voucher_id}")
        if voucher.status != "draft":
            raise ValidationError("仅草稿凭证可过账")

        from apps.kuaicaiwu.services.period_close_service import PeriodCloseService

        await PeriodCloseService().assert_period_open(
            tenant_id, voucher.period_year, voucher.period_month
        )

        voucher.status = "posted"
        voucher.posted_at = datetime.now()
        voucher.posted_by = posted_by
        await voucher.save()
        return voucher

    async def list_vouchers(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> List[Voucher]:
        q = Voucher.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        return await q.offset(skip).limit(limit).order_by("-voucher_date", "-id")
