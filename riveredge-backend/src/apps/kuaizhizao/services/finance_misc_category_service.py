"""收支类别主数据服务"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaizhizao.models.finance_misc_category import (
    FinanceMiscExpenseCategory,
    FinanceMiscIncomeCategory,
)
from core.utils.timezone_utils import now_utc, resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

Kind = Literal["income", "expense"]

DEFAULT_MISC_INCOME_CATEGORIES: tuple[dict[str, Any], ...] = (
    {"code": "GOVT_SUBSIDY", "name": "政府补助", "sort_order": 10},
    {"code": "SCRAP_SALE", "name": "废品变卖", "sort_order": 20},
    {"code": "INTEREST", "name": "利息收入", "sort_order": 30},
    {"code": "RENT_INCOME", "name": "租赁收入", "sort_order": 40},
    {"code": "OTHER_INCOME", "name": "其他收入", "sort_order": 900},
)

DEFAULT_MISC_EXPENSE_CATEGORIES: tuple[dict[str, Any], ...] = (
    {"code": "OFFICE", "name": "办公费", "sort_order": 10},
    {"code": "TRAVEL", "name": "差旅费", "sort_order": 20},
    {"code": "ENTERTAIN", "name": "业务招待费", "sort_order": 30},
    {"code": "WELFARE", "name": "福利费", "sort_order": 40},
    {"code": "OTHER_EXPENSE", "name": "其他支出", "sort_order": 900},
)


class FinanceMiscCategoryService:
    def _model(self, kind: Kind):
        if kind == "income":
            return FinanceMiscIncomeCategory
        return FinanceMiscExpenseCategory

    def _default_catalog(self, kind: Kind) -> tuple[dict[str, Any], ...]:
        if kind == "income":
            return DEFAULT_MISC_INCOME_CATEGORIES
        return DEFAULT_MISC_EXPENSE_CATEGORIES

    async def ensure_default_categories(self, tenant_id: int, kind: Kind, user: User) -> int:
        """租户该方向尚无类别时写入产品预置项；已有数据则不改动。"""
        Model = self._model(kind)
        exists = await Model.filter(tenant_id=tenant_id, deleted_at__isnull=True).exists()
        if exists:
            return 0
        created = 0
        for item in self._default_catalog(kind):
            await self.create_category(tenant_id, kind, dict(item), user)
            created += 1
        return created

    async def _allocate_category_code(self, tenant_id: int, kind: Kind) -> str:
        Model = self._model(kind)
        prefix = "OI" if kind == "income" else "OE"
        rows = await Model.filter(tenant_id=tenant_id, deleted_at__isnull=True).values_list(
            "code", flat=True
        )
        max_seq = 0
        for raw in rows:
            code = str(raw or "")
            if not code.startswith(prefix):
                continue
            suffix = code[len(prefix) :]
            if suffix.isdigit():
                max_seq = max(max_seq, int(suffix))
        return f"{prefix}{max_seq + 1:04d}"

    async def list_categories(
        self,
        tenant_id: int,
        kind: Kind,
        *,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
        ensure_defaults: bool = False,
        user: Optional[User] = None,
    ) -> List[Dict[str, Any]]:
        if ensure_defaults and user is not None:
            await self.ensure_default_categories(tenant_id, kind, user)
        Model = self._model(kind)
        q = Model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            q = q.filter(is_active=is_active)
        kw = (keyword or "").strip()
        if kw:
            q = q.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        rows = await q.order_by("sort_order", "code")
        return [
            {
                "id": r.id,
                "code": r.code,
                "name": r.name,
                "is_active": r.is_active,
                "default_gl_account_code": r.default_gl_account_code,
                "sort_order": r.sort_order,
            }
            for r in rows
        ]

    async def get_active_by_code(self, tenant_id: int, kind: Kind, code: str):
        Model = self._model(kind)
        row = await Model.get_or_none(
            tenant_id=tenant_id,
            code=code.strip(),
            deleted_at__isnull=True,
            is_active=True,
        )
        if not row:
            raise ValidationError(f"类别 {code} 不存在或已停用")
        return row

    async def create_category(
        self, tenant_id: int, kind: Kind, payload: Dict[str, Any], user: User
    ) -> Dict[str, Any]:
        Model = self._model(kind)
        name = str(payload.get("name") or "").strip()
        if not name:
            raise ValidationError("名称必填")
        code = str(payload.get("code") or "").strip()
        if not code:
            code = await self._allocate_category_code(tenant_id, kind)
        exists = await Model.filter(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"类别编码 {code} 已存在")
        row = Model(
            tenant_id=tenant_id,
            code=code,
            name=name,
            is_active=bool(payload.get("is_active", True)),
            default_gl_account_code=(payload.get("default_gl_account_code") or None),
            sort_order=int(payload.get("sort_order") or 0),
        )
        apply_create_audit(row, user)
        await row.save()
        return {"id": row.id, "code": row.code, "name": row.name}

    async def update_category(
        self,
        tenant_id: int,
        kind: Kind,
        category_id: int,
        payload: Dict[str, Any],
        user: User,
    ) -> Dict[str, Any]:
        Model = self._model(kind)
        row = await Model.get_or_none(
            tenant_id=tenant_id, id=category_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("类别不存在")
        if "name" in payload and payload["name"] is not None:
            row.name = str(payload["name"]).strip()
        if "is_active" in payload and payload["is_active"] is not None:
            row.is_active = bool(payload["is_active"])
        if "default_gl_account_code" in payload:
            row.default_gl_account_code = payload.get("default_gl_account_code") or None
        if "sort_order" in payload and payload["sort_order"] is not None:
            row.sort_order = int(payload["sort_order"])
        apply_update_audit(row, user)
        await row.save()
        return {"id": row.id, "code": row.code, "name": row.name}

    async def delete_category(
        self, tenant_id: int, kind: Kind, category_id: int, user: User
    ) -> None:
        Model = self._model(kind)
        row = await Model.get_or_none(
            tenant_id=tenant_id, id=category_id, deleted_at__isnull=True
        )
        if not row:
            raise NotFoundError("类别不存在")
        row.deleted_at = resolve_business_datetime()
        apply_update_audit(row, user)
        await row.save()
