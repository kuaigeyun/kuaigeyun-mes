"""
知识库服务

Author: RiverEdge Team
Date: 2026-05-28
"""

from datetime import datetime
from typing import List, Optional

from tortoise.expressions import Q
from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit, operator_name_from_user
from apps.common.base_service import AppBaseService
from apps.kuaiplm.models import KbArticle, KbArticleLink, KbSpace
from apps.kuaiplm.schemas.knowledge_base import (
    KbArticleCreate,
    KbArticleLinkResponse,
    KbArticleResponse,
    KbArticleUpdate,
    KbSearchResponse,
    KbSpaceCreate,
    KbSpaceResponse,
    KbSpaceUpdate,
)
from infra.exceptions.exceptions import NotFoundError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime


class KbService(AppBaseService[KbSpace]):
    def __init__(self):
        super().__init__(KbSpace)

    async def list_spaces(self, tenant_id: int, include_inactive: bool = False) -> List[KbSpaceResponse]:
        qs = KbSpace.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if not include_inactive:
            qs = qs.filter(is_active=True)
        rows = await qs.order_by("parent_space_id", "sort_order", "id").all()
        return [KbSpaceResponse.model_validate(r) for r in rows]

    async def create_space(self, tenant_id: int, data: KbSpaceCreate, created_by: int) -> KbSpaceResponse:
        user = await User.filter(id=created_by).first()
        payload = {
            "tenant_id": tenant_id,
            "space_code": data.space_code,
            "space_name": data.space_name,
            "description": data.description,
            "parent_space_id": data.parent_space_id,
            "sort_order": data.sort_order,
            "is_active": data.is_active,
        }
        apply_create_audit(payload, user)
        row = await KbSpace.create(**payload)
        return KbSpaceResponse.model_validate(row)

    async def update_space(
        self, tenant_id: int, space_id: int, data: KbSpaceUpdate, updated_by: int
    ) -> KbSpaceResponse:
        row = await KbSpace.get_or_none(tenant_id=tenant_id, id=space_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError(f"知识空间不存在: {space_id}")
        update_fields = {}
        for field in ("space_name", "description", "parent_space_id", "sort_order", "is_active"):
            val = getattr(data, field, None)
            if val is not None:
                update_fields[field] = val
        for key, value in update_fields.items():
            setattr(row, key, value)
        user = await User.filter(id=updated_by).first()
        apply_update_audit(row, user)
        await row.save()
        return KbSpaceResponse.model_validate(row)

    async def delete_space(self, tenant_id: int, space_id: int, deleted_by: int) -> None:
        row = await KbSpace.get_or_none(tenant_id=tenant_id, id=space_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError(f"知识空间不存在: {space_id}")
        row.deleted_at = resolve_business_datetime()
        user = await User.filter(id=deleted_by).first()
        apply_update_audit(row, user)
        await row.save()

    async def _build_article_response(
        self, tenant_id: int, article: KbArticle, space_name: Optional[str] = None
    ) -> KbArticleResponse:
        links = await KbArticleLink.filter(tenant_id=tenant_id, article_id=article.id).all()
        resolved_space_name = space_name
        if resolved_space_name is None:
            space = await KbSpace.get_or_none(
                tenant_id=tenant_id, id=article.space_id, deleted_at__isnull=True
            )
            resolved_space_name = getattr(space, "space_name", None)
        return KbArticleResponse.model_validate({
            **{k: getattr(article, k) for k in article._meta.fields_map if hasattr(article, k)},
            "space_name": resolved_space_name,
            "links": [KbArticleLinkResponse.model_validate(l) for l in links],
        })

    async def list_articles(
        self,
        tenant_id: int,
        space_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
        tag: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[KbArticleResponse], int]:
        qs = KbArticle.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if space_id:
            qs = qs.filter(space_id=space_id)
        if status:
            qs = qs.filter(status=status)
        if keyword:
            qs = qs.filter(Q(title__icontains=keyword) | Q(content__icontains=keyword))
        if tag:
            qs = qs.filter(tags__contains=[tag])
        total = await qs.count()
        rows = await qs.order_by("-updated_at").offset(skip).limit(limit).all()
        space_name_map = {
            s.id: s.space_name
            for s in await KbSpace.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                id__in=list({row.space_id for row in rows if row.space_id is not None}),
            )
        }
        out: List[KbArticleResponse] = []
        for row in rows:
            out.append(await self._build_article_response(tenant_id, row, space_name_map.get(row.space_id)))
        return out, total

    async def get_article(self, tenant_id: int, article_id: int) -> KbArticleResponse:
        row = await KbArticle.get_or_none(tenant_id=tenant_id, id=article_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError(f"文章不存在: {article_id}")
        return await self._build_article_response(tenant_id, row)

    async def create_article(self, tenant_id: int, data: KbArticleCreate, created_by: int) -> KbArticleResponse:
        space = await KbSpace.get_or_none(tenant_id=tenant_id, id=data.space_id, deleted_at__isnull=True)
        if not space:
            raise NotFoundError(f"知识空间不存在: {data.space_id}")
        user = await User.filter(id=created_by).first()
        author_name = operator_name_from_user(user) or await self.get_user_name(created_by)
        async with in_transaction():
            article_payload = {
                "tenant_id": tenant_id,
                "space_id": data.space_id,
                "article_code": data.article_code,
                "title": data.title,
                "content": data.content,
                "status": data.status,
                "tags": data.tags,
                "author_id": created_by,
                "author_name": author_name,
            }
            apply_create_audit(article_payload, user)
            article = await KbArticle.create(**article_payload)
            for link in data.links:
                await KbArticleLink.create(
                    tenant_id=tenant_id,
                    article_id=article.id,
                    link_type=link.link_type,
                    target_type=link.target_type,
                    target_id=link.target_id,
                    target_uuid=link.target_uuid,
                    target_code=link.target_code,
                    target_name=link.target_name,
                )
        return await self.get_article(tenant_id, article.id)

    async def update_article(
        self, tenant_id: int, article_id: int, data: KbArticleUpdate, updated_by: int
    ) -> KbArticleResponse:
        row = await KbArticle.get_or_none(tenant_id=tenant_id, id=article_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError(f"文章不存在: {article_id}")
        for field in ("title", "content", "status", "tags", "space_id"):
            val = getattr(data, field, None)
            if val is not None:
                setattr(row, field, val)
        user = await User.filter(id=updated_by).first()
        apply_update_audit(row, user)
        await row.save()
        return await self.get_article(tenant_id, article_id)

    async def delete_article(self, tenant_id: int, article_id: int, deleted_by: int) -> None:
        row = await KbArticle.get_or_none(tenant_id=tenant_id, id=article_id, deleted_at__isnull=True)
        if not row:
            raise NotFoundError(f"文章不存在: {article_id}")
        row.deleted_at = resolve_business_datetime()
        user = await User.filter(id=deleted_by).first()
        apply_update_audit(row, user)
        await row.save()

    async def search_articles(
        self, tenant_id: int, keyword: str, space_id: Optional[int] = None, limit: int = 20
    ) -> KbSearchResponse:
        qs = KbArticle.filter(tenant_id=tenant_id, deleted_at__isnull=True).filter(
            Q(title__icontains=keyword) | Q(content__icontains=keyword)
        )
        if space_id:
            qs = qs.filter(space_id=space_id)
        total = await qs.count()
        rows = await qs.order_by("-updated_at").limit(limit).all()
        articles = [await self._build_article_response(tenant_id, r) for r in rows]
        return KbSearchResponse(articles=articles, total=total)
