"""
资源分类管理服务
"""

from typing import List, Optional, Type
from uuid import UUID

from tortoise.models import Model

from core.models.api import API
from core.models.dataset import Dataset
from core.models.resource_category import (
    RESOURCE_TYPE_API,
    RESOURCE_TYPE_DATASET,
    RESOURCE_TYPES,
    ResourceCategory,
)
from core.schemas.resource_category import (
    ResourceCategoryCreate,
    ResourceCategoryResponse,
    ResourceCategoryUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ResourceCategoryService:
    """接口/数据集分类 CRUD"""

    @staticmethod
    def _resource_model(resource_type: str) -> Type[Model]:
        if resource_type == RESOURCE_TYPE_API:
            return API
        if resource_type == RESOURCE_TYPE_DATASET:
            return Dataset
        raise ValidationError(f"不支持的资源类型: {resource_type}")

    @staticmethod
    def _assert_resource_type(resource_type: str) -> str:
        normalized = str(resource_type or "").strip()
        if normalized not in RESOURCE_TYPES:
            raise ValidationError(f"资源类型必须是 {list(RESOURCE_TYPES)} 之一")
        return normalized

    async def get_category_by_uuid(
        self,
        tenant_id: int,
        resource_type: str,
        category_uuid: UUID,
    ) -> ResourceCategory:
        resource_type = self._assert_resource_type(resource_type)
        category = await ResourceCategory.filter(
            tenant_id=tenant_id,
            resource_type=resource_type,
            uuid=category_uuid,
            deleted_at__isnull=True,
        ).first()
        if not category:
            raise NotFoundError(f"分类不存在: {category_uuid}")
        return category

    async def resolve_category_id(
        self,
        tenant_id: int,
        resource_type: str,
        category_uuid: Optional[UUID],
    ) -> Optional[int]:
        if category_uuid is None:
            return None
        category = await self.get_category_by_uuid(tenant_id, resource_type, category_uuid)
        return category.id

    async def _count_items(
        self,
        tenant_id: int,
        resource_type: str,
        category_id: Optional[int] = None,
        uncategorized_only: bool = False,
    ) -> int:
        model = self._resource_model(resource_type)
        query = model.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if uncategorized_only:
            query = query.filter(category_id__isnull=True)
        elif category_id is not None:
            query = query.filter(category_id=category_id)
        return await query.count()

    def _build_response(
        self,
        category: ResourceCategory,
        item_count: int,
    ) -> ResourceCategoryResponse:
        return ResourceCategoryResponse(
            uuid=category.uuid,
            tenant_id=category.tenant_id,
            name=category.name,
            code=category.code,
            description=category.description,
            resource_type=category.resource_type,
            sort_order=category.sort_order,
            is_active=category.is_active,
            item_count=item_count,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )

    async def list_categories(
        self,
        tenant_id: int,
        resource_type: str,
    ) -> dict:
        resource_type = self._assert_resource_type(resource_type)
        categories = await ResourceCategory.filter(
            tenant_id=tenant_id,
            resource_type=resource_type,
            deleted_at__isnull=True,
        ).order_by("sort_order", "name", "id").all()

        items: List[ResourceCategoryResponse] = []
        for category in categories:
            count = await self._count_items(tenant_id, resource_type, category.id)
            items.append(self._build_response(category, count))

        total_count = await self._count_items(tenant_id, resource_type)
        uncategorized_count = await self._count_items(
            tenant_id,
            resource_type,
            uncategorized_only=True,
        )
        return {
            "items": items,
            "total_count": total_count,
            "uncategorized_count": uncategorized_count,
        }

    async def ensure_category_by_code(
        self,
        tenant_id: int,
        resource_type: str,
        *,
        code: str,
        name: str,
        description: Optional[str] = None,
        sort_order: int = 0,
    ) -> ResourceCategory:
        """按 code 获取或创建分类（接口库加载等场景）。"""
        resource_type = self._assert_resource_type(resource_type)
        normalized_code = str(code or "").strip()
        if not normalized_code:
            raise ValidationError("分类代码不能为空")

        existing = await ResourceCategory.filter(
            tenant_id=tenant_id,
            resource_type=resource_type,
            code=normalized_code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            return existing

        return await ResourceCategory.create(
            tenant_id=tenant_id,
            resource_type=resource_type,
            code=normalized_code,
            name=name,
            description=description,
            sort_order=sort_order,
            is_active=True,
        )

    async def create_category(
        self,
        tenant_id: int,
        resource_type: str,
        data: ResourceCategoryCreate,
    ) -> ResourceCategory:
        resource_type = self._assert_resource_type(resource_type)
        existing = await ResourceCategory.filter(
            tenant_id=tenant_id,
            resource_type=resource_type,
            code=data.code,
            deleted_at__isnull=True,
        ).first()
        if existing:
            raise ValidationError(f"分类代码 '{data.code}' 已存在")

        return await ResourceCategory.create(
            tenant_id=tenant_id,
            resource_type=resource_type,
            **data.model_dump(),
        )

    async def update_category(
        self,
        tenant_id: int,
        resource_type: str,
        category_uuid: UUID,
        data: ResourceCategoryUpdate,
    ) -> ResourceCategory:
        resource_type = self._assert_resource_type(resource_type)
        category = await self.get_category_by_uuid(tenant_id, resource_type, category_uuid)

        if data.code and data.code != category.code:
            existing = await ResourceCategory.filter(
                tenant_id=tenant_id,
                resource_type=resource_type,
                code=data.code,
                deleted_at__isnull=True,
            ).exclude(uuid=category_uuid).first()
            if existing:
                raise ValidationError(f"分类代码 '{data.code}' 已存在")

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(category, key, value)
        await category.save()
        return category

    async def delete_category(
        self,
        tenant_id: int,
        resource_type: str,
        category_uuid: UUID,
    ) -> None:
        resource_type = self._assert_resource_type(resource_type)
        category = await self.get_category_by_uuid(tenant_id, resource_type, category_uuid)
        model = self._resource_model(resource_type)

        await model.filter(
            tenant_id=tenant_id,
            category_id=category.id,
            deleted_at__isnull=True,
        ).update(category_id=None)

        category.deleted_at = resolve_business_datetime()
        await category.save()
