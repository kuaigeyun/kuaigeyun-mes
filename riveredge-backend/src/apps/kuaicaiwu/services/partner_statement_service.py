"""
往来对账单业务服务
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font
from tortoise.expressions import Q
from tortoise import timezone as tortoise_timezone

from apps.common.base_service import AppBaseService
from apps.kuaicaiwu.models.partner_statement import PartnerStatement
from apps.kuaicaiwu.models.payable import Payable
from apps.kuaicaiwu.models.payment import Payment
from apps.kuaicaiwu.models.receivable import Receivable
from apps.kuaicaiwu.models.receipt import Receipt
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.tenant import Tenant

_APPROVED_REVIEW = ("已审核", "通过")
_EXCLUDED_REVIEW = ("待审核", "驳回")
_MONEY = Decimal("0.01")


def _q_money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY)


def period_to_date_range(period: str) -> Tuple[date, date]:
    """YYYY-MM -> (月初, 月末)"""
    try:
        year_s, month_s = period.split("-", 1)
        year, month = int(year_s), int(month_s)
    except (ValueError, AttributeError) as e:
        raise ValidationError("对账周期格式应为 YYYY-MM") from e
    if month < 1 or month > 12:
        raise ValidationError("对账周期月份无效")
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])
    return start, end


class PartnerStatementService(AppBaseService[PartnerStatement]):
    """往来对账单服务"""

    async def _get_tenant_company_name(self, tenant_id: int) -> str:
        tenant = await Tenant.get_or_none(id=tenant_id)
        return (tenant.name if tenant else "") or "本公司"

    async def _load_partner_snapshot(
        self, tenant_id: int, partner_id: int, partner_type: str
    ) -> Dict[str, Any]:
        if partner_type == "Customer":
            obj = await Customer.get_or_none(tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True)
            if not obj:
                raise NotFoundError(f"客户不存在: {partner_id}")
            return {
                "id": obj.id,
                "name": obj.name or str(partner_id),
                "finance_contact_name": getattr(obj, "finance_contact_name", None),
                "finance_contact_phone": getattr(obj, "finance_contact_phone", None),
                "finance_contact_email": getattr(obj, "finance_contact_email", None),
            }
        if partner_type == "Supplier":
            obj = await Supplier.get_or_none(tenant_id=tenant_id, id=partner_id, deleted_at__isnull=True)
            if not obj:
                raise NotFoundError(f"供应商不存在: {partner_id}")
            return {
                "id": obj.id,
                "name": obj.name or str(partner_id),
                "finance_contact_name": getattr(obj, "finance_contact_name", None),
                "finance_contact_phone": getattr(obj, "finance_contact_phone", None),
                "finance_contact_email": getattr(obj, "finance_contact_email", None),
            }
        raise ValidationError("partner_type 必须为 Customer 或 Supplier")

    def _approved_doc_filter(self) -> Q:
        return Q(review_status__in=_APPROVED_REVIEW) | Q(review_status__isnull=True)

    async def _sum_debits_before(
        self, tenant_id: int, partner_id: int, partner_type: str, before_date: date
    ) -> Decimal:
        if partner_type == "Customer":
            rows = await Receivable.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                business_date__lt=before_date,
                deleted_at__isnull=True,
            ).exclude(review_status__in=_EXCLUDED_REVIEW).all()
        else:
            rows = await Payable.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                business_date__lt=before_date,
                deleted_at__isnull=True,
            ).exclude(review_status__in=_EXCLUDED_REVIEW).all()
        return _q_money(sum((r.total_amount for r in rows), Decimal("0")))

    async def _sum_credits_before(
        self, tenant_id: int, partner_id: int, partner_type: str, before_date: date
    ) -> Decimal:
        if partner_type == "Customer":
            rows = await Receipt.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                receipt_date__lt=before_date,
                status="Confirmed",
                deleted_at__isnull=True,
            ).all()
        else:
            rows = await Payment.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                payment_date__lt=before_date,
                status="Confirmed",
                deleted_at__isnull=True,
            ).all()
        return _q_money(sum((r.total_amount for r in rows), Decimal("0")))

    async def _calc_opening_balance(
        self, tenant_id: int, partner_id: int, partner_type: str, start_date: date
    ) -> Decimal:
        debits = await self._sum_debits_before(tenant_id, partner_id, partner_type, start_date)
        credits = await self._sum_credits_before(tenant_id, partner_id, partner_type, start_date)
        return _q_money(debits - credits)

    async def _collect_period_raw_lines(
        self,
        tenant_id: int,
        partner_id: int,
        partner_type: str,
        start_date: date,
        end_date: date,
    ) -> List[Dict[str, Any]]:
        lines: List[Dict[str, Any]] = []
        if partner_type == "Customer":
            receivables = await Receivable.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                business_date__gte=start_date,
                business_date__lte=end_date,
                deleted_at__isnull=True,
            ).exclude(review_status__in=_EXCLUDED_REVIEW).order_by("business_date", "id").all()
            receipts = await Receipt.filter(
                tenant_id=tenant_id,
                customer_id=partner_id,
                receipt_date__gte=start_date,
                receipt_date__lte=end_date,
                status="Confirmed",
                deleted_at__isnull=True,
            ).order_by("receipt_date", "id").all()
            for r in receivables:
                lines.append({
                    "date": to_api_isoformat(r.business_date),
                    "sort_date": r.business_date,
                    "doc_type": "应收单",
                    "doc_code": r.receivable_code,
                    "summary": r.notes or f"应收 {r.source_code or ''}".strip(),
                    "debit": float(_q_money(r.total_amount)),
                    "credit": 0.0,
                    "doc_id": r.id,
                })
            for r in receipts:
                lines.append({
                    "date": to_api_isoformat(r.receipt_date),
                    "sort_date": r.receipt_date,
                    "doc_type": "收款单",
                    "doc_code": r.receipt_code,
                    "summary": r.notes or "收款",
                    "debit": 0.0,
                    "credit": float(_q_money(r.total_amount)),
                    "doc_id": r.id,
                })
        else:
            payables = await Payable.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                business_date__gte=start_date,
                business_date__lte=end_date,
                deleted_at__isnull=True,
            ).exclude(review_status__in=_EXCLUDED_REVIEW).order_by("business_date", "id").all()
            payments = await Payment.filter(
                tenant_id=tenant_id,
                supplier_id=partner_id,
                payment_date__gte=start_date,
                payment_date__lte=end_date,
                status="Confirmed",
                deleted_at__isnull=True,
            ).order_by("payment_date", "id").all()
            for p in payables:
                lines.append({
                    "date": to_api_isoformat(p.business_date),
                    "sort_date": p.business_date,
                    "doc_type": "应付单",
                    "doc_code": p.payable_code,
                    "summary": p.notes or f"应付 {p.source_code or ''}".strip(),
                    "debit": float(_q_money(p.total_amount)),
                    "credit": 0.0,
                    "doc_id": p.id,
                })
            for p in payments:
                lines.append({
                    "date": to_api_isoformat(p.payment_date),
                    "sort_date": p.payment_date,
                    "doc_type": "付款单",
                    "doc_code": p.payment_code,
                    "summary": p.notes or "付款",
                    "debit": 0.0,
                    "credit": float(_q_money(p.total_amount)),
                    "doc_id": p.id,
                })
        lines.sort(key=lambda x: (x["sort_date"], x["doc_type"], x.get("doc_id", 0)))
        for ln in lines:
            ln.pop("sort_date", None)
        return lines

    def _apply_running_balance(
        self, opening_balance: Decimal, lines: List[Dict[str, Any]]
    ) -> Tuple[Decimal, Decimal, Decimal, List[Dict[str, Any]]]:
        balance = opening_balance
        debit_total = Decimal("0")
        credit_total = Decimal("0")
        result: List[Dict[str, Any]] = []
        for ln in lines:
            debit = _q_money(ln.get("debit", 0))
            credit = _q_money(ln.get("credit", 0))
            debit_total += debit
            credit_total += credit
            balance = _q_money(balance + debit - credit)
            row = dict(ln)
            row["balance"] = float(balance)
            result.append(row)
        return _q_money(debit_total), _q_money(credit_total), balance, result

    async def preview_statement(
        self,
        tenant_id: int,
        partner_id: int,
        partner_type: str,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        if end_date < start_date:
            raise ValidationError("结束日期不能早于开始日期")
        partner = await self._load_partner_snapshot(tenant_id, partner_id, partner_type)
        opening = await self._calc_opening_balance(tenant_id, partner_id, partner_type, start_date)
        raw_lines = await self._collect_period_raw_lines(
            tenant_id, partner_id, partner_type, start_date, end_date
        )
        debit_total, credit_total, closing, lines = self._apply_running_balance(opening, raw_lines)
        company_name = await self._get_tenant_company_name(tenant_id)
        balance_label = "应收余额" if partner_type == "Customer" else "应付余额"
        return {
            "partner_id": partner_id,
            "partner_name": partner["name"],
            "partner_type": partner_type,
            "start_date": to_api_isoformat(start_date),
            "end_date": to_api_isoformat(end_date),
            "company_name": company_name,
            "balance_label": balance_label,
            "summary": {
                "opening_balance": float(opening),
                "debit_total": float(debit_total),
                "credit_total": float(credit_total),
                "closing_balance": float(closing),
            },
            "lines": lines,
            "partner_snapshot": partner,
        }

    async def _generate_statement_code(self, tenant_id: int) -> str:
        today = datetime.now().strftime("%Y%m%d")
        return await self.generate_code(tenant_id, "PARTNER_STATEMENT_CODE", prefix=f"DZ{today}")

    async def create_statement(
        self,
        tenant_id: int,
        partner_id: int,
        partner_type: str,
        period: str,
        created_by: int,
        notes: Optional[str] = None,
        attachments: Optional[list] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> PartnerStatement:
        if start_date and end_date:
            period_label = f"{to_api_isoformat(start_date)}~{to_api_isoformat(end_date)}"
            stmt_period = period or start_date.strftime("%Y-%m")
        else:
            start_date, end_date = period_to_date_range(period)
            period_label = period
            stmt_period = period

        exists = await PartnerStatement.get_or_none(
            tenant_id=tenant_id,
            partner_id=partner_id,
            partner_type=partner_type,
            statement_period=stmt_period,
            deleted_at__isnull=True,
        )
        if exists:
            raise BusinessLogicError(
                f"该往来单位在 {stmt_period} 已存在对账单 {exists.statement_code}，请勿重复生成"
            )

        preview = await self.preview_statement(
            tenant_id, partner_id, partner_type, start_date, end_date
        )
        code = await self._generate_statement_code(tenant_id)
        company_name = preview["company_name"]
        summary = preview["summary"]
        details = {
            "summary": summary,
            "lines": preview["lines"],
            "partner_snapshot": preview["partner_snapshot"],
            "balance_label": preview["balance_label"],
            "period_label": period_label,
        }

        return await PartnerStatement.create(
            tenant_id=tenant_id,
            statement_code=code,
            partner_id=partner_id,
            partner_name=preview["partner_name"],
            partner_type=partner_type,
            statement_period=stmt_period,
            start_date=start_date,
            end_date=end_date,
            opening_balance=_q_money(summary["opening_balance"]),
            debit_total=_q_money(summary["debit_total"]),
            credit_total=_q_money(summary["credit_total"]),
            closing_balance=_q_money(summary["closing_balance"]),
            status="Draft",
            transaction_details=details,
            company_name=company_name,
            notes=notes,
            attachments=attachments,
            created_by=created_by,
        )

    async def list_statements(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        partner_type: Optional[str] = None,
        partner_id: Optional[int] = None,
        statement_period: Optional[str] = None,
        status: Optional[str] = None,
    ) -> Tuple[List[PartnerStatement], int]:
        query = PartnerStatement.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if partner_type:
            query = query.filter(partner_type=partner_type)
        if partner_id:
            query = query.filter(partner_id=partner_id)
        if statement_period:
            query = query.filter(statement_period=statement_period)
        if status:
            query = query.filter(status=status)
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-created_at", "-id")
        return items, total

    async def get_statement(self, tenant_id: int, statement_id: int) -> PartnerStatement:
        obj = await PartnerStatement.get_or_none(
            tenant_id=tenant_id, id=statement_id, deleted_at__isnull=True
        )
        if not obj:
            raise NotFoundError(f"对账单不存在: {statement_id}")
        return obj

    async def confirm_statement(
        self, tenant_id: int, statement_id: int, user_id: int
    ) -> PartnerStatement:
        obj = await self.get_statement(tenant_id, statement_id)
        if obj.status not in ("Draft", "Disputed"):
            raise BusinessLogicError("仅草稿或异议状态的对账单可确认")
        obj.status = "Confirmed"
        obj.confirmed_at = tortoise_timezone.now()
        obj.confirmed_by = user_id
        await obj.save()
        return obj

    async def mark_sent(
        self,
        tenant_id: int,
        statement_id: int,
        user_id: int,
        channel: str,
        notes: Optional[str] = None,
    ) -> PartnerStatement:
        obj = await self.get_statement(tenant_id, statement_id)
        if obj.status != "Confirmed":
            raise BusinessLogicError("请先内部确认对账单后再标记发送")
        allowed = ("export", "print", "wechat_manual", "email_manual", "other")
        if channel not in allowed:
            raise ValidationError(f"发送渠道无效，可选: {', '.join(allowed)}")
        obj.status = "Sent"
        obj.sent_at = tortoise_timezone.now()
        obj.sent_by = user_id
        obj.sent_channel = channel
        if notes:
            obj.notes = (obj.notes or "") + ("\n" if obj.notes else "") + notes
        await obj.save()
        return obj

    async def dispute_statement(
        self, tenant_id: int, statement_id: int, reason: str
    ) -> PartnerStatement:
        obj = await self.get_statement(tenant_id, statement_id)
        if obj.status not in ("Sent", "Confirmed"):
            raise BusinessLogicError("仅已确认或已发送的对账单可记录异议")
        obj.status = "Disputed"
        obj.dispute_reason = reason.strip()
        obj.disputed_at = tortoise_timezone.now()
        await obj.save()
        return obj

    async def delete_statement(self, tenant_id: int, statement_id: int) -> None:
        obj = await self.get_statement(tenant_id, statement_id)
        if obj.status != "Draft":
            raise BusinessLogicError("仅草稿状态的对账单可删除")
        obj.deleted_at = tortoise_timezone.now()
        await obj.save()

    def _statement_export_context(self, obj: PartnerStatement) -> Dict[str, Any]:
        details = obj.transaction_details or {}
        return {
            "statement_code": obj.statement_code,
            "company_name": obj.company_name or "本公司",
            "partner_name": obj.partner_name,
            "partner_type": obj.partner_type,
            "period": obj.statement_period,
            "start_date": to_api_isoformat(obj.start_date),
            "end_date": to_api_isoformat(obj.end_date),
            "status": obj.status,
            "balance_label": details.get("balance_label") or (
                "应收余额" if obj.partner_type == "Customer" else "应付余额"
            ),
            "summary": details.get("summary") or {
                "opening_balance": float(obj.opening_balance),
                "debit_total": float(obj.debit_total),
                "credit_total": float(obj.credit_total),
                "closing_balance": float(obj.closing_balance),
            },
            "lines": details.get("lines") or [],
            "partner_snapshot": details.get("partner_snapshot") or {},
            "notes": obj.notes,
        }

    def export_excel(self, obj: PartnerStatement) -> BytesIO:
        ctx = self._statement_export_context(obj)
        wb = Workbook()
        ws = wb.active
        ws.title = "往来对账单"
        title_font = Font(name="Microsoft YaHei", size=14, bold=True)
        header_font = Font(name="Microsoft YaHei", size=11, bold=True)
        body_font = Font(name="Microsoft YaHei", size=11)

        ws["A1"] = f"{ctx['company_name']} — 往来对账单"
        ws["A1"].font = title_font
        ws.merge_cells("A1:G1")
        ws["A2"] = f"对账单号：{ctx['statement_code']}"
        ws["A3"] = f"往来单位：{ctx['partner_name']}"
        ws["A4"] = f"对账期间：{ctx['start_date']} 至 {ctx['end_date']}"
        snap = ctx.get("partner_snapshot") or {}
        if snap.get("finance_contact_name"):
            ws["A5"] = f"财务联系人：{snap.get('finance_contact_name')} {snap.get('finance_contact_phone') or ''}"

        row = 7
        summary = ctx["summary"]
        ws.cell(row, 1, "期初余额").font = header_font
        ws.cell(row, 2, summary["opening_balance"])
        ws.cell(row, 3, "本期借方").font = header_font
        ws.cell(row, 4, summary["debit_total"])
        ws.cell(row, 5, "本期贷方").font = header_font
        ws.cell(row, 6, summary["credit_total"])
        ws.cell(row, 7, "期末余额").font = header_font
        row += 1
        ws.cell(row, 1, summary["opening_balance"])
        ws.cell(row, 3, summary["debit_total"])
        ws.cell(row, 5, summary["credit_total"])
        ws.cell(row, 7, summary["closing_balance"])

        row += 2
        headers = ["日期", "单据类型", "单号", "摘要", "借方", "贷方", ctx["balance_label"]]
        for col, h in enumerate(headers, 1):
            c = ws.cell(row, col, h)
            c.font = header_font
            c.alignment = Alignment(horizontal="center")
        row += 1
        for ln in ctx["lines"]:
            ws.cell(row, 1, ln.get("date", "")).font = body_font
            ws.cell(row, 2, ln.get("doc_type", "")).font = body_font
            ws.cell(row, 3, ln.get("doc_code", "")).font = body_font
            ws.cell(row, 4, ln.get("summary", "")).font = body_font
            ws.cell(row, 5, ln.get("debit", 0)).font = body_font
            ws.cell(row, 6, ln.get("credit", 0)).font = body_font
            ws.cell(row, 7, ln.get("balance", 0)).font = body_font
            row += 1

        row += 1
        ws.cell(row, 1, "请于收到本对账单后 7 个工作日内核对并回复；如有异议请注明。").font = body_font

        out = BytesIO()
        wb.save(out)
        out.seek(0)
        return out

    def render_html(self, obj: PartnerStatement) -> str:
        ctx = self._statement_export_context(obj)
        summary = ctx["summary"]
        snap = ctx.get("partner_snapshot") or {}
        contact = ""
        if snap.get("finance_contact_name"):
            contact = f"<p>财务联系人：{snap['finance_contact_name']} {snap.get('finance_contact_phone') or ''}</p>"

        rows_html = ""
        for ln in ctx["lines"]:
            rows_html += f"""
            <tr>
              <td>{ln.get('date', '')}</td>
              <td>{ln.get('doc_type', '')}</td>
              <td>{ln.get('doc_code', '')}</td>
              <td>{ln.get('summary', '')}</td>
              <td class="num">{ln.get('debit', 0):,.2f}</td>
              <td class="num">{ln.get('credit', 0):,.2f}</td>
              <td class="num">{ln.get('balance', 0):,.2f}</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/>
