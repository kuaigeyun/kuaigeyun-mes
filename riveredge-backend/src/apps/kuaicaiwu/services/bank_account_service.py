"""
银行账户 CRUD 服务
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
import csv
import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from apps.kuaicaiwu.models.bank_account import BankAccount
from infra.exceptions.exceptions import NotFoundError, ValidationError


class BankAccountService:
    async def create(
        self,
        tenant_id: int,
        *,
        account_code: str,
        account_name: str,
        bank_name: str,
        account_number: str,
        currency: str = "CNY",
        opening_balance: Decimal = Decimal("0"),
        notes: Optional[str] = None,
    ) -> BankAccount:
        exists = await BankAccount.filter(
            tenant_id=tenant_id,
            account_code=account_code,
            deleted_at__isnull=True,
        ).exists()
        if exists:
            raise ValidationError(f"银行账户编码 {account_code} 已存在")

        ob = Decimal(str(opening_balance or 0))
        return await BankAccount.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            account_code=account_code,
            account_name=account_name,
            bank_name=bank_name,
            account_number=account_number,
            currency=currency,
            opening_balance=ob,
            current_balance=ob,
            notes=notes,
        )

    async def get_by_id(self, tenant_id: int, account_id: int) -> BankAccount:
        row = await BankAccount.get_or_none(
            tenant_id=tenant_id, id=account_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError(f"银行账户不存在: {account_id}")
        return row

    async def list_accounts(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        is_active: Optional[bool] = None,
    ) -> List[BankAccount]:
        q = BankAccount.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        return await q.offset(skip).limit(limit).order_by("account_code")

    async def update(
        self,
        tenant_id: int,
        account_id: int,
        **fields,
    ) -> BankAccount:
        row = await self.get_by_id(tenant_id, account_id)
        allowed = {
            "account_name", "bank_name", "account_number", "currency",
            "is_active", "notes", "current_balance",
        }
        for key, val in fields.items():
            if key in allowed and val is not None:
                setattr(row, key, val)
        await row.save()
        return row

    async def delete(self, tenant_id: int, account_id: int) -> None:
        row = await self.get_by_id(tenant_id, account_id)
        row.deleted_at = datetime.utcnow()
        row.is_active = False
        await row.save()

    async def record_transaction(
        self,
        tenant_id: int,
        *,
        bank_account_id: int,
        direction: str,
        amount: Decimal,
        transaction_date,
        source_doc_type: Optional[str] = None,
        source_doc_id: Optional[int] = None,
        source_doc_code: Optional[str] = None,
        summary: Optional[str] = None,
    ):
        """登记银行流水并更新账户余额。"""
        import uuid
        from apps.kuaicaiwu.models.bank_transaction import BankTransaction

        account = await self.get_by_id(tenant_id, bank_account_id)
        amt = Decimal(str(amount or 0))
        if amt <= 0:
            raise ValidationError("流水金额必须大于 0")
        if direction not in ("in", "out"):
            raise ValidationError("流水方向必须为 in 或 out")

        current = Decimal(str(account.current_balance or 0))
        balance_after = current + amt if direction == "in" else current - amt
        if balance_after < 0:
            raise ValidationError(f"账户 {account.account_code} 余额不足，当前 {current}，本次出款 {amt}")

        tx = await BankTransaction.create(
            tenant_id=tenant_id,
            uuid=str(uuid.uuid4()),
            bank_account_id=bank_account_id,
            transaction_date=transaction_date,
            direction=direction,
            amount=amt,
            balance_after=balance_after,
            source_doc_type=source_doc_type,
            source_doc_id=source_doc_id,
            source_doc_code=source_doc_code,
            summary=summary,
        )
        account.current_balance = balance_after
        await account.save(update_fields=["current_balance", "updated_at"])
        return tx

    async def list_transactions(
        self,
        tenant_id: int,
        *,
        bank_account_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 50,
    ):
        from apps.kuaicaiwu.models.bank_transaction import BankTransaction

        q = BankTransaction.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if bank_account_id is not None:
            q = q.filter(bank_account_id=bank_account_id)
        return await q.offset(skip).limit(limit).order_by("-transaction_date", "-id")

    async def sync_from_confirmed_voucher(
        self,
        tenant_id: int,
        *,
        voucher_type: str,
        voucher_id: int,
    ):
        """收付款单确认时写入银行流水（需指定 bank_account_id）。"""
        from apps.kuaicaiwu.models.receipt import Receipt
        from apps.kuaicaiwu.models.payment import Payment

        if voucher_type == "receipt":
            row = await Receipt.get_or_none(tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True)
            if not row or not row.bank_account_id:
                return None
            exists = await self._transaction_exists(tenant_id, "receipt", voucher_id)
            if exists:
                return None
            return await self.record_transaction(
                tenant_id,
                bank_account_id=int(row.bank_account_id),
                direction="in",
                amount=row.total_amount,
                transaction_date=row.receipt_date,
                source_doc_type="receipt",
                source_doc_id=row.id,
                source_doc_code=row.receipt_code,
                summary=row.notes,
            )

        row = await Payment.get_or_none(tenant_id=tenant_id, id=voucher_id, deleted_at__isnull=True)
        if not row or not row.bank_account_id:
            return None
        exists = await self._transaction_exists(tenant_id, "payment", voucher_id)
        if exists:
            return None
        return await self.record_transaction(
            tenant_id,
            bank_account_id=int(row.bank_account_id),
            direction="out",
            amount=row.total_amount,
            transaction_date=row.payment_date,
            source_doc_type="payment",
            source_doc_id=row.id,
            source_doc_code=row.payment_code,
            summary=row.notes,
        )

    async def _transaction_exists(self, tenant_id: int, source_doc_type: str, source_doc_id: int) -> bool:
        from apps.kuaicaiwu.models.bank_transaction import BankTransaction

        return await BankTransaction.filter(
            tenant_id=tenant_id,
            source_doc_type=source_doc_type,
            source_doc_id=source_doc_id,
            deleted_at__isnull=True,
        ).exists()

    @staticmethod
    def _parse_direction(raw: str) -> str:
        val = (raw or "").strip().lower()
        if val in ("in", "收入", "收", "credit", "cr", "+"):
            return "in"
        if val in ("out", "支出", "付", "debit", "dr", "-"):
            return "out"
        raise ValidationError(f"无法识别流水方向: {raw}")

    @staticmethod
    def _parse_date(raw: str):
        text = (raw or "").strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        raise ValidationError(f"无法解析日期: {raw}")

    def parse_statement_csv(self, content: str) -> List[Dict[str, Any]]:
        """
        解析银行对账单 CSV。
        表头：transaction_date,direction,amount,summary（方向 in/out 或 收入/支出）
        """
        reader = csv.DictReader(io.StringIO(content.strip()))
        if not reader.fieldnames:
            raise ValidationError("CSV 为空或缺少表头")

        field_map = {name.strip().lower(): name for name in reader.fieldnames if name}
        date_key = field_map.get("transaction_date") or field_map.get("date") or field_map.get("交易日期")
        dir_key = field_map.get("direction") or field_map.get("方向") or field_map.get("收支方向")
        amt_key = field_map.get("amount") or field_map.get("金额")
        sum_key = field_map.get("summary") or field_map.get("摘要") or field_map.get("备注")
        if not all([date_key, dir_key, amt_key]):
            raise ValidationError("CSV 需包含 transaction_date/date、direction/方向、amount/金额 列")

        rows: List[Dict[str, Any]] = []
        for line_no, row in enumerate(reader, start=2):
            if not any(str(v or "").strip() for v in row.values()):
                continue
            try:
                rows.append({
                    "transaction_date": self._parse_date(row[date_key]),
                    "direction": self._parse_direction(row[dir_key]),
                    "amount": Decimal(str(row[amt_key]).replace(",", "")),
                    "summary": (row.get(sum_key) if sum_key else None) or f"导入行 {line_no}",
                })
            except Exception as exc:
                raise ValidationError(f"第 {line_no} 行解析失败: {exc}") from exc
        if not rows:
            raise ValidationError("CSV 无有效数据行")
        return rows

    async def import_statement_csv(
        self,
        tenant_id: int,
        bank_account_id: int,
        csv_content: str,
    ) -> Dict[str, Any]:
        """手工导入银行对账单，写入流水并更新余额。"""
        await self.get_by_id(tenant_id, bank_account_id)
        parsed = self.parse_statement_csv(csv_content)
        created = 0
        for row in parsed:
            await self.record_transaction(
                tenant_id,
                bank_account_id=bank_account_id,
                direction=row["direction"],
                amount=row["amount"],
                transaction_date=row["transaction_date"],
                source_doc_type="manual_import",
                source_doc_id=None,
                source_doc_code=None,
                summary=row["summary"],
            )
            created += 1
        account = await self.get_by_id(tenant_id, bank_account_id)
        return {
            "imported_count": created,
            "current_balance": float(account.current_balance),
        }
