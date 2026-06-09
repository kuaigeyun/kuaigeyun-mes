"""租户模型引用展示 Provider 工厂（主数据 / 单据等简单 code+name 表）。"""

from __future__ import annotations

from typing import Any, Callable

from tortoise.expressions import Q
from tortoise.models import Model

from core.services.authorization.data_scope_service import DataScopeService
from infra.models.user import User


def _row(
    *,
    record_id: int,
    uuid: str | None,
    code: str | None,
    name: str | None,
    **extra: Any,
) -> dict[str, Any]:
    label_parts = [p for p in [(code or "").strip(), (name or "").strip()] if p]
    label = " - ".join(label_parts) if label_parts else str(record_id)
    return {"id": record_id, "uuid": uuid, "code": code, "name": name, "label": label, **extra}


def make_tenant_model_display_provider(
    *,
    resource_key: str,
    model: type[Model],
    code_field: str = "code",
    name_field: str = "name",
    order_by: str | None = None,
    scope_resource: str | None = None,
    base_filter: Callable[[], Q] | None = None,
):
    """生成 ReferenceDisplayProvider；scope_resource 非空时对列表/resolve 施加 DataScope。"""
    order = order_by or code_field
    scope_key = (scope_resource or "").strip() or None
    _resource_key = resource_key
    _model = model
    _code_field = code_field
    _name_field = name_field
    _order = order
    _scope_key = scope_key
    _base_filter = base_filter

    class _Provider:
        resource_key = _resource_key

        def _base_query(self, tenant_id: int):
            query = _model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
            if _base_filter is not None:
                query = query.filter(_base_filter())
            return query

        async def search(
            self,
            *,
            tenant_id: int,
            user: User,
            page: int,
            page_size: int,
            keyword: str | None,
            is_active: bool | None,
            extra: dict[str, Any] | None,
        ) -> dict[str, Any]:
            query = self._base_query(tenant_id)
            if is_active is not None and hasattr(_model, "is_active"):
                query = query.filter(is_active=is_active)
            if keyword and keyword.strip():
                kw = keyword.strip()
                query = query.filter(
                    Q(**{f"{_code_field}__icontains": kw}) | Q(**{f"{_name_field}__icontains": kw})
                )
            if _scope_key:
                query = await DataScopeService.apply(
                    query,
                    tenant_id=tenant_id,
                    user=user,
                    resource=_scope_key,
                )
            total = await query.count()
            offset = (page - 1) * page_size
            rows = await query.order_by(_order).offset(offset).limit(page_size).all()
            return {
                "items": [
                    _row(
                        record_id=r.id,
                        uuid=getattr(r, "uuid", None),
                        code=getattr(r, _code_field, None),
                        name=getattr(r, _name_field, None),
                    )
                    for r in rows
                ],
                "total": total,
                "page": page,
                "page_size": page_size,
            }

        async def resolve(
            self,
            *,
            tenant_id: int,
            user: User,
            record_ids: list[int] | None,
            record_uuids: list[str] | None,
        ) -> list[dict[str, Any]]:
            ids = sorted({int(i) for i in (record_ids or []) if i is not None})
            uuids = sorted({str(u).strip() for u in (record_uuids or []) if str(u).strip()})
            if not ids and not uuids:
                return []
            cond = Q(tenant_id=tenant_id, deleted_at__isnull=True)
            if _base_filter is not None:
                cond &= _base_filter()
            if ids and uuids:
                cond &= Q(id__in=ids) | Q(uuid__in=uuids)
            elif ids:
                cond &= Q(id__in=ids)
            else:
                cond &= Q(uuid__in=uuids)
            query = _model.filter(cond)
            if _scope_key:
                query = await DataScopeService.apply(
                    query,
                    tenant_id=tenant_id,
                    user=user,
                    resource=_scope_key,
                )
            rows = await query.all()
            return [
                _row(
                    record_id=r.id,
                    uuid=getattr(r, "uuid", None),
                    code=getattr(r, _code_field, None),
                    name=getattr(r, _name_field, None),
                )
                for r in rows
            ]

    return _Provider()
