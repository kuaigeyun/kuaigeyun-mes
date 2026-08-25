"""
票据台账服务
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.finance_note import FinanceNote
from core.utils.timezone_utils import resolve_business_datetime, today_site_str, to_site_date
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

_DIRECTIONS = frozenset({"receivable", "payable"})
_BILL_TYPES = frozenset(
    {
        "bank_acceptance",
        "commercial_acceptance",
        "bank_draft",
        "bank_promissory_note",
        "cheque",
    }
)
_BILL_TYPE_LABELS = (
    "bank_acceptance / commercial_acceptance / bank_draft / bank_promissory_note / cheque"
)
_RECEIVABLE_STATUSES = frozenset({"held", "endorsed", "discounted", "collected", "dishonored"})
_PAYABLE_STATUSES = frozenset({"issued", "honored", "dishonored"})
_RECEIVABLE_TERMINAL = frozenset({"endorsed", "discounted", "collected", "dishonored"})
_PAYABLE_TERMINAL = frozenset({"honored", "dishonored"})
_RECEIVABLE_ACTIONS = frozenset({"endorse", "discount", "collect", "dishonor"})
_PAYABLE_ACTIONS = frozenset({"honor", "dishonor"})


class FinanceNoteService(AppBaseService[FinanceNote]):
    def __init__(self) -> None:
        super().__init__(FinanceNote)

    @staticmethod
    def normalize_direction(direction: str) -> str:
        value = str(direction or "").strip().lower()
        if value not in _DIRECTIONS:
            raise ValidationError("票据方向仅支持 receivable 或 payable")
        return value

    @staticmethod
    def normalize_bill_type(bill_type: str) -> str:
        value = str(bill_type or "").strip().lower()
        if value not in _BILL_TYPES:
            raise ValidationError(f"票据类型仅支持 {_BILL_TYPE_LABELS}")
        return value

    @staticmethod
    def initial_status(direction: str) -> str:
        return "held" if direction == "receivable" else "issued"

    async def _generate_note_code(self, tenant_id: int, direction: str) -> str:
        today = today_site_str().replace("-", "")
        prefix = "NR" if direction == "receivable" else "NP"
        base = f"{prefix}{today}"
        count = await FinanceNote.filter(
            tenant_id=tenant_id,
            note_code__startswith=base,
            deleted_at__isnull=True,
        ).count()
        return f"{base}{count + 1:04d}"

    def _validate_bank_fields(self, bill_type: str, accepting_bank: Optional[str]) -> None:
        if bill_type == "bank_acceptance" and not str(accepting_bank or "").strip():
            raise ValidationError("银承须填写承兑行")

    def _validate_partner(
        self,
        direction: str,
        *,
        customer_id: Optional[int],
        customer_name: Optional[str],
        supplier_id: Optional[int],
        supplier_name: Optional[str],
    ) -> None:
        if direction == "receivable":
            if not customer_id:
                raise ValidationError("应收票据须选择客户")
            if not str(customer_name or "").strip():
                raise ValidationError("应收票据须填写客户名称")
        else:
            if not supplier_id:
                raise ValidationError("应付票据须选择供应商")
            if not str(supplier_name or "").strip():
                raise ValidationError("应付票据须填写供应商名称")

    async def create(
        self,
        tenant_id: int,
        *,
        direction: str,
        bill_type: str,
        bill_no: str,
        amount: Decimal,
        issue_date: date,
        due_date: date,
        drawer_name: Optional[str] = None,
        acceptor_name: Optional[str] = None,
        payee_name: Optional[str] = None,
        accepting_bank: Optional[str] = None,
        customer_id: Optional[int] = None,
        customer_name: Optional[str] = None,
        supplier_id: Optional[int] = None,
        supplier_name: Optional[str] = None,
        receipt_id: Optional[int] = None,
        payment_id: Optional[int] = None,
        receivable_id: Optional[int] = None,
        payable_id: Optional[int] = None,
        notes: Optional[str] = None,
        attachments: Optional[list] = None,
        current_user: Optional[User] = None,
    ) -> FinanceNote:
        dir_norm = self.normalize_direction(direction)
        type_norm = self.normalize_bill_type(bill_type)
        self._validate_bank_fields(type_norm, accepting_bank)
        self._validate_partner(
            dir_norm,
            customer_id=customer_id,
            customer_name=customer_name,
            supplier_id=supplier_id,
            supplier_name=supplier_name,
        )
        if not str(bill_no or "").strip():
            raise ValidationError("票号不能为空")
        if due_date < issue_date:
            raise ValidationError("到期日不能早于出票日")

        note_code = await self._generate_note_code(tenant_id, dir_norm)
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "uuid": str(uuid.uuid4()),
            "direction": dir_norm,
            "bill_type": type_norm,
            "note_code": note_code,
            "bill_no": str(bill_no).strip(),
            "amount": Decimal(str(amount)),
            "issue_date": issue_date,
            "due_date": due_date,
            "drawer_name": (drawer_name or "").strip() or None,
            "acceptor_name": (acceptor_name or "").strip() or None,
            "payee_name": (payee_name or "").strip() or None,
            "accepting_bank": (accepting_bank or "").strip() or None,
            "customer_id": customer_id,
            "customer_name": (customer_name or "").strip() or None,
            "supplier_id": supplier_id,
            "supplier_name": (supplier_name or "").strip() or None,
            "receipt_id": receipt_id,
            "payment_id": payment_id,
            "receivable_id": receivable_id,
            "payable_id": payable_id,
            "status": self.initial_status(dir_norm),
            "notes": notes,
            "attachments": attachments,
        }
        apply_create_audit(payload, current_user)
        return await FinanceNote.create(**payload)

    async def get_by_id(self, tenant_id: int, note_id: int, *, direction: Optional[str] = None) -> FinanceNote:
        row = await FinanceNote.get_or_none(
            tenant_id=tenant_id, id=note_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"票据不存在: {note_id}")
        if direction and row.direction != self.normalize_direction(direction):
            raise NotFoundError(f"票据不存在: {note_id}")
        return row

    async def list_notes(
        self,
        tenant_id: int,
        *,
        direction: str,
        skip: int = 0,
        limit: int = 50,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        bill_type: Optional[str] = None,
        expiring_within_days: Optional[int] = None,
        due_date_start: Optional[str] = None,
        due_date_end: Optional[str] = None,
        partner_id: Optional[int] = None,
        receipt_id: Optional[int] = None,
        payment_id: Optional[int] = None,
        unlinked_only: bool = False,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> Tuple[List[FinanceNote], int]:
        dir_norm = self.normalize_direction(direction)
        q = FinanceNote.filter(tenant_id=tenant_id, direction=dir_norm, deleted_at__isnull=True)

        if keyword and str(keyword).strip():
            kw = str(keyword).strip()
            q = q.filter(
                Q(note_code__icontains=kw)
                | Q(bill_no__icontains=kw)
                | Q(customer_name__icontains=kw)
                | Q(supplier_name__icontains=kw)
                | Q(acceptor_name__icontains=kw)
            )
        if status and str(status).strip():
            q = q.filter(status=str(status).strip())
        if bill_type and str(bill_type).strip():
            q = q.filter(bill_type=self.normalize_bill_type(bill_type))
        if partner_id:
            if dir_norm == "receivable":
                q = q.filter(customer_id=partner_id)
            else:
                q = q.filter(supplier_id=partner_id)
        if receipt_id:
            q = q.filter(receipt_id=receipt_id)
        if payment_id:
            q = q.filter(payment_id=payment_id)
        if unlinked_only:
            active_statuses = ["held"] if dir_norm == "receivable" else ["issued"]
            q = q.filter(status__in=active_statuses)
            if dir_norm == "receivable":
                q = q.filter(receipt_id__isnull=True)
            else:
                q = q.filter(payment_id__isnull=True)

        if expiring_within_days is not None and expiring_within_days >= 0:
            today = to_site_date(resolve_business_datetime())
            end = today + timedelta(days=int(expiring_within_days))
            active_statuses = ["held"] if dir_norm == "receivable" else ["issued"]
            q = q.filter(status__in=active_statuses, due_date__gte=today, due_date__lte=end)

        if due_date_start:
            try:
                q = q.filter(due_date__gte=date.fromisoformat(str(due_date_start)[:10]))
            except ValueError:
                pass
        if due_date_end:
            try:
                q = q.filter(due_date__lte=date.fromisoformat(str(due_date_end)[:10]))
            except ValueError:
                pass

        order = "-due_date"
        allowed_sort = {
            "note_code", "bill_no", "amount", "issue_date", "due_date", "status", "created_at", "updated_at"
        }
        if sort_field in allowed_sort:
            order = f"{'-' if str(sort_order).lower() == 'descend' else ''}{sort_field}"

        total = await q.count()
        rows = await q.offset(skip).limit(limit).order_by(order)
        return rows, total

    async def _validate_receipt_link(
        self,
        tenant_id: int,
        note: FinanceNote,
        receipt_id: int,
    ) -> None:
        from apps.kuaicaiwu.models.receipt import Receipt

        if note.direction != "receivable":
            raise ValidationError("应收票据才能关联收款单")
        if note.status != "held":
            raise ValidationError("仅在手票据可关联收款单")
        if note.receipt_id and int(note.receipt_id) != int(receipt_id):
            raise ValidationError("票据已关联其他收款单")
        receipt = await Receipt.get_or_none(
            tenant_id=tenant_id, id=receipt_id, deleted_at__isnull=True
        )
        if not receipt:
            raise NotFoundError(f"收款单不存在: {receipt_id}")
        if note.customer_id and int(note.customer_id) != int(receipt.customer_id):
            raise ValidationError("票据客户与收款单客户不一致")

    async def _validate_payment_link(
        self,
        tenant_id: int,
        note: FinanceNote,
        payment_id: int,
    ) -> None:
        from apps.kuaicaiwu.models.payment import Payment

        if note.direction != "payable":
            raise ValidationError("应付票据才能关联付款单")
        if note.status != "issued":
            raise ValidationError("仅已开出票据可关联付款单")
        if note.payment_id and int(note.payment_id) != int(payment_id):
            raise ValidationError("票据已关联其他付款单")
        payment = await Payment.get_or_none(
            tenant_id=tenant_id, id=payment_id, deleted_at__isnull=True
        )
        if not payment:
            raise NotFoundError(f"付款单不存在: {payment_id}")
        if note.supplier_id and int(note.supplier_id) != int(payment.supplier_id):
            raise ValidationError("票据供应商与付款单供应商不一致")

    async def update_fields(
        self,
        tenant_id: int,
        note_id: int,
        *,
        direction: str,
        current_user: Optional[User] = None,
        **fields: Any,
    ) -> FinanceNote:
        row = await self.get_by_id(tenant_id, note_id, direction=direction)
        if row.status in (_RECEIVABLE_TERMINAL if row.direction == "receivable" else _PAYABLE_TERMINAL):
            raise ValidationError("票据已处于终态，不能再修改票面信息")

        allowed = {
            "bill_no", "amount", "issue_date", "due_date", "drawer_name", "acceptor_name",
            "payee_name", "accepting_bank", "customer_id", "customer_name", "supplier_id",
            "supplier_name", "receipt_id", "payment_id", "receivable_id", "payable_id",
            "notes", "attachments", "bill_type",
        }
        link_receipt_id = fields.get("receipt_id")
        link_payment_id = fields.get("payment_id")
        if link_receipt_id is not None:
            await self._validate_receipt_link(tenant_id, row, int(link_receipt_id))
        if link_payment_id is not None:
            await self._validate_payment_link(tenant_id, row, int(link_payment_id))

        for key, val in fields.items():
            if key not in allowed or val is None:
                continue
            if key == "bill_type":
                val = self.normalize_bill_type(val)
            setattr(row, key, val)

        if row.bill_type == "bank_acceptance" and not str(row.accepting_bank or "").strip():
            raise ValidationError("银承须填写承兑行")
        if row.due_date < row.issue_date:
            raise ValidationError("到期日不能早于出票日")

        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def apply_action(
        self,
        tenant_id: int,
        note_id: int,
        *,
        direction: str,
        action: str,
        current_user: Optional[User] = None,
        **payload: Any,
    ) -> FinanceNote:
        row = await self.get_by_id(tenant_id, note_id, direction=direction)
        act = str(action or "").strip().lower()
        today = to_site_date(resolve_business_datetime())

        if row.direction == "receivable":
            if act not in _RECEIVABLE_ACTIONS:
                raise ValidationError("不支持的应收票据动作")
            if row.status != "held":
                raise ValidationError("仅在手票据可执行该动作")
            if act == "endorse":
                name = str(payload.get("endorse_to_name") or "").strip()
                if not name:
                    raise ValidationError("背书须填写被背书人")
                row.status = "endorsed"
                row.endorse_to_name = name
                row.settle_date = today
            elif act == "discount":
                bank = str(payload.get("discount_bank") or "").strip()
                if not bank:
                    raise ValidationError("贴现须填写贴现银行")
                row.status = "discounted"
                row.discount_bank = bank
                row.discount_date = payload.get("discount_date") or today
                interest = payload.get("discount_interest")
                row.discount_interest = Decimal(str(interest)) if interest is not None else None
                row.settle_date = row.discount_date
            elif act == "collect":
                row.status = "collected"
                row.settle_date = payload.get("settle_date") or today
            elif act == "dishonor":
                row.status = "dishonored"
                row.settle_date = today
        else:
            if act not in _PAYABLE_ACTIONS:
                raise ValidationError("不支持的应付票据动作")
            if row.status != "issued":
                raise ValidationError("仅已开出票据可执行该动作")
            if act == "honor":
                row.status = "honored"
                row.settle_date = payload.get("settle_date") or today
            elif act == "dishonor":
                row.status = "dishonored"
                row.settle_date = today

        apply_update_audit(row, current_user)
        await row.save()
        return row

    async def delete(self, tenant_id: int, note_id: int, *, direction: str) -> None:
        row = await self.get_by_id(tenant_id, note_id, direction=direction)
        if row.status in (_RECEIVABLE_TERMINAL if row.direction == "receivable" else _PAYABLE_TERMINAL):
            raise ValidationError("终态票据不可删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def count_expiring(self, tenant_id: int, *, within_days: int = 30) -> dict[str, int]:
        today = to_site_date(resolve_business_datetime())
        end = today + timedelta(days=within_days)
        receivable = await FinanceNote.filter(
            tenant_id=tenant_id,
            direction="receivable",
            status="held",
            due_date__gte=today,
            due_date__lte=end,
            deleted_at__isnull=True,
        ).count()
        payable = await FinanceNote.filter(
            tenant_id=tenant_id,
            direction="payable",
            status="issued",
            due_date__gte=today,
            due_date__lte=end,
            deleted_at__isnull=True,
        ).count()
        return {
            "expiring_notes_receivable": receivable,
            "expiring_notes_payable": payable,
            "expiring_notes_total": receivable + payable,
        }
