"""主数据引用展示 Provider 注册。"""

from __future__ import annotations

from typing import Any

from tortoise.expressions import Q

from apps.master_data.models.customer import Customer
from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.factory import Plant, ProductionLine, WorkCenter, Workshop, Workstation
from apps.master_data.models.material import BOM, Material, MaterialGroup
from apps.master_data.models.process import DefectType, Operation, ProcessRoute, SOP
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.warehouse import StorageArea, StorageLocation, Warehouse
from apps.master_data.services.supply_chain_service import RESOURCE_SUPPLIER, RESOURCE_CUSTOMER, SupplyChainService
from core.models.department import Department
from core.models.position import Position
from core.services.authorization.data_scope_service import DataScopeService
from core.services.reference.reference_display_provider_registry import register_reference_display_provider
from core.services.reference.tenant_model_display_provider import make_tenant_model_display_provider
from core.services.user.user_display_service import UserDisplayService
from infra.models.user import User

_registered = False


def _row(*, id: int, uuid: str | None, code: str | None, name: str | None, **extra: Any) -> dict[str, Any]:
    label_parts = [p for p in [(code or "").strip(), (name or "").strip()] if p]
    label = " - ".join(label_parts) if label_parts else str(id)
    return {"id": id, "uuid": uuid, "code": code, "name": name, "label": label, **extra}


