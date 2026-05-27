"""用户数据范围绑定维护与查询。"""

from __future__ import annotations

from typing import Iterable, List

from tortoise.transactions import in_transaction

from core.models.user_data_scope_binding import UserDataScopeBinding
from core.schemas.user_data_scope_binding import UserDataScopeBindingItem, UserDataScopeBindingReplace
from core.timezone_utils import now_utc
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class UserDataScopeBindingService:
    @staticmethod
    def _norm_dimension(dimension: str) -> str:
        d = (dimension or "").strip().lower()
        if not d:
            raise ValidationError("dimension 不能为空")
        return d

    @staticmethod
    def _norm_code(code: str) -> str:
        c = (code or "").strip()
        if not c:
            raise ValidationError("scope_code 不能为空")
        return c

    @classmethod
    async def list_scope_codes(cls, *, tenant_id: int, user_id: int, dimension: str) -> List[str]:
        dim = cls._norm_dimension(dimension)
        rows = await UserDataScopeBinding.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            dimension=dim,
            deleted_at__isnull=True,
        ).all()
        out: list[str] = []
        seen: set[str] = set()
        for row in rows:
            code = (row.scope_code or "").strip()
            if code and code not in seen:
                seen.add(code)
                out.append(code)
        return out

    @classmethod
    async def list_bindings(
        cls,
        *,
        tenant_id: int,
        user_id: int,
        dimension: str | None = None,
    ) -> list[UserDataScopeBindingItem]:
        qs = UserDataScopeBinding.filter(
            tenant_id=tenant_id,
            user_id=user_id,
            deleted_at__isnull=True,
        )
        if dimension:
            qs = qs.filter(dimension=cls._norm_dimension(dimension))
        rows = await qs.order_by("dimension", "scope_code").all()
        return [
            UserDataScopeBindingItem(
                dimension=row.dimension,
                scope_code=row.scope_code,
                scope_name=row.scope_name,
            )
            for row in rows
        ]

    @classmethod
    async def replace_bindings(
        cls,
        *,
        tenant_id: int,
        user_id: int,
        body: UserDataScopeBindingReplace,
    ) -> list[UserDataScopeBindingItem]:
        user = await User.filter(id=user_id, tenant_id=tenant_id, deleted_at__isnull=True).first()
        if not user:
            raise NotFoundError("用户不存在")

        dimension = cls._norm_dimension(body.dimension)
        desired: dict[str, str | None] = {}
        for item in body.items or []:
            code = cls._norm_code(item.scope_code)
            name = (item.scope_name or "").strip() or None
            desired[code] = name

        now = now_utc()
        async with in_transaction():
            existing = await UserDataScopeBinding.filter(
                tenant_id=tenant_id,
                user_id=user_id,
                dimension=dimension,
            ).all()
            by_code = {(r.scope_code or "").strip(): r for r in existing if (r.scope_code or "").strip()}

            for code, name in desired.items():
                row = by_code.get(code)
                if row:
                    row.scope_name = name
                    row.deleted_at = None
                    await row.save(update_fields=["scope_name", "deleted_at", "updated_at"])
                else:
                    await UserDataScopeBinding.create(
                        tenant_id=tenant_id,
                        user_id=user_id,
                        dimension=dimension,
                        scope_code=code,
                        scope_name=name,
                    )

            for code, row in by_code.items():
                if code not in desired:
                    row.deleted_at = now
                    await row.save(update_fields=["deleted_at", "updated_at"])

        return await cls.list_bindings(tenant_id=tenant_id, user_id=user_id, dimension=dimension)

    @classmethod
    async def assert_codes_allowed(
        cls,
        *,
        tenant_id: int,
        user_id: int,
        dimension: str,
        codes: Iterable[str],
    ) -> None:
        allowed = set(await cls.list_scope_codes(tenant_id=tenant_id, user_id=user_id, dimension=dimension))
        if not allowed:
            raise ValidationError("当前用户未绑定任何合作方数据范围，无法操作")
        for raw in codes:
            code = (raw or "").strip()
            if code and code not in allowed:
                raise ValidationError(f"无权操作合作方编码「{code}」")
