"""
知识库 API

Author: RiverEdge Team
Date: 2026-05-28
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from loguru import logger

from apps.kuaiplm.schemas.knowledge_base import (
    KbArticleCreate,
    KbArticleResponse,
    KbArticleUpdate,
    KbSearchResponse,
    KbSpaceCreate,
    KbSpaceResponse,
    KbSpaceUpdate,
)
from apps.kuaiplm.services.kb_service import KbService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/knowledge", tags=["App · Kuaiplm · Knowledge"])
service = KbService()


def _err(status_code: int, message: str, route: str) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning("kuaiplm_knowledge_api_error trace_id={} route={} message={}", trace_id, route, message)
    return HTTPException(status_code=status_code, detail={"message": message, "trace_id": trace_id})


@router.get("/spaces", summary="List KB spaces")
async def list_spaces(
    include_inactive: bool = Query(False),
    _auth=Depends(require_access("kuaiplm.knowledge", "read", required_permissions=["kuaiplm:knowledge:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_spaces(tenant_id, include_inactive=include_inactive)
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/spaces", response_model=KbSpaceResponse, status_code=status.HTTP_201_CREATED, summary="Create space")
async def create_space(
    data: KbSpaceCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "create", required_permissions=["kuaiplm:knowledge:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.create_space(tenant_id, data, current_user.id)


@router.put("/spaces/{space_id}", response_model=KbSpaceResponse, summary="Update space")
async def update_space(
    data: KbSpaceUpdate,
    space_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "update", required_permissions=["kuaiplm:knowledge:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_space(tenant_id, space_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/knowledge/spaces/{space_id}")


@router.delete("/spaces/{space_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete space")
async def delete_space(
    space_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "delete", required_permissions=["kuaiplm:knowledge:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_space(tenant_id, space_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/knowledge/spaces/{space_id}")


@router.get("/articles", summary="List articles")
async def list_articles(
    space_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    _auth=Depends(require_access("kuaiplm.knowledge", "read", required_permissions=["kuaiplm:knowledge:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows, total = await service.list_articles(
        tenant_id,
        space_id=space_id,
        status=status,
        keyword=keyword,
        tag=tag,
        skip=skip,
        limit=limit,
    )
    return {"data": rows, "total": total, "success": True}


@router.get("/articles/search", response_model=KbSearchResponse, summary="Search articles")
async def search_articles(
    keyword: str = Query(..., min_length=1),
    space_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _auth=Depends(require_access("kuaiplm.knowledge", "read", required_permissions=["kuaiplm:knowledge:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    return await service.search_articles(tenant_id, keyword, space_id=space_id, limit=limit)


@router.post("/articles", response_model=KbArticleResponse, status_code=status.HTTP_201_CREATED, summary="Create article")
async def create_article(
    data: KbArticleCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "create", required_permissions=["kuaiplm:knowledge:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.create_article(tenant_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), "/knowledge/articles")


@router.get("/articles/{article_id}", response_model=KbArticleResponse, summary="Get article")
async def get_article(
    article_id: int = Path(...),
    _auth=Depends(require_access("kuaiplm.knowledge", "read", required_permissions=["kuaiplm:knowledge:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.get_article(tenant_id, article_id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/knowledge/articles/{article_id}")


@router.put("/articles/{article_id}", response_model=KbArticleResponse, summary="Update article")
async def update_article(
    data: KbArticleUpdate,
    article_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "update", required_permissions=["kuaiplm:knowledge:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await service.update_article(tenant_id, article_id, data, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/knowledge/articles/{article_id}")


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete article")
async def delete_article(
    article_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaiplm.knowledge", "delete", required_permissions=["kuaiplm:knowledge:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_article(tenant_id, article_id, current_user.id)
    except NotFoundError as e:
        raise _err(404, str(e), f"/knowledge/articles/{article_id}")
