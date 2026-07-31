"""文件预览批注服务"""

from typing import Any, Dict, Optional

from core.models.file import File
from core.models.file_preview_markup import FilePreviewMarkup
from infra.exceptions.exceptions import NotFoundError, ValidationError


ALLOWED_SCOPES = frozenset({"default", "top", "bottom"})


class FilePreviewMarkupService:
    @staticmethod
    def _normalize_scope(scope: Optional[str]) -> str:
        normalized = (scope or "default").strip().lower()
        if normalized not in ALLOWED_SCOPES:
            raise ValidationError(f"不支持的批注范围: {scope}")
        return normalized

    @staticmethod
    async def _ensure_file(tenant_id: int, file_uuid: str) -> File:
        file = await File.get_or_none(uuid=file_uuid, tenant_id=tenant_id, is_active=True)
        if not file:
            raise NotFoundError(f"文件不存在: {file_uuid}")
        return file

    @staticmethod
    def _empty_payload() -> Dict[str, Any]:
        return {
            "version": 1,
            "coordinate_space": "viewBox",
            "viewBox": None,
            "shapes": [],
        }

    @staticmethod
    async def get_markup(
        tenant_id: int,
        file_uuid: str,
        scope: Optional[str] = None,
    ) -> Dict[str, Any]:
        await FilePreviewMarkupService._ensure_file(tenant_id, file_uuid)
        normalized_scope = FilePreviewMarkupService._normalize_scope(scope)
        row = await FilePreviewMarkup.get_or_none(
            tenant_id=tenant_id,
            file_uuid=file_uuid,
            scope=normalized_scope,
        )
        payload = row.payload if row and isinstance(row.payload, dict) else FilePreviewMarkupService._empty_payload()
        return {
            "file_uuid": file_uuid,
            "scope": normalized_scope,
            "payload": payload,
            "updated_by": row.updated_by if row else None,
            "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
        }

    @staticmethod
    async def save_markup(
        tenant_id: int,
        file_uuid: str,
        payload: Dict[str, Any],
        scope: Optional[str] = None,
        updated_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        await FilePreviewMarkupService._ensure_file(tenant_id, file_uuid)
        normalized_scope = FilePreviewMarkupService._normalize_scope(scope)
        if not isinstance(payload, dict):
            raise ValidationError("批注 payload 必须为对象")
        shapes = payload.get("shapes")
        if shapes is not None and not isinstance(shapes, list):
            raise ValidationError("批注 shapes 必须为数组")

        row = await FilePreviewMarkup.get_or_none(
            tenant_id=tenant_id,
            file_uuid=file_uuid,
            scope=normalized_scope,
        )
        if row:
            row.payload = payload
            row.updated_by = updated_by
            await row.save()
        else:
            row = await FilePreviewMarkup.create(
                tenant_id=tenant_id,
                file_uuid=file_uuid,
                scope=normalized_scope,
                payload=payload,
                updated_by=updated_by,
            )
        return {
            "file_uuid": file_uuid,
            "scope": normalized_scope,
            "payload": row.payload,
            "updated_by": row.updated_by,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }
