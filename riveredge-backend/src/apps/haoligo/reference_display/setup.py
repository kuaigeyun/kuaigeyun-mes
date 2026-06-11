"""好力GO 引用展示 Provider 注册。"""

from __future__ import annotations

from typing import Any, Type

from tortoise.expressions import Q
from tortoise.models import Model

from apps.haoligo.models.equipment import (
    HaoligoEquipment,
    HaoligoEquipmentCategory,
    HaoligoInspectionParam,
    HaoligoInspectionParamSet,
    HaoligoManufacturer,
    HaoligoWorkshop,
)
from apps.haoligo.models.equipment_upkeep_param import (
    HaoligoEquipmentUpkeepParam,
    HaoligoEquipmentUpkeepParamSet,
)
from apps.haoligo.models.mold import HaoligoMold
from apps.haoligo.models.mold_upkeep import HaoligoMoldUpkeepParam, HaoligoMoldUpkeepParamSet
from apps.haoligo.models.mold_warehouse import HaoligoMoldWarehouse
from core.services.reference.reference_display_provider_registry import register_reference_display_provider
from infra.models.user import User

_registered = False


def _row(*, record_id: int, uuid: str | None, code: str | None, name: str | None, **extra: Any) -> dict[str, Any]:
    label_parts = [p for p in [(code or "").strip(), (name or "").strip()] if p]
    label = " - ".join(label_parts) if label_parts else str(record_id)
    return {"id": record_id, "uuid": uuid, "code": code, "name": name, "label": label, **extra}


class _SimpleModelDisplayProvider:
    def __init__(
        self,
        *,
        resource_key: str,
        model: Type[Model],
        code_field: str = "code",
        name_field: str = "name",
    ) -> None:
        self.resource_key = resource_key
        self._model = model
        self._code_field = code_field
        self._name_field = name_field

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
        query = self._model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None and hasattr(self._model, "is_active"):
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(**{f"{self._code_field}__icontains": kw})
                | Q(**{f"{self._name_field}__icontains": kw})
            )
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by(self._code_field).offset(offset).limit(page_size).all()
        return {
            "items": [self._map_row(r) for r in rows],
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
        if ids and uuids:
            cond &= Q(id__in=ids) | Q(uuid__in=uuids)
        elif ids:
            cond &= Q(id__in=ids)
        else:
            cond &= Q(uuid__in=uuids)
        rows = await self._model.filter(cond).all()
        return [self._map_row(r) for r in rows]

    def _map_row(self, row: Model) -> dict[str, Any]:
        return _row(
            id=int(row.id),
            uuid=getattr(row, "uuid", None),
            code=getattr(row, self._code_field, None),
            name=getattr(row, self._name_field, None),
        )


_HAOLIGO_PROVIDERS = [
    _SimpleModelDisplayProvider(
        resource_key="haoligo:molds-ledger",
        model=HaoligoMold,
        code_field="mold_code",
        name_field="name",
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:molds-warehouse",
        model=HaoligoMoldWarehouse,
        code_field="warehouse_code",
        name_field="warehouse_name",
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-ledger",
        model=HaoligoEquipment,
        code_field="asset_code",
        name_field="name",
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-categories",
        model=HaoligoEquipmentCategory,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-manufacturers",
        model=HaoligoManufacturer,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:master-data-factory-workshops",
        model=HaoligoWorkshop,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:molds-upkeep-param-sets",
        model=HaoligoMoldUpkeepParamSet,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:molds-upkeep-params",
        model=HaoligoMoldUpkeepParam,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-upkeep-param-sets",
        model=HaoligoEquipmentUpkeepParamSet,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-upkeep-params",
        model=HaoligoEquipmentUpkeepParam,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-inspection-param-sets",
        model=HaoligoInspectionParamSet,
    ),
    _SimpleModelDisplayProvider(
        resource_key="haoligo:equipment-inspection-params",
        model=HaoligoInspectionParam,
    ),
]


def register_haoligo_reference_display_providers() -> None:
    global _registered
    if _registered:
        return
    for provider in _HAOLIGO_PROVIDERS:
        register_reference_display_provider(provider)
    _registered = True
