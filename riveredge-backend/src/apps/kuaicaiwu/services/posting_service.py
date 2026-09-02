"""
凭证过账服务：手工凭证 + 事件生成 + 审核记账反记账。
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional

from tortoise.transactions import in_transaction

from apps.kuaicaiwu.models.accounting_event import AccountingEvent
from apps.kuaicaiwu.models.chart_of_account import ChartOfAccount
from apps.kuaicaiwu.models.voucher import Voucher
from apps.kuaicaiwu.models.voucher_line import VoucherLine
from apps.kuaicaiwu.services.voucher_template_service import VoucherTemplateService
from apps.kuaicaiwu.services.gl.balance_service import BalanceService
from apps.kuaicaiwu.services.gl.period_service import GlPeriodService
from apps.kuaicaiwu.services.gl.settings_service import GlSettingsService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime, to_site_date


def _d(v: Any) -> Decimal:
    return Decimal(str(v or 0))


class PostingService:
    def __init__(self):
        self.template_service = VoucherTemplateService()
        self.balance_service = BalanceService()
        self.period_service = GlPeriodService()
        self.settings_service = GlSettingsService()

    async def _next_voucher_code(self, tenant_id: int, voucher_word: str, voucher_date: date) -> str:
        prefix = f"{voucher_word or '记'}{voucher_date.strftime('%Y%m')}"
        existing = await Voucher.filter(
            tenant_id=tenant_id,
            voucher_code__startswith=prefix,
            deleted_at__isnull=True,
        ).count()
        return f"{prefix}{existing + 1:04d}"

    async def _validate_lines(
        self,
        tenant_id: int,
        lines: List[Dict[str, Any]],
        *,
        allow_controlled: bool,
    ) -> List[Dict[str, Any]]:
        if not lines or len(lines) < 2:
            raise ValidationError("凭证至少两行分录")
        total_debit = Decimal("0")
        total_credit = Decimal("0")
        normalized: List[Dict[str, Any]] = []
        for idx, raw in enumerate(lines, start=1):
            account = await ChartOfAccount.get_or_none(
                tenant_id=tenant_id,
                id=raw.get("account_id"),
                deleted_at__isnull=True,
            )
            if not account and raw.get("account_code"):
                account = await ChartOfAccount.get_or_none(
                    tenant_id=tenant_id,
                    account_code=str(raw["account_code"]),
                    deleted_at__isnull=True,
                )
            if not account:
                raise ValidationError(f"第{idx}行科目不存在")
            if not account.is_leaf:
                raise ValidationError(f"仅末级科目可制单: {account.account_code}")
            if account.is_controlled and not allow_controlled:
                raise ValidationError(f"受控科目禁止总账手工制单: {account.account_code}")
            debit = _d(raw.get("debit_amount"))
            credit = _d(raw.get("credit_amount"))
            if debit < 0 or credit < 0:
                raise ValidationError("金额不能为负")
            if (debit > 0 and credit > 0) or (debit == 0 and credit == 0):
                raise ValidationError(f"第{idx}行借贷只能一侧有金额")
            if account.aux_customer and not raw.get("customer_id"):
                raise ValidationError(f"科目 {account.account_code} 须录入客户辅助核算")
            if account.aux_supplier and not raw.get("supplier_id"):
                raise ValidationError(f"科目 {account.account_code} 须录入供应商辅助核算")
            if account.aux_department and not raw.get("department_id"):
                raise ValidationError(f"科目 {account.account_code} 须录入部门辅助核算")
            if getattr(account, "aux_employee", False) and not raw.get("employee_id"):
                raise ValidationError(f"科目 {account.account_code} 须录入职员辅助核算")
            if getattr(account, "aux_project", False) and not raw.get("project_id"):
                raise ValidationError(f"科目 {account.account_code} 须录入项目辅助核算")
            total_debit += debit
            total_credit += credit
            normalized.append(
                {
                    "line_no": idx,
                    "account_id": account.id,
                    "account_code": account.account_code,
                    "account_name": account.account_name,
                    "summary": raw.get("summary"),
                    "debit_amount": debit,
                    "credit_amount": credit,
                    "customer_id": raw.get("customer_id"),
                    "customer_name": raw.get("customer_name"),
                    "supplier_id": raw.get("supplier_id"),
                    "supplier_name": raw.get("supplier_name"),
                    "department_id": raw.get("department_id"),
                    "department_name": raw.get("department_name"),
                    "employee_id": raw.get("employee_id"),
                    "employee_name": raw.get("employee_name"),
                    "project_id": raw.get("project_id"),
                    "project_name": raw.get("project_name"),
                    "cash_flow_item_id": raw.get("cash_flow_item_id"),
                    "partner_id": raw.get("partner_id") or raw.get("customer_id") or raw.get("supplier_id"),
                    "partner_name": raw.get("partner_name")
                    or raw.get("customer_name")
                    or raw.get("supplier_name"),
                    "_account": account,
                }
            )
        if total_debit != total_credit:
            raise ValidationError("凭证借贷不平衡")
        if total_debit == 0:
            raise ValidationError("凭证金额不能为0")
        for item in normalized:
            item.pop("_account", None)
        return normalized

    async def _assert_deficit_control(
        self,
        tenant_id: int,
        voucher: Voucher,
        lines: List[VoucherLine],
    ) -> None:
        settings = await self.settings_service.get_or_create(tenant_id)
        if not settings.deficit_control:
            return
        designated = set(int(x) for x in (settings.cash_account_ids or [])) | set(
            int(x) for x in (settings.bank_account_ids or [])
        )
        for line in lines:
            account = await ChartOfAccount.get_or_none(
                tenant_id=tenant_id, id=line.account_id, deleted_at__isnull=True
            )
            if not account:
                continue
            if not (
                account.is_cash_journal
                or account.is_bank_journal
                or account.id in designated
            ):
                continue
            from apps.kuaicaiwu.services.gl.balance_service import _aux_key

            cid, sid, did, eid, pid = _aux_key(
                line.customer_id,
                line.supplier_id,
                line.department_id,
                line.employee_id,
                line.project_id,
            )
            bal = await self.balance_service.get_or_create_balance(
                tenant_id,
                voucher.period_year,
                voucher.period_month,
                account,
                cid,
                sid,
                did,
                eid,
                pid,
            )
            end_debit = _d(bal.ending_debit) + _d(line.debit_amount)
            end_credit = _d(bal.ending_credit) + _d(line.credit_amount)
            # 借方科目（现金/银行）期末不应出现贷方余额
            if account.balance_direction == "debit" and end_credit > end_debit:
                raise ValidationError(
                    f"赤字控制：科目 {account.account_code} 记账后将出现赤字余额"
                )
            if account.balance_direction == "credit" and end_debit > end_credit:
                raise ValidationError(
                    f"赤字控制：科目 {account.account_code} 记账后将出现赤字余额"
                )

    async def create_manual_voucher(
        self,
        tenant_id: int,
        created_by: int,
        data: Dict[str, Any],
        *,
        allow_controlled: Optional[bool] = None,
    ) -> Voucher:
        settings = await self.settings_service.get_or_create(tenant_id)
        voucher_date = data.get("voucher_date") or to_site_date(resolve_business_datetime())
        if isinstance(voucher_date, str):
            voucher_date = date.fromisoformat(voucher_date[:10])
        controlled_ok = (
            bool(settings.allow_gl_entry_on_controlled)
            if allow_controlled is None
            else allow_controlled
        )
        lines = await self._validate_lines(
            tenant_id,
            data.get("lines") or [],
            allow_controlled=controlled_ok,
        )
        word = str(data.get("voucher_word") or "记")
        if not getattr(settings, "enable_voucher_words", True):
            word = "记"
        elif word not in {"记", "收", "付", "转"}:
            raise ValidationError("凭证字仅支持：记/收/付/转")
        code = data.get("voucher_code") or await self._next_voucher_code(tenant_id, word, voucher_date)
        async with in_transaction():
            voucher = await Voucher.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                voucher_word=word,
                voucher_code=code,
                voucher_date=voucher_date,
                period_year=int(data.get("period_year") or voucher_date.year),
                period_month=int(data.get("period_month") or voucher_date.month),
                status="draft",
                summary=data.get("summary") or (lines[0].get("summary") if lines else None),
                attachment_count=int(data.get("attachment_count") or 0),
                source_event_id=data.get("source_event_id"),
                source_doc_type=data.get("source_doc_type"),
                source_doc_id=data.get("source_doc_id"),
                total_debit=sum(l["debit_amount"] for l in lines),
                total_credit=sum(l["credit_amount"] for l in lines),
                created_by=created_by,
            )
            for line in lines:
                await VoucherLine.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    voucher_id=voucher.id,
                    **line,
                )
        return voucher

    async def update_draft_voucher(
        self,
        tenant_id: int,
        voucher_id: int,
        data: Dict[str, Any],
    ) -> Voucher:
        voucher = await Voucher.get_or_none(
            tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True
        )
        if not voucher:
            raise NotFoundError("凭证不存在")
        if voucher.status != "draft":
            raise ValidationError("仅草稿凭证可修改")
        settings = await self.settings_service.get_or_create(tenant_id)
        lines = await self._validate_lines(
            tenant_id,
            data.get("lines") or [],
            allow_controlled=bool(settings.allow_gl_entry_on_controlled),
        )
        if data.get("voucher_date"):
            vd = data["voucher_date"]
            voucher.voucher_date = date.fromisoformat(str(vd)[:10]) if isinstance(vd, str) else vd
            voucher.period_year = voucher.voucher_date.year
            voucher.period_month = voucher.voucher_date.month
        if "summary" in data:
            voucher.summary = data.get("summary")
        if "attachment_count" in data:
            voucher.attachment_count = int(data.get("attachment_count") or 0)
        if "voucher_word" in data:
            voucher.voucher_word = str(data.get("voucher_word") or "记")
        voucher.total_debit = sum(l["debit_amount"] for l in lines)
        voucher.total_credit = sum(l["credit_amount"] for l in lines)
        async with in_transaction():
            await voucher.save()
            await VoucherLine.filter(tenant_id=tenant_id, voucher_id=voucher.id).delete()
            for line in lines:
                await VoucherLine.create(
                    tenant_id=tenant_id,
                    uuid=str(uuid.uuid4()),
                    voucher_id=voucher.id,
                    **line,
                )
        return voucher

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
        ).exclude(status="cancelled").first()
        if existing:
            return existing

        draft_lines = await self.template_service.build_draft_lines_from_event(tenant_id, event)
        if not draft_lines:
            raise ValidationError(f"事件 {event.event_code} 无法生成凭证分录（请维护科目表与模板）")

        voucher_date = event.event_date or to_site_date(resolve_business_datetime())
        return await self.create_manual_voucher(
            tenant_id,
            created_by,
            {
                "voucher_date": voucher_date,
                "summary": event.notes or event.event_type,
                "source_event_id": event.id,
                "source_doc_type": event.source_doc_type,
                "source_doc_id": event.source_doc_id,
                "lines": draft_lines,
            },
            allow_controlled=True,
        )

    async def review_voucher(self, tenant_id: int, voucher_id: int, reviewer_id: int) -> Voucher:
        voucher = await self._get(tenant_id, voucher_id)
        if voucher.status != "draft":
            raise ValidationError("仅草稿凭证可审核")
        settings = await self.settings_service.get_or_create(tenant_id)
        if settings.require_reviewer_different and voucher.created_by == reviewer_id:
            raise ValidationError("制单人与审核人不能为同一人")
        voucher.status = "reviewed"
        voucher.reviewed_at = resolve_business_datetime()
        voucher.reviewed_by = reviewer_id
        await voucher.save()
        return voucher

    async def unreview_voucher(self, tenant_id: int, voucher_id: int) -> Voucher:
        voucher = await self._get(tenant_id, voucher_id)
        if voucher.status != "reviewed":
            raise ValidationError("仅已审核凭证可取消审核")
        voucher.status = "draft"
        voucher.reviewed_at = None
        voucher.reviewed_by = None
        await voucher.save()
        return voucher

    async def post_voucher(self, tenant_id: int, voucher_id: int, posted_by: int) -> Voucher:
        voucher = await self._get(tenant_id, voucher_id)
        if voucher.status != "reviewed":
            raise ValidationError("仅已审核凭证可记账")
        await self.period_service.assert_period_open_for_posting(
            tenant_id, voucher.period_year, voucher.period_month
        )
        lines = await VoucherLine.filter(tenant_id=tenant_id, voucher_id=voucher.id).all()
        await self._assert_deficit_control(tenant_id, voucher, lines)
        async with in_transaction():
            await self.balance_service.apply_voucher_lines(tenant_id, voucher, lines, sign=1)
            voucher.status = "posted"
            voucher.posted_at = resolve_business_datetime()
            voucher.posted_by = posted_by
            await voucher.save()
        return voucher

    async def unpost_voucher(self, tenant_id: int, voucher_id: int) -> Voucher:
        voucher = await self._get(tenant_id, voucher_id)
        if voucher.status != "posted":
            raise ValidationError("仅已记账凭证可反记账")
        await self.period_service.assert_period_open_for_posting(
            tenant_id, voucher.period_year, voucher.period_month
        )
        lines = await VoucherLine.filter(tenant_id=tenant_id, voucher_id=voucher.id).all()
        async with in_transaction():
            await self.balance_service.apply_voucher_lines(tenant_id, voucher, lines, sign=-1)
            voucher.status = "reviewed"
            voucher.posted_at = None
            voucher.posted_by = None
            await voucher.save()
        return voucher

    async def cancel_voucher(self, tenant_id: int, voucher_id: int) -> Voucher:
        voucher = await self._get(tenant_id, voucher_id)
        if voucher.status not in ("draft", "reviewed"):
            raise ValidationError("已记账凭证须先反记账再作废")
        voucher.status = "cancelled"
        await voucher.save()
        return voucher

    async def list_vouchers(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        period_year: Optional[int] = None,
        period_month: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> List[Voucher]:
        q = Voucher.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if status:
            q = q.filter(status=status)
        if period_year:
            q = q.filter(period_year=period_year)
        if period_month:
            q = q.filter(period_month=period_month)
        if keyword:
            q = q.filter(voucher_code__icontains=keyword)
        return await q.offset(skip).limit(limit).order_by("-voucher_date", "-id")

    @staticmethod
    def _account_side_labels(lines: List[VoucherLine], *, side: str) -> str:
        labels: List[str] = []
        for line in lines:
            amount = line.debit_amount if side == "debit" else line.credit_amount
            if _d(amount) <= 0:
                continue
            code = str(line.account_code or "").strip()
            name = str(line.account_name or "").strip()
            label = f"{code} {name}".strip() if code or name else ""
            if label:
                labels.append(label)
        return "、".join(labels)

    async def vouchers_to_list_dicts(
        self, tenant_id: int, vouchers: List[Voucher]
    ) -> List[Dict[str, Any]]:
        if not vouchers:
            return []
        voucher_ids = [v.id for v in vouchers]
        lines = await VoucherLine.filter(
            tenant_id=tenant_id, voucher_id__in=voucher_ids
        ).order_by("voucher_id", "line_no")
        lines_by_voucher: Dict[int, List[VoucherLine]] = defaultdict(list)
        for line in lines:
            lines_by_voucher[line.voucher_id].append(line)
        result: List[Dict[str, Any]] = []
        for voucher in vouchers:
            payload = self.voucher_to_dict(voucher)
            voucher_lines = lines_by_voucher.get(voucher.id, [])
            payload["debit_accounts"] = self._account_side_labels(voucher_lines, side="debit")
            payload["credit_accounts"] = self._account_side_labels(voucher_lines, side="credit")
            result.append(payload)
        return result

    async def get_voucher_detail(self, tenant_id: int, voucher_id: int) -> Dict[str, Any]:
        voucher = await self._get(tenant_id, voucher_id)
        lines = await VoucherLine.filter(tenant_id=tenant_id, voucher_id=voucher.id).order_by("line_no")
        return {
            **self.voucher_to_dict(voucher),
            "lines": [self.line_to_dict(l) for l in await lines],
        }

    async def _get(self, tenant_id: int, voucher_id: int) -> Voucher:
        voucher = await Voucher.get_or_none(
            tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True
        )
        if not voucher:
            raise NotFoundError(f"凭证不存在: {voucher_id}")
        return voucher

    def voucher_to_dict(self, voucher: Voucher) -> Dict[str, Any]:
        return {
            "id": voucher.id,
            "tenant_id": voucher.tenant_id,
            "voucher_word": voucher.voucher_word,
            "voucher_code": voucher.voucher_code,
            "voucher_date": voucher.voucher_date.isoformat() if voucher.voucher_date else None,
            "period_year": voucher.period_year,
            "period_month": voucher.period_month,
            "status": voucher.status,
            "summary": voucher.summary,
            "attachment_count": voucher.attachment_count,
            "source_event_id": voucher.source_event_id,
            "source_doc_type": voucher.source_doc_type,
            "source_doc_id": voucher.source_doc_id,
            "total_debit": float(voucher.total_debit or 0),
            "total_credit": float(voucher.total_credit or 0),
            "created_by": voucher.created_by,
            "reviewed_by": voucher.reviewed_by,
            "posted_by": voucher.posted_by,
            "posted_at": voucher.posted_at.isoformat() if voucher.posted_at else None,
            "reviewed_at": voucher.reviewed_at.isoformat() if voucher.reviewed_at else None,
        }

    def line_to_dict(self, line: VoucherLine) -> Dict[str, Any]:
        return {
            "id": line.id,
            "line_no": line.line_no,
            "account_id": line.account_id,
            "account_code": line.account_code,
            "account_name": line.account_name,
            "summary": line.summary,
            "debit_amount": float(line.debit_amount or 0),
            "credit_amount": float(line.credit_amount or 0),
            "customer_id": line.customer_id,
            "customer_name": line.customer_name,
            "supplier_id": line.supplier_id,
            "supplier_name": line.supplier_name,
            "department_id": line.department_id,
            "department_name": line.department_name,
            "employee_id": line.employee_id,
            "employee_name": line.employee_name,
            "project_id": line.project_id,
            "project_name": line.project_name,
            "cash_flow_item_id": line.cash_flow_item_id,
        }
