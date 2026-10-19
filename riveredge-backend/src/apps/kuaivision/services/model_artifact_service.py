"""模型制品服务。"""

from __future__ import annotations

from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.kuaivision.models.vision import VisionModelArtifact
from apps.kuaivision.schemas.vision import (
    ModelArtifactCreate,
    ModelArtifactResponse,
    ModelArtifactUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class ModelArtifactService:
    @staticmethod
    def _to_response(item: VisionModelArtifact) -> ModelArtifactResponse:
        return ModelArtifactResponse(
            uuid=item.uuid,
            id=item.id,
            code=item.code,
            name=item.name,
            framework=item.framework or "onnx",
            object_key=item.object_key,
            checksum=item.checksum,
            input_width=item.input_width,
            input_height=item.input_height,
            label_map=item.label_map,
            is_enabled=item.is_enabled,
            remark=item.remark,
            created_by_name=item.created_by_name,
            updated_by_name=item.updated_by_name,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    async def list_items(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
    ) -> Tuple[List[ModelArtifactResponse], int]:
        qs = VisionModelArtifact.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q) | Q(checksum__icontains=q))
        total = await qs.count()
        rows = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        return [ModelArtifactService._to_response(r) for r in rows], total

    @staticmethod
    async def get_by_uuid(tenant_id: int, uuid: str) -> VisionModelArtifact:
        item = await VisionModelArtifact.get_or_none(
            tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True
        )
        if not item:
            raise NotFoundError("模型制品不存在")
        return item

    @staticmethod
    async def get_response(tenant_id: int, uuid: str) -> ModelArtifactResponse:
        return ModelArtifactService._to_response(await ModelArtifactService.get_by_uuid(tenant_id, uuid))

    @staticmethod
    async def create(
        tenant_id: int, data: ModelArtifactCreate, user: Optional[User]
    ) -> ModelArtifactResponse:
        exists = await VisionModelArtifact.filter(
            tenant_id=tenant_id, code=data.code.strip(), deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"模型编码已存在：{data.code}")
        item = VisionModelArtifact(
            tenant_id=tenant_id,
            code=data.code.strip(),
            name=data.name.strip(),
            framework=(data.framework or "onnx").strip(),
            object_key=data.object_key.strip(),
            checksum=data.checksum.strip(),
            input_width=data.input_width,
            input_height=data.input_height,
            label_map=data.label_map,
            is_enabled=data.is_enabled,
            remark=data.remark,
        )
        apply_create_audit(item, user)
        await item.save()
        return ModelArtifactService._to_response(item)

    @staticmethod
    async def update(
        tenant_id: int, uuid: str, data: ModelArtifactUpdate, user: Optional[User]
    ) -> ModelArtifactResponse:
        item = await ModelArtifactService.get_by_uuid(tenant_id, uuid)
        for key, value in data.model_dump(exclude_unset=True).items():
            if isinstance(value, str):
                value = value.strip()
            setattr(item, key, value)
        apply_update_audit(item, user)
        await item.save()
        return ModelArtifactService._to_response(item)

    @staticmethod
    async def soft_delete(tenant_id: int, uuid: str, user: Optional[User]) -> None:
        item = await ModelArtifactService.get_by_uuid(tenant_id, uuid)
        item.deleted_at = resolve_business_datetime()
        apply_update_audit(item, user)
        await item.save()
