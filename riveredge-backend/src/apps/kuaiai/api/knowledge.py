"""KU-AI 知识库 API。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from apps.kuaiai.services.knowledge_service import KnowledgeService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/knowledge", tags=["App · KU-AI · Knowledge"])


class TextDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    content: str = Field(..., min_length=1)


class FaqDocumentCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)


class FileDocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=300)
    file_uuid: str = Field(..., min_length=1, max_length=36)


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=300)
    content: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    is_active: Optional[bool] = None


def _http_error(exc: Exception):
    from fastapi import HTTPException

    if isinstance(exc, NotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, ValidationError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get(
    "",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:read"))],
)
async def list_knowledge_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, Any]:
    return await KnowledgeService.list_documents(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        source_type=source_type,
        status=status_filter,
    )


@router.get(
    "/search",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:read"))],
)
async def search_knowledge(
    q: str = Query(..., min_length=1),
    top_k: int = Query(5, ge=1, le=20),
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, Any]:
    items = await KnowledgeService.search_chunks(tenant_id=tenant_id, query=q, top_k=top_k)
    return {"items": items, "total": len(items)}


@router.post(
    "/seed-defaults",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:create"))],
)
async def seed_default_faq_documents(
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """为当前租户补写出厂默认 FAQ（已存在则跳过）。"""
    from apps.kuaiai.services.faq_seed_service import FaqSeedService

    created = await FaqSeedService.seed_default_faqs(
        tenant_id,
        user_id=current_user.id,
    )
    return {"created": created}


@router.get(
    "/{document_id}",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:read"))],
)
async def get_knowledge_document(
    document_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, Any]:
    try:
        return await KnowledgeService.get_document(tenant_id=tenant_id, document_id=document_id)
    except NotFoundError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/text",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:create"))],
)
async def create_text_document(
    body: TextDocumentCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await KnowledgeService.create_text_document(
            tenant_id=tenant_id,
            title=body.title,
            content=body.content,
            user_id=current_user.id,
        )
    except ValidationError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/faq",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:create"))],
)
async def create_faq_document(
    body: FaqDocumentCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await KnowledgeService.create_faq_document(
            tenant_id=tenant_id,
            title=body.title or body.question,
            question=body.question,
            answer=body.answer,
            user_id=current_user.id,
        )
    except ValidationError as exc:
        raise _http_error(exc) from exc


@router.post(
    "/file",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:create"))],
)
async def create_file_document(
    body: FileDocumentCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await KnowledgeService.create_file_document(
            tenant_id=tenant_id,
            title=body.title,
            file_uuid=body.file_uuid,
            user_id=current_user.id,
        )
    except ValidationError as exc:
        raise _http_error(exc) from exc


@router.put(
    "/{document_id}",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:update"))],
)
async def update_knowledge_document(
    document_id: int,
    body: DocumentUpdate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await KnowledgeService.update_document(
            tenant_id=tenant_id,
            document_id=document_id,
            title=body.title,
            content=body.content,
            question=body.question,
            answer=body.answer,
            is_active=body.is_active,
            user_id=current_user.id,
        )
    except (NotFoundError, ValidationError) as exc:
        raise _http_error(exc) from exc


@router.post(
    "/{document_id}/reindex",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:update"))],
)
async def reindex_knowledge_document(
    document_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, Any]:
    try:
        await KnowledgeService.index_document(tenant_id=tenant_id, document_id=document_id)
        return await KnowledgeService.get_document(tenant_id=tenant_id, document_id=document_id)
    except (NotFoundError, ValidationError) as exc:
        raise _http_error(exc) from exc


@router.delete(
    "/{document_id}",
    dependencies=[Depends(require_permission_codes("kuaiai:knowledge:delete"))],
)
async def delete_knowledge_document(
    document_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, bool]:
    try:
        await KnowledgeService.delete_document(tenant_id=tenant_id, document_id=document_id)
        return {"success": True}
    except NotFoundError as exc:
        raise _http_error(exc) from exc
