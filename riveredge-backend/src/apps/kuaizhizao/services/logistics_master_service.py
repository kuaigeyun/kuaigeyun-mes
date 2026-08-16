"""快制造物流主数据服务"""

from typing import Any, Dict, List, Optional

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


# 编码需能被物流轨迹识别（快递100 / 快递鸟 / 云市场）
PRESET_CN_CARRIERS: List[Dict[str, str]] = [
    {"code": "SF", "name": "顺丰速运", "carrier_type": "express", "service_hotline": "95338"},
    {"code": "ZTO", "name": "中通快递", "carrier_type": "express", "service_hotline": "95311"},
    {"code": "YTO", "name": "圆通速递", "carrier_type": "express", "service_hotline": "95554"},
    {"code": "YD", "name": "韵达速递", "carrier_type": "express", "service_hotline": "95546"},
    {"code": "STO", "name": "申通快递", "carrier_type": "express", "service_hotline": "95543"},
    {"code": "JT", "name": "极兔速递", "carrier_type": "express", "service_hotline": "956025"},
    {"code": "JD", "name": "京东物流", "carrier_type": "express", "service_hotline": "950616"},
    {"code": "EMS", "name": "EMS", "carrier_type": "express", "service_hotline": "11183"},
    {"code": "YZPY", "name": "邮政快递包裹", "carrier_type": "express", "service_hotline": "11183"},
    {"code": "DBL", "name": "德邦快递", "carrier_type": "express", "service_hotline": "95353"},
    {"code": "HTKY", "name": "百世快递", "carrier_type": "express", "service_hotline": "95320"},
    {"code": "KYSY", "name": "跨越速运", "carrier_type": "express", "service_hotline": "95324"},
    {"code": "ANE", "name": "安能物流", "carrier_type": "ltl", "service_hotline": "400-104-0088"},
    {"code": "SNWL", "name": "苏宁物流", "carrier_type": "express", "service_hotline": "95315"},
    {"code": "ZYEX", "name": "中邮快递", "carrier_type": "express", "service_hotline": "11183"},
]


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

    async def list_carrier_preset_preview(self, tenant_id: int) -> List[Dict[str, Any]]:
        existing = await LogisticsCarrier.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        existing_codes = {str(row.code or "").strip().upper() for row in existing}
        existing_names = {str(row.name or "").strip() for row in existing}
        return [
            {
                **item,
                "exists": item["code"].upper() in existing_codes or item["name"] in existing_names,
            }
            for item in PRESET_CN_CARRIERS
        ]

    async def load_preset_carriers(
        self,
        tenant_id: int,
        codes: Optional[List[str]] = None,
    ) -> Dict[str, int]:
        items = PRESET_CN_CARRIERS
        if codes is not None:
            selected = {str(code).strip().upper() for code in codes if str(code).strip()}
            items = [item for item in items if item["code"].upper() in selected]
        existing = await LogisticsCarrier.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        existing_by_code = {str(row.code or "").strip().upper(): row for row in existing}
        existing_by_name = {str(row.name or "").strip(): row for row in existing}
        created = 0
        skipped = 0
        updated = 0
        for item in items:
            row = existing_by_code.get(item["code"].upper()) or existing_by_name.get(item["name"])
            if row:
                if not str(row.service_hotline or "").strip() and item.get("service_hotline"):
                    row.service_hotline = item["service_hotline"]
                    await row.save()
                    updated += 1
                else:
                    skipped += 1
                continue
            await LogisticsCarrier.create(
                tenant_id=tenant_id,
                code=item["code"],
                name=item["name"],
                carrier_type=item["carrier_type"],
                service_hotline=item.get("service_hotline"),
                is_enabled=True,
            )
            created += 1
        return {"created": created, "skipped": skipped, "updated": updated}

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
