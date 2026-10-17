"""样本库：样本集、从检测入库、导出训练包。"""

from __future__ import annotations

from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaivision.models.vision import (
    VisionInspectionEvent,
    VisionInspectionImage,
    VisionSampleItem,
    VisionSampleSet,
)
from apps.kuaivision.schemas.vision import (
    PromoteSampleRequest,
    SampleExportPack,
    SampleItemOut,
    SampleSetCreate,
    SampleSetListItem,
    SampleSetResponse,
    SampleSetUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class SampleService:
    @staticmethod
    async def _item_count(tenant_id: int, sample_set_id: int) -> int:
        return await VisionSampleItem.filter(
            tenant_id=tenant_id, sample_set_id=sample_set_id, deleted_at__isnull=True
        ).count()

    @staticmethod
    def _item_out(item: VisionSampleItem) -> SampleItemOut:
        return SampleItemOut(
            uuid=item.uuid,
            id=item.id,
            label=item.label,
            object_key=item.object_key,
            source_event_uuid=item.source_event_uuid,
            remark=item.remark,
            created_at=item.created_at,
        )

    @staticmethod
    async def _to_list_item(row: VisionSampleSet) -> SampleSetListItem:
        return SampleSetListItem(
            uuid=row.uuid,
            id=row.id,
            code=row.code,
            name=row.name,
            recipe_code=row.recipe_code,
            is_enabled=row.is_enabled,
            item_count=await SampleService._item_count(row.tenant_id, row.id),
            remark=row.remark,
            created_by_name=row.created_by_name,
            updated_by_name=row.updated_by_name,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    async def list_sets(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
        recipe_code: Optional[str] = None,
    ) -> Tuple[List[SampleSetListItem], int]:
        qs = VisionSampleSet.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if recipe_code:
            qs = qs.filter(recipe_code=recipe_code)
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q) | Q(recipe_code__icontains=q))
        total = await qs.count()
        rows = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        return [await SampleService._to_list_item(r) for r in rows], total

    @staticmethod
    async def get_by_uuid(tenant_id: int, uuid: str) -> VisionSampleSet:
        row = await VisionSampleSet.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not row:
            raise NotFoundError("样本集不存在")
        return row

    @staticmethod
    async def get_detail(tenant_id: int, uuid: str) -> SampleSetResponse:
        row = await SampleService.get_by_uuid(tenant_id, uuid)
        items = await VisionSampleItem.filter(
            tenant_id=tenant_id, sample_set_id=row.id, deleted_at__isnull=True
        ).order_by("-id")
        return SampleSetResponse(
            uuid=row.uuid,
            id=row.id,
            code=row.code,
            name=row.name,
            recipe_code=row.recipe_code,
            is_enabled=row.is_enabled,
            item_count=len(items),
            remark=row.remark,
            items=[SampleService._item_out(i) for i in items],
            created_by_name=row.created_by_name,
            updated_by_name=row.updated_by_name,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )

    @staticmethod
    async def create(tenant_id: int, data: SampleSetCreate, user: Optional[User]) -> SampleSetResponse:
        exists = await VisionSampleSet.filter(
            tenant_id=tenant_id, code=data.code.strip(), deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"样本集编码已存在：{data.code}")
        row = VisionSampleSet(
            tenant_id=tenant_id,
            code=data.code.strip(),
            name=data.name.strip(),
            recipe_code=data.recipe_code,
            is_enabled=data.is_enabled,
            remark=data.remark,
        )
        apply_create_audit(row, user)
        await row.save()
        return await SampleService.get_detail(tenant_id, row.uuid)

    @staticmethod
    async def update(
        tenant_id: int, uuid: str, data: SampleSetUpdate, user: Optional[User]
    ) -> SampleSetResponse:
        row = await SampleService.get_by_uuid(tenant_id, uuid)
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        return await SampleService.get_detail(tenant_id, row.uuid)

    @staticmethod
    async def soft_delete(tenant_id: int, uuid: str, user: Optional[User]) -> None:
        row = await SampleService.get_by_uuid(tenant_id, uuid)
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, user)
        await row.save()
        await VisionSampleItem.filter(
            tenant_id=tenant_id, sample_set_id=row.id, deleted_at__isnull=True
        ).update(deleted_at=now)

    @staticmethod
    async def _resolve_or_create_set(
        tenant_id: int,
        data: PromoteSampleRequest,
        event: VisionInspectionEvent,
        user: Optional[User],
    ) -> VisionSampleSet:
        if data.sample_set_uuid:
            return await SampleService.get_by_uuid(tenant_id, data.sample_set_uuid)
        code = (data.sample_set_code or "").strip()
        if not code:
            recipe = (data.recipe_code or event.recipe_code or "UNKNOWN").strip()
            code = f"SET-{recipe}"
        existing = await VisionSampleSet.get_or_none(
            tenant_id=tenant_id, code=code, deleted_at__isnull=True
        )
        if existing:
            return existing
        name = (data.sample_set_name or "").strip() or f"样本集 {code}"
        created = await SampleService.create(
            tenant_id,
            SampleSetCreate(
                code=code,
                name=name,
                recipe_code=data.recipe_code or event.recipe_code,
                is_enabled=True,
            ),
            user,
        )
        return await SampleService.get_by_uuid(tenant_id, created.uuid)

    @staticmethod
    async def promote_from_inspection(
        tenant_id: int,
        event_uuid: str,
        data: PromoteSampleRequest,
        user: Optional[User],
    ) -> SampleSetResponse:
        event = await VisionInspectionEvent.get_or_none(
            tenant_id=tenant_id, uuid=event_uuid, deleted_at__isnull=True
        )
        if not event:
            raise NotFoundError("检测记录不存在")
        images = await VisionInspectionImage.filter(
            tenant_id=tenant_id, event_id=event.id, deleted_at__isnull=True
        ).order_by("sort_order", "id")
        if not images:
            raise ValidationError("该检测记录没有原图，无法入库为样本")
        sample_set = await SampleService._resolve_or_create_set(tenant_id, data, event, user)
        raw_label = (data.label or event.judgment or "UNKNOWN").strip()
        label = "boundary" if raw_label.lower() == "boundary" else raw_label.upper()
        for img in images:
            item = VisionSampleItem(
                tenant_id=tenant_id,
                sample_set_id=sample_set.id,
                label=label,
                object_key=img.object_key,
                source_event_id=event.id,
                source_event_uuid=event.uuid,
            )
            apply_create_audit(item, user)
            await item.save()
        return await SampleService.get_detail(tenant_id, sample_set.uuid)

    @staticmethod
    async def export_pack(tenant_id: int, uuid: str) -> SampleExportPack:
        detail = await SampleService.get_detail(tenant_id, uuid)
        return SampleExportPack(
            format="kuaivision-sample-pack/v1",
            sample_set_code=detail.code,
            sample_set_name=detail.name,
            recipe_code=detail.recipe_code,
            exported_at=resolve_business_datetime(),
            items=[
                {
                    "label": i.label,
                    "object_key": i.object_key,
                    "source_event_uuid": i.source_event_uuid,
                    "remark": i.remark,
                }
                for i in detail.items
            ],
        )
