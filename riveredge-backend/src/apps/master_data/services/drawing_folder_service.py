"""图纸仓库文件夹：树、CRUD、分类筛选。"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.master_data.models.drawing import DrawingFolder, EngineeringDrawing
from apps.master_data.schemas.drawing_folder_schemas import (
    DrawingFolderCreate,
    DrawingFolderResponse,
    DrawingFolderUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


def collect_descendant_ids(root_id: int, parent_of: Dict[int, Optional[int]]) -> List[int]:
    """含自身的后代 ID（环路靠 seen 截断）。"""
    children_of: Dict[Optional[int], List[int]] = {}
    for folder_id, parent_id in parent_of.items():
        children_of.setdefault(parent_id, []).append(folder_id)
    out: List[int] = []
    stack = [root_id]
    seen: set[int] = set()
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        out.append(current)
        stack.extend(children_of.get(current, []))
    return out


class DrawingFolderService:
    @staticmethod
    async def _get_or_404(tenant_id: int, folder_uuid: str) -> DrawingFolder:
        row = await DrawingFolder.get_or_none(
            tenant_id=tenant_id,
            uuid=folder_uuid,
            deleted_at__isnull=True,
        )
        if not row:
            raise NotFoundError("仓库文件夹不存在")
        return row

    @staticmethod
    async def resolve_folder_id(tenant_id: int, folder_uuid: Optional[str]) -> Optional[int]:
        if not folder_uuid:
            return None
        row = await DrawingFolderService._get_or_404(tenant_id, folder_uuid)
        return row.id

    @staticmethod
    async def _parent_map(tenant_id: int) -> Dict[int, Optional[int]]:
        rows = await DrawingFolder.filter(tenant_id=tenant_id, deleted_at__isnull=True).all()
        return {row.id: row.parent_id for row in rows}

    @staticmethod
    async def resolve_filter_folder_ids(
        tenant_id: int,
        folder_uuid: Optional[str],
        unclassified: bool,
    ) -> tuple[Optional[List[int]], bool]:
        """
        返回 (folder_ids, unclassified_only)。
        folder_ids 为 None 表示不按文件夹过滤。
        """
        if unclassified:
            return None, True
        if not folder_uuid:
            return None, False
        row = await DrawingFolderService._get_or_404(tenant_id, folder_uuid)
        parent_of = await DrawingFolderService._parent_map(tenant_id)
        return collect_descendant_ids(row.id, parent_of), False

    @staticmethod
    async def _assert_parent(
        tenant_id: int,
        parent_uuid: Optional[str],
        self_id: Optional[int] = None,
    ) -> Optional[int]:
        if not parent_uuid:
            return None
        parent = await DrawingFolderService._get_or_404(tenant_id, parent_uuid)
        if self_id is not None and parent.id == self_id:
            raise ValidationError("不能将文件夹设为自己的父级")
        if self_id is not None:
            parent_of = await DrawingFolderService._parent_map(tenant_id)
            if parent.id in collect_descendant_ids(self_id, parent_of):
                raise ValidationError("不能将文件夹移到自己的下级")
        return parent.id

    @staticmethod
    async def _assert_unique_name(
        tenant_id: int,
        parent_id: Optional[int],
        name: str,
        exclude_id: Optional[int] = None,
    ) -> None:
        query = DrawingFolder.filter(
            tenant_id=tenant_id,
            parent_id=parent_id,
            name=name,
            deleted_at__isnull=True,
        )
        if exclude_id is not None:
            query = query.exclude(id=exclude_id)
        if await query.exists():
            raise ValidationError("同级已存在同名文件夹")

    @staticmethod
    async def _to_response(
        row: DrawingFolder,
        parent_uuid_by_id: Dict[int, str],
        children: Optional[List[DrawingFolderResponse]] = None,
    ) -> DrawingFolderResponse:
        parent_uuid = parent_uuid_by_id.get(row.parent_id) if row.parent_id else None
        return DrawingFolderResponse(
            id=row.id,
            uuid=row.uuid,
            tenant_id=row.tenant_id,
            name=row.name,
            parent_id=row.parent_id,
            parent_uuid=parent_uuid,
            sort_order=row.sort_order,
            is_active=row.is_active,
            created_by_name=row.created_by_name,
            updated_by_name=row.updated_by_name,
            created_at=row.created_at,
            updated_at=row.updated_at,
            children=children or [],
        )

    @staticmethod
    async def list_tree(tenant_id: int) -> List[DrawingFolderResponse]:
        rows = await DrawingFolder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).order_by("sort_order", "name", "id")
        uuid_by_id = {row.id: row.uuid for row in rows}
        nodes: Dict[int, DrawingFolderResponse] = {}
        for row in rows:
            nodes[row.id] = await DrawingFolderService._to_response(row, uuid_by_id, [])
        roots: List[DrawingFolderResponse] = []
        for row in rows:
            node = nodes[row.id]
            if row.parent_id and row.parent_id in nodes:
                nodes[row.parent_id].children.append(node)
            else:
                roots.append(node)
        return roots

    @staticmethod
    async def create_folder(
        tenant_id: int,
        data: DrawingFolderCreate,
        current_user: Optional[User] = None,
    ) -> DrawingFolderResponse:
        parent_id = await DrawingFolderService._assert_parent(tenant_id, data.parent_uuid)
        await DrawingFolderService._assert_unique_name(tenant_id, parent_id, data.name)
        payload = {
            "tenant_id": tenant_id,
            "name": data.name,
            "parent_id": parent_id,
            "sort_order": data.sort_order,
            "is_active": True,
        }
        apply_create_audit(payload, current_user)
        row = await DrawingFolder.create(**payload)
        uuid_by_id = {row.id: row.uuid}
        if parent_id:
            parent = await DrawingFolder.get_or_none(id=parent_id)
            if parent:
                uuid_by_id[parent.id] = parent.uuid
        return await DrawingFolderService._to_response(row, uuid_by_id)

    @staticmethod
    async def update_folder(
        tenant_id: int,
        folder_uuid: str,
        data: DrawingFolderUpdate,
        current_user: Optional[User] = None,
    ) -> DrawingFolderResponse:
        row = await DrawingFolderService._get_or_404(tenant_id, folder_uuid)
        update = data.model_dump(exclude_unset=True, by_alias=False)
        parent_id = row.parent_id
        if "parent_uuid" in update:
            parent_id = await DrawingFolderService._assert_parent(
                tenant_id, update.pop("parent_uuid"), self_id=row.id
            )
            row.parent_id = parent_id
        if "name" in update and update["name"] is not None:
            row.name = update["name"]
        if "sort_order" in update and update["sort_order"] is not None:
            row.sort_order = update["sort_order"]
        if "is_active" in update and update["is_active"] is not None:
            row.is_active = update["is_active"]
        await DrawingFolderService._assert_unique_name(
            tenant_id, parent_id, row.name, exclude_id=row.id
        )
        apply_update_audit(row, current_user)
        await row.save()
        uuid_by_id = {row.id: row.uuid}
        if parent_id:
            parent = await DrawingFolder.get_or_none(id=parent_id)
            if parent:
                uuid_by_id[parent.id] = parent.uuid
        return await DrawingFolderService._to_response(row, uuid_by_id)

    @staticmethod
    async def delete_folder(tenant_id: int, folder_uuid: str) -> None:
        row = await DrawingFolderService._get_or_404(tenant_id, folder_uuid)
        has_child = await DrawingFolder.filter(
            tenant_id=tenant_id, parent_id=row.id, deleted_at__isnull=True
        ).exists()
        if has_child:
            raise ValidationError("请先删除或移走下级文件夹")
        has_drawing = await EngineeringDrawing.filter(
            tenant_id=tenant_id, folder_id=row.id, deleted_at__isnull=True
        ).exists()
        if has_drawing:
            raise ValidationError("文件夹内仍有图纸，无法删除")
        row.deleted_at = resolve_business_datetime()
        await row.save()

    @staticmethod
    async def folder_briefs(
        tenant_id: int, folder_ids: Iterable[int]
    ) -> Dict[int, tuple[str, str]]:
        ids = [i for i in folder_ids if i]
        if not ids:
            return {}
        rows = await DrawingFolder.filter(
            tenant_id=tenant_id, id__in=ids, deleted_at__isnull=True
        ).all()
        return {row.id: (row.uuid, row.name) for row in rows}
