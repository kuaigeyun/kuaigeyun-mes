"""快制造物流主数据服务"""

from typing import Any, Dict, Optional

from tortoise.expressions import Q

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.logistics import Driver, LogisticsCarrier, Vehicle
from apps.kuaizhizao.schemas.logistics import (
    DriverCreate,
    DriverUpdate,
    LogisticsCarrierCreate,
    LogisticsCarrierUpdate,
    VehicleCreate,
    VehicleUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError


class LogisticsMasterService(AppBaseService):
    async def _ensure_unique_code(
        self,
        tenant_id: int,
        model,
        code: str,
        *,
        exclude_id: Optional[int] = None,
        field_name: str = "code",
    ) -> None:
        query = model.filter(tenant_id=tenant_id, deleted_at__isnull=True, **{field_name: code})
        if exclude_id is not None:
            query = query.exclude(id=exclude_id)
        if await query.exists():
            raise BusinessLogicError(f"编码 {code} 已存在")

    async def list_carriers(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = LogisticsCarrier.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw))
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        return {"items": rows, "total": total}

    async def create_carrier(self, tenant_id: int, data: LogisticsCarrierCreate) -> LogisticsCarrier:
        code = data.code or await self.generate_code(tenant_id, "LOGISTICS_CARRIER_CODE", prefix="LC")
        await self._ensure_unique_code(tenant_id, LogisticsCarrier, code)
        return await LogisticsCarrier.create(tenant_id=tenant_id, code=code, **data.model_dump(exclude={"code"}, exclude_none=True))

    async def update_carrier(self, tenant_id: int, record_id: int, data: LogisticsCarrierUpdate) -> LogisticsCarrier:
        row = await self.get_by_id(tenant_id, record_id, LogisticsCarrier)
        payload = data.model_dump(exclude_none=True)
        await row.update_from_dict(payload)
        await row.save()
        return row

    async def delete_carrier(self, tenant_id: int, record_id: int) -> None:
        row = await self.get_by_id(tenant_id, record_id, LogisticsCarrier)
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def list_vehicles(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        ownership: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Vehicle.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if ownership:
            query = query.filter(ownership=ownership)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(plate_number__icontains=kw) | Q(vehicle_type__icontains=kw))
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        return {"items": rows, "total": total}

    async def create_vehicle(self, tenant_id: int, data: VehicleCreate) -> Vehicle:
        exists = await Vehicle.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            plate_number=data.plate_number,
        ).exists()
        if exists:
            raise BusinessLogicError(f"车牌 {data.plate_number} 已存在")
        return await Vehicle.create(tenant_id=tenant_id, **data.model_dump())

    async def update_vehicle(self, tenant_id: int, record_id: int, data: VehicleUpdate) -> Vehicle:
        row = await self.get_by_id(tenant_id, record_id, Vehicle)
        payload = data.model_dump(exclude_none=True)
        if payload.get("plate_number") and payload["plate_number"] != row.plate_number:
            exists = await Vehicle.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                plate_number=payload["plate_number"],
            ).exclude(id=record_id).exists()
            if exists:
                raise BusinessLogicError(f"车牌 {payload['plate_number']} 已存在")
        await row.update_from_dict(payload)
        await row.save()
        return row

    async def delete_vehicle(self, tenant_id: int, record_id: int) -> None:
        row = await self.get_by_id(tenant_id, record_id, Vehicle)
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def list_drivers(
        self,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 20,
        keyword: Optional[str] = None,
        ownership: Optional[str] = None,
    ) -> Dict[str, Any]:
        query = Driver.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if ownership:
            query = query.filter(ownership=ownership)
        if keyword:
            kw = keyword.strip()
            if kw:
                query = query.filter(Q(code__icontains=kw) | Q(name__icontains=kw) | Q(phone__icontains=kw))
        total = await query.count()
        rows = await query.offset(skip).limit(limit).order_by("-created_at")
        return {"items": rows, "total": total}

    async def create_driver(self, tenant_id: int, data: DriverCreate) -> Driver:
        code = data.code or await self.generate_code(tenant_id, "DRIVER_CODE", prefix="DR")
        await self._ensure_unique_code(tenant_id, Driver, code)
        return await Driver.create(tenant_id=tenant_id, code=code, **data.model_dump(exclude={"code"}, exclude_none=True))

    async def update_driver(self, tenant_id: int, record_id: int, data: DriverUpdate) -> Driver:
        row = await self.get_by_id(tenant_id, record_id, Driver)
        payload = data.model_dump(exclude_none=True)
        await row.update_from_dict(payload)
        await row.save()
        return row

    async def delete_driver(self, tenant_id: int, record_id: int) -> None:
        row = await self.get_by_id(tenant_id, record_id, Driver)
        row.deleted_at = resolve_business_datetime()
        await row.save()

    async def get_by_id(self, tenant_id: int, record_id: int, model):
        row = await model.get_or_none(id=record_id, tenant_id=tenant_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("记录不存在")
        return row
