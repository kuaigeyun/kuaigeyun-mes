"""相机台账服务。"""

from __future__ import annotations

from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaivision.models.vision import VisionCamera, VisionStationBind
from apps.kuaivision.schemas.vision import CameraCreate, CameraResponse, CameraUpdate
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class CameraService:
    @staticmethod
    async def _primary_bind(tenant_id: int, camera_id: int) -> Optional[VisionStationBind]:
        return await VisionStationBind.filter(
            tenant_id=tenant_id, camera_id=camera_id, deleted_at__isnull=True
        ).order_by("id").first()

    @staticmethod
    async def _to_response(cam: VisionCamera, bind: Optional[VisionStationBind]) -> CameraResponse:
        return CameraResponse(
            uuid=cam.uuid,
            id=cam.id,
            code=cam.code,
            name=cam.name,
            sdk_type=cam.sdk_type,
            serial_no=cam.serial_no,
            station_code=bind.station_code if bind else None,
            plant_code=bind.plant_code if bind else None,
            workshop_code=bind.workshop_code if bind else None,
            is_enabled=cam.is_enabled,
            remark=cam.remark,
            created_by_name=cam.created_by_name,
            updated_by_name=cam.updated_by_name,
            created_at=cam.created_at,
            updated_at=cam.updated_at,
        )

    @staticmethod
    async def _upsert_bind(
        tenant_id: int,
        camera_id: int,
        *,
        station_code: Optional[str],
        plant_code: Optional[str],
        workshop_code: Optional[str],
        user: Optional[User],
    ) -> None:
        bind = await CameraService._primary_bind(tenant_id, camera_id)
        code = (station_code or "").strip()
        if not code:
            if bind:
                bind.deleted_at = resolve_business_datetime()
                apply_update_audit(bind, user)
                await bind.save()
            return
        if bind:
            bind.station_code = code
            bind.plant_code = plant_code
            bind.workshop_code = workshop_code
            bind.is_enabled = True
            apply_update_audit(bind, user)
            await bind.save()
            return
        bind = VisionStationBind(
            tenant_id=tenant_id,
            camera_id=camera_id,
            station_code=code,
            plant_code=plant_code,
            workshop_code=workshop_code,
            is_enabled=True,
        )
        apply_create_audit(bind, user)
        await bind.save()

    @staticmethod
    async def list_cameras(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
    ) -> Tuple[List[CameraResponse], int]:
        qs = VisionCamera.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q) | Q(serial_no__icontains=q))
        total = await qs.count()
        cams = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        items: List[CameraResponse] = []
        for cam in cams:
            bind = await CameraService._primary_bind(tenant_id, cam.id)
            items.append(await CameraService._to_response(cam, bind))
        return items, total

    @staticmethod
    async def get_by_uuid(tenant_id: int, uuid: str) -> CameraResponse:
        cam = await VisionCamera.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not cam:
            raise NotFoundError("相机不存在")
        bind = await CameraService._primary_bind(tenant_id, cam.id)
        return await CameraService._to_response(cam, bind)

    @staticmethod
    async def create(tenant_id: int, data: CameraCreate, user: Optional[User]) -> CameraResponse:
        exists = await VisionCamera.filter(tenant_id=tenant_id, code=data.code, deleted_at__isnull=True).exists()
        if exists:
            raise ValidationError(f"相机编码已存在：{data.code}")
        cam = VisionCamera(
            tenant_id=tenant_id,
            code=data.code.strip(),
            name=data.name.strip(),
            sdk_type=data.sdk_type,
            serial_no=data.serial_no,
            is_enabled=data.is_enabled,
            remark=data.remark,
        )
        apply_create_audit(cam, user)
        await cam.save()
        await CameraService._upsert_bind(
            tenant_id,
            cam.id,
            station_code=data.station_code,
            plant_code=data.plant_code,
            workshop_code=data.workshop_code,
            user=user,
        )
        return await CameraService.get_by_uuid(tenant_id, cam.uuid)

    @staticmethod
    async def update(tenant_id: int, uuid: str, data: CameraUpdate, user: Optional[User]) -> CameraResponse:
        cam = await VisionCamera.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not cam:
            raise NotFoundError("相机不存在")
        payload = data.model_dump(exclude_unset=True)
        bind_keys = {"station_code", "plant_code", "workshop_code"}
        for key, value in payload.items():
            if key in bind_keys:
                continue
            setattr(cam, key, value)
        apply_update_audit(cam, user)
        await cam.save()
        if bind_keys & set(payload.keys()):
            await CameraService._upsert_bind(
                tenant_id,
                cam.id,
                station_code=payload.get("station_code"),
                plant_code=payload.get("plant_code"),
                workshop_code=payload.get("workshop_code"),
                user=user,
            )
        return await CameraService.get_by_uuid(tenant_id, cam.uuid)

    @staticmethod
    async def soft_delete(tenant_id: int, uuid: str, user: Optional[User]) -> None:
        cam = await VisionCamera.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not cam:
            raise NotFoundError("相机不存在")
        cam.deleted_at = resolve_business_datetime()
        apply_update_audit(cam, user)
        await cam.save()