<title>往来对账单 {ctx['statement_code']}</title>
<style>
  body {{ font-family: "Microsoft YaHei", sans-serif; font-size: 12px; color: #333; padding: 24px; }}
  h1 {{ font-size: 18px; text-align: center; margin-bottom: 8px; }}
  .meta p {{ margin: 4px 0; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; }}
  th {{ background: #f5f5f5; }}
  .num {{ text-align: right; }}
  .summary {{ margin-top: 12px; }}
  .footer {{ margin-top: 20px; color: #666; font-size: 11px; }}
  @media print {{ body {{ padding: 0; }} }}
</style></head><body>
<h1>{ctx['company_name']} — 往来对账单</h1>
<div class="meta">
  <p>对账单号：{ctx['statement_code']}</p>
  <p>往来单位：{ctx['partner_name']}</p>
  <p>对账期间：{ctx['start_date']} 至 {ctx['end_date']}</p>
  {contact}
</div>
<div class="summary">
  <p>期初余额：<strong>{summary['opening_balance']:,.2f}</strong>
     &nbsp;|&nbsp; 本期借方：<strong>{summary['debit_total']:,.2f}</strong>
     &nbsp;|&nbsp; 本期贷方：<strong>{summary['credit_total']:,.2f}</strong>
     &nbsp;|&nbsp; 期末余额：<strong>{summary['closing_balance']:,.2f}</strong></p>
</div>
<table>
  <thead><tr>
    <th>日期</th><th>单据类型</th><th>单号</th><th>摘要</th>
    <th>借方</th><th>贷方</th><th>{ctx['balance_label']}</th>
  </tr></thead>
  <tbody>{rows_html}</tbody>
</table>
<p class="footer">请于收到本对账单后 7 个工作日内核对并回复；如有异议请注明。</p>
</body></html>"""

    async def export_pdf(self, obj: PartnerStatement) -> Tuple[bytes, str]:
        html = self.render_html(obj)
        try:
            from apps.kuaizhizao.services.print_service import _html_to_pdf_bytes_playwright_async
            pdf_bytes = await _html_to_pdf_bytes_playwright_async(html)
            return pdf_bytes, "application/pdf"
        except Exception:
            return html.encode("utf-8"), "text/html; charset=utf-8"
