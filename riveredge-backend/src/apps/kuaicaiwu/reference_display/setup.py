"""快财务引用展示 Provider 注册（表单下拉投影，不含余额等敏感字段）。"""

from __future__ import annotations

from typing import Any

from apps.kuaicaiwu.models.bank_account import BankAccount
from apps.kuaicaiwu.services.bank_account_service import BankAccountService
from core.services.reference.reference_display_provider_registry import register_reference_display_provider
from tortoise.expressions import Q

_registered = False
_service = BankAccountService()


def _row(*, account: BankAccount) -> dict[str, Any]:
    code = (account.account_code or "").strip()
    name = (account.account_name or "").strip()
    label_parts = [p for p in [code, name] if p]
    label = " - ".join(label_parts) if label_parts else str(account.id)
    account_type = str(account.account_type or "bank").strip().lower() or "bank"
    if account_type == "cash" or not (account.account_number or "").strip():
        display_label = name or label
    else:
        display_label = f"{name} ({account.account_number})" if name else str(account.account_number)
    return {
        "id": account.id,
        "code": code or None,
        "name": name or None,
        "label": display_label,
        "account_code": code or None,
        "account_name": name or None,
        "account_type": account_type,
        "bank_name": account.bank_name,
        "account_number": account.account_number,
        "currency": account.currency,
    }


class _BankAccountDisplayProvider:
    resource_key = "kuaicaiwu:bank-account"

    async def search(
        self,
        *,
        tenant_id: int,
        user: Any,
        page: int,
        page_size: int,
        keyword: str | None,
        is_active: bool | None,
        extra: dict[str, Any] | None,
    ) -> dict[str, Any]:
        skip = (page - 1) * page_size
        rows, total = await _service.list_accounts(
            tenant_id,
            skip=skip,
            limit=page_size,
            is_active=is_active,
            keyword=keyword,
        )
        return {
            "items": [_row(account=r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def resolve(
        self,
        *,
        tenant_id: int,
        user: Any,
        record_ids: list[int] | None,
        record_uuids: list[str] | None,
    ) -> list[dict[str, Any]]:
        ids = sorted({int(i) for i in (record_ids or []) if i is not None})
        if not ids:
            return []
        rows = await BankAccount.filter(
            Q(tenant_id=tenant_id, deleted_at__isnull=True, id__in=ids),
        ).all()
        by_id = {int(r.id): r for r in rows}
        return [_row(account=by_id[i]) for i in ids if i in by_id]


def register_kuaicaiwu_reference_display_providers() -> None:
    global _registered
    if _registered:
        return
    register_reference_display_provider(_BankAccountDisplayProvider())
    _registered = True
