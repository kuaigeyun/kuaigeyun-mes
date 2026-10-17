"""视觉方案与版本服务。"""

from __future__ import annotations

from typing import List, Optional, Tuple

from tortoise.expressions import Q

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.kuaivision.models.vision import VisionModelArtifact, VisionRecipe, VisionRecipeVersion
from apps.kuaivision.schemas.vision import (
    RecipeCreate,
    RecipeListItem,
    RecipeResponse,
    RecipeUpdate,
    RecipeVersionCreate,
    RecipeVersionOut,
    RecipeVersionUpdate,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


class RecipeService:
    @staticmethod
    async def _resolve_model_id(tenant_id: int, model_uuid: Optional[str]) -> Optional[int]:
        if not model_uuid:
            return None
        art = await VisionModelArtifact.get_or_none(
            tenant_id=tenant_id, uuid=model_uuid, deleted_at__isnull=True
        )
        if not art:
            raise ValidationError("绑定的模型制品不存在")
        return int(art.id)

    @staticmethod
    async def _version_out(v: VisionRecipeVersion) -> RecipeVersionOut:
        model_uuid = None
        model_code = None
        if v.model_artifact_id:
            art = await VisionModelArtifact.get_or_none(
                tenant_id=v.tenant_id, id=v.model_artifact_id, deleted_at__isnull=True
            )
            if art:
                model_uuid = art.uuid
                model_code = art.code
        return RecipeVersionOut(
            uuid=v.uuid,
            id=v.id,
            version=v.version,
            status=v.status,
            params=v.params,
            model_artifact_id=v.model_artifact_id,
            model_artifact_uuid=model_uuid,
            model_artifact_code=model_code,
            require_model=bool(getattr(v, "require_model", False)),
            published_at=v.published_at,
            published_by_name=v.published_by_name,
            remark=v.remark,
            created_at=v.created_at,
            updated_at=v.updated_at,
        )

    @staticmethod
    async def _published_version(tenant_id: int, recipe_id: int) -> Optional[VisionRecipeVersion]:
        return await VisionRecipeVersion.get_or_none(
            tenant_id=tenant_id,
            recipe_id=recipe_id,
            status="published",
            deleted_at__isnull=True,
        )

    @staticmethod
    async def _to_list_item(recipe: VisionRecipe) -> RecipeListItem:
        pub = await RecipeService._published_version(recipe.tenant_id, recipe.id)
        return RecipeListItem(
            uuid=recipe.uuid,
            id=recipe.id,
            code=recipe.code,
            name=recipe.name,
            recipe_type=recipe.recipe_type,
            review_threshold=recipe.review_threshold,
            default_camera_code=recipe.default_camera_code,
            trigger_mode=recipe.trigger_mode or "manual",
            trigger_interval_seconds=recipe.trigger_interval_seconds,
            is_enabled=recipe.is_enabled,
            published_version=pub.version if pub else None,
            remark=recipe.remark,
            created_by_name=recipe.created_by_name,
            updated_by_name=recipe.updated_by_name,
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )

    @staticmethod
    async def get_detail(tenant_id: int, uuid: str) -> RecipeResponse:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        versions = await VisionRecipeVersion.filter(
            tenant_id=tenant_id, recipe_id=recipe.id, deleted_at__isnull=True
        ).order_by("-id")
        pub = next((v for v in versions if v.status == "published"), None)
        return RecipeResponse(
            uuid=recipe.uuid,
            id=recipe.id,
            code=recipe.code,
            name=recipe.name,
            recipe_type=recipe.recipe_type,
            review_threshold=recipe.review_threshold,
            default_camera_code=recipe.default_camera_code,
            trigger_mode=recipe.trigger_mode or "manual",
            trigger_interval_seconds=recipe.trigger_interval_seconds,
            is_enabled=recipe.is_enabled,
            remark=recipe.remark,
            published_version=pub.version if pub else None,
            versions=[await RecipeService._version_out(v) for v in versions],
            created_by_name=recipe.created_by_name,
            updated_by_name=recipe.updated_by_name,
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )

    @staticmethod
    async def list_recipes(
        tenant_id: int,
        *,
        page: int = 1,
        page_size: int = 20,
        q: Optional[str] = None,
        recipe_type: Optional[str] = None,
    ) -> Tuple[List[RecipeListItem], int]:
        qs = VisionRecipe.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if recipe_type:
            qs = qs.filter(recipe_type=recipe_type)
        if q:
            qs = qs.filter(Q(code__icontains=q) | Q(name__icontains=q))
        total = await qs.count()
        rows = await qs.order_by("-id").offset((page - 1) * page_size).limit(page_size)
        items = [await RecipeService._to_list_item(r) for r in rows]
        return items, total

    @staticmethod
    async def create(tenant_id: int, data: RecipeCreate, user: Optional[User]) -> RecipeResponse:
        if data.recipe_type not in {"thickness_measure", "step_compliance"}:
            raise ValidationError("recipe_type 仅允许 thickness_measure / step_compliance")
        exists = await VisionRecipe.filter(tenant_id=tenant_id, code=data.code, deleted_at__isnull=True).exists()
        if exists:
            raise ValidationError(f"方案编码已存在：{data.code}")
        recipe = VisionRecipe(
            tenant_id=tenant_id,
            code=data.code.strip(),
            name=data.name.strip(),
            recipe_type=data.recipe_type,
            review_threshold=data.review_threshold,
            default_camera_code=data.default_camera_code,
            trigger_mode=data.trigger_mode or "manual",
            trigger_interval_seconds=data.trigger_interval_seconds,
            is_enabled=data.is_enabled,
            remark=data.remark,
        )
        apply_create_audit(recipe, user)
        await recipe.save()
        ver = VisionRecipeVersion(
            tenant_id=tenant_id,
            recipe_id=recipe.id,
            version=(data.version or "1.0").strip(),
            status="draft",
            params=data.params or {},
        )
        apply_create_audit(ver, user)
        await ver.save()
        return await RecipeService.get_detail(tenant_id, recipe.uuid)

    @staticmethod
    async def update(tenant_id: int, uuid: str, data: RecipeUpdate, user: Optional[User]) -> RecipeResponse:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        for key, value in data.model_dump(exclude_unset=True).items():
            setattr(recipe, key, value)
        apply_update_audit(recipe, user)
        await recipe.save()
        return await RecipeService.get_detail(tenant_id, recipe.uuid)

    @staticmethod
    async def soft_delete(tenant_id: int, uuid: str, user: Optional[User]) -> None:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        recipe.deleted_at = resolve_business_datetime()
        apply_update_audit(recipe, user)
        await recipe.save()

    @staticmethod
    async def add_version(
        tenant_id: int, recipe_uuid: str, data: RecipeVersionCreate, user: Optional[User]
    ) -> RecipeResponse:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=recipe_uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        version = data.version.strip()
        exists = await VisionRecipeVersion.filter(
            tenant_id=tenant_id, recipe_id=recipe.id, version=version, deleted_at__isnull=True
        ).exists()
        if exists:
            raise ValidationError(f"版本已存在：{version}")
        model_id = await RecipeService._resolve_model_id(tenant_id, data.model_artifact_uuid)
        ver = VisionRecipeVersion(
            tenant_id=tenant_id,
            recipe_id=recipe.id,
            version=version,
            status="draft",
            params=data.params or {},
            model_artifact_id=model_id,
            require_model=bool(data.require_model),
            remark=data.remark,
        )
        apply_create_audit(ver, user)
        await ver.save()
        return await RecipeService.get_detail(tenant_id, recipe.uuid)

    @staticmethod
    async def update_version(
        tenant_id: int,
        recipe_uuid: str,
        version_uuid: str,
        data: RecipeVersionUpdate,
        user: Optional[User],
    ) -> RecipeResponse:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=recipe_uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        ver = await VisionRecipeVersion.get_or_none(
            tenant_id=tenant_id, uuid=version_uuid, recipe_id=recipe.id, deleted_at__isnull=True
        )
        if not ver:
            raise NotFoundError("方案版本不存在")
        if ver.status != "draft":
            raise ValidationError("仅草稿版本可编辑参数")
        payload = data.model_dump(exclude_unset=True)
        if "model_artifact_uuid" in payload:
            ver.model_artifact_id = await RecipeService._resolve_model_id(
                tenant_id, payload.pop("model_artifact_uuid")
            )
        for key, value in payload.items():
            setattr(ver, key, value)
        apply_update_audit(ver, user)
        await ver.save()
        return await RecipeService.get_detail(tenant_id, recipe.uuid)

    @staticmethod
    async def publish_version(
        tenant_id: int, recipe_uuid: str, version_uuid: str, user: Optional[User]
    ) -> RecipeResponse:
        recipe = await VisionRecipe.get_or_none(tenant_id=tenant_id, uuid=recipe_uuid, deleted_at__isnull=True)
        if not recipe:
            raise NotFoundError("视觉方案不存在")
        ver = await VisionRecipeVersion.get_or_none(
            tenant_id=tenant_id, uuid=version_uuid, recipe_id=recipe.id, deleted_at__isnull=True
        )
        if not ver:
            raise NotFoundError("方案版本不存在")
        if ver.status == "published":
            return await RecipeService.get_detail(tenant_id, recipe.uuid)
        params = ver.params or {}
        require_model = bool(getattr(ver, "require_model", False) or params.get("require_model"))
        if recipe.recipe_type == "step_compliance" and require_model and not ver.model_artifact_id:
            raise ValidationError("步骤方案声明需模型时，发布前须绑定模型制品")
        now = resolve_business_datetime()
        old_pubs = await VisionRecipeVersion.filter(
            tenant_id=tenant_id, recipe_id=recipe.id, status="published", deleted_at__isnull=True
        )
        for old in old_pubs:
            old.status = "obsolete"
            apply_update_audit(old, user)
            await old.save()
        ver.status = "published"
        ver.published_at = now
        if user is not None:
            ver.published_by = int(user.id)
            ver.published_by_name = operator_name_from_user(user)
        apply_update_audit(ver, user)
        await ver.save()
        return await RecipeService.get_detail(tenant_id, recipe.uuid)

    @staticmethod
    async def find_published(
        tenant_id: int, recipe_code: str, version: Optional[str] = None
    ) -> Optional[VisionRecipeVersion]:
        recipe = await VisionRecipe.get_or_none(
            tenant_id=tenant_id, code=recipe_code, deleted_at__isnull=True, is_enabled=True
        )
        if not recipe:
            return None
        qs = VisionRecipeVersion.filter(
            tenant_id=tenant_id,
            recipe_id=recipe.id,
            status="published",
            deleted_at__isnull=True,
        )
        if version:
            qs = qs.filter(version=version)
        return await qs.first()