class _CustomerDisplayProvider:
    resource_key = "master-data:supply-chain:customer"

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
        skip = (page - 1) * page_size
        items, total = await SupplyChainService.list_customers(
            tenant_id=tenant_id,
            skip=skip,
            limit=page_size,
            keyword=keyword,
            is_active=is_active,
            current_user=user,
        )
        return {
            "items": [
                _row(id=c.id, uuid=c.uuid, code=c.code, name=c.name)
                for c in items
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
        if ids and uuids:
            cond &= Q(id__in=ids) | Q(uuid__in=uuids)
        elif ids:
            cond &= Q(id__in=ids)
        else:
            cond &= Q(uuid__in=uuids)
        query = await DataScopeService.apply(
            Customer.filter(cond),
            tenant_id=tenant_id,
            user=user,
            resource=RESOURCE_CUSTOMER,
        )
        rows = await query.all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _SupplierDisplayProvider:
    resource_key = "master-data:supply-chain:supplier"

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
        skip = (page - 1) * page_size
        items, total = await SupplyChainService.list_suppliers(
            tenant_id=tenant_id,
            skip=skip,
            limit=page_size,
            keyword=keyword,
            is_active=is_active,
            current_user=user,
        )
        return {
            "items": [
                _row(id=s.id, uuid=s.uuid, code=s.code, name=s.name)
                for s in items
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
        if ids and uuids:
            cond &= Q(id__in=ids) | Q(uuid__in=uuids)
        elif ids:
            cond &= Q(id__in=ids)
        else:
            cond &= Q(uuid__in=uuids)
        query = await DataScopeService.apply(
            Supplier.filter(cond),
            tenant_id=tenant_id,
            user=user,
            resource=RESOURCE_SUPPLIER,
        )
        rows = await query.all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _MaterialDisplayProvider:
    resource_key = "master-data:material"

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
        query = Material.filter(tenant_id=tenant_id, deleted_at__isnull=True, is_master=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if extra:
            group_id = extra.get("group_id") or extra.get("groupId")
            if group_id is not None:
                query = query.filter(group_id=int(group_id))
            source_type = extra.get("source_type") or extra.get("sourceType")
            if source_type:
                query = query.filter(source_type=str(source_type))
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw)
                | Q(main_code__icontains=kw)
                | Q(name__icontains=kw)
            )
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("main_code", "code").offset(offset).limit(page_size).all()
        return {
            "items": [
                {
                    **_row(id=r.id, uuid=r.uuid, code=r.main_code or r.code, name=r.name),
                    "specification": r.specification,
                    "base_unit": r.base_unit,
                    "source_type": r.source_type,
                    "main_code": r.main_code,
                    "group_id": r.group_id,
                }
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
        if ids and uuids:
            cond &= Q(id__in=ids) | Q(uuid__in=uuids)
        elif ids:
            cond &= Q(id__in=ids)
        else:
            cond &= Q(uuid__in=uuids)
        rows = await Material.filter(cond).all()
        return [
            {
                **_row(id=r.id, uuid=r.uuid, code=r.main_code or r.code, name=r.name),
                "specification": r.specification,
                "base_unit": r.base_unit,
                "source_type": r.source_type,
                "main_code": r.main_code,
                "group_id": r.group_id,
            }
            for r in rows
        ]


class _WarehouseDisplayProvider:
    resource_key = "master-data:warehouse:warehouse"

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
        query = Warehouse.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await Warehouse.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _WorkshopDisplayProvider:
    resource_key = "master-data:factory:workshop"

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
        query = Workshop.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await Workshop.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _PlantDisplayProvider:
    resource_key = "master-data:factory:plant"

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
        query = Plant.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await Plant.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _WorkCenterDisplayProvider:
    resource_key = "master-data:factory:work-center"

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
        query = WorkCenter.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await WorkCenter.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _DepartmentDisplayProvider:
    resource_key = "system:department"

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
        query = Department.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await Department.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _PositionDisplayProvider:
    resource_key = "system:position"

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
        query = Position.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if keyword and keyword.strip():
            kw = keyword.strip()
            query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        offset = (page - 1) * page_size
        rows = await query.order_by("code").offset(offset).limit(page_size).all()
        return {
            "items": [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows],
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
        rows = await Position.filter(cond).all()
        return [_row(id=r.id, uuid=r.uuid, code=r.code, name=r.name) for r in rows]


class _UserDisplayProviderAdapter:
    resource_key = "system:user"

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
        result = await UserDisplayService.search(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            keyword=keyword,
            is_active=is_active,
        )
        items = [
            {
                "id": i.id,
                "uuid": i.uuid,
                "code": i.username,
                "name": i.full_name,
                "label": i.label,
            }
            for i in result["items"]
        ]
        return {
            "items": items,
            "total": result["total"],
            "page": result["page"],
            "page_size": result["page_size"],
        }

    async def resolve(
        self,
        *,
        tenant_id: int,
        user: User,
        record_ids: list[int] | None,
        record_uuids: list[str] | None,
    ) -> list[dict[str, Any]]:
        items = await UserDisplayService.resolve(
            tenant_id=tenant_id,
            user_ids=record_ids,
            user_uuids=record_uuids,
        )
        return [
            {
                "id": i.id,
                "uuid": i.uuid,
                "code": i.username,
                "name": i.full_name,
                "label": i.label,
            }
            for i in items
        ]


_PROVIDERS = [
    _CustomerDisplayProvider(),
    _SupplierDisplayProvider(),
    _MaterialDisplayProvider(),
    _WarehouseDisplayProvider(),
    _WorkshopDisplayProvider(),
    _PlantDisplayProvider(),
    _WorkCenterDisplayProvider(),
    _DepartmentDisplayProvider(),
    _PositionDisplayProvider(),
    _UserDisplayProviderAdapter(),
    make_tenant_model_display_provider(
        resource_key="master-data:factory:production-line",
        model=ProductionLine,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:factory:workstation",
        model=Workstation,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:warehouse:storage-area",
        model=StorageArea,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:warehouse:storage-location",
        model=StorageLocation,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:material:group",
        model=MaterialGroup,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:material:bom",
        model=BOM,
        code_field="bom_code",
        name_field="description",
        order_by="bom_code",
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:process:defect-type",
        model=DefectType,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:process:operation",
        model=Operation,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:process:route",
        model=ProcessRoute,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:process:sop",
        model=SOP,
    ),
    make_tenant_model_display_provider(
        resource_key="master-data:process:drawing",
        model=EngineeringDrawing,
    ),
]


def register_master_data_reference_display_providers() -> None:
    global _registered
    if _registered:
        return
    for provider in _PROVIDERS:
        register_reference_display_provider(provider)
    _registered = True
