"""好力 GO — 维保完成单打印 API。"""

from __future__ import annotations

import base64
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, Response

from apps.haoligo.api._print_access import (
    ensure_haoligo_document_print_access,
    ensure_haoligo_print_preset_loader,
)
from apps.haoligo.services.print_service import (
    DOCUMENT_TEMPLATE_CODES,
    HaoligoDocumentPrintService,
    SUPPORTED_DOCUMENT_TYPES,
)
from core.api.deps.access import AuthContext, get_auth_context
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/print",
    tags=["App · HaoliGO · 打印"],
)

def _print_user_label(user: User) -> str:
    return (getattr(user, "full_name", None) or getattr(user, "username", None) or "").strip()


@router.get(
    "/documents/{document_type}/{document_id}",
    summary="打印维保/维修完成单",
)
async def print_haoligo_document(
    document_type: str,
    document_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
    template_code: Optional[str] = Query(None, description="打印模板 code"),
    template_uuid: Optional[str] = Query(None, description="打印模板 UUID"),
    output_format: str = Query("html", description="html 或 pdf"),
    response_format: str = Query("json", description="json 或 html"),
):
    if document_type not in SUPPORTED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的单据类型，可选：{', '.join(sorted(SUPPORTED_DOCUMENT_TYPES))}",
        )
    await ensure_haoligo_document_print_access(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        document_type=document_type,
        document_id=document_id,
    )
    svc = HaoligoDocumentPrintService()
    try:
        result = await svc.print_document(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
            print_user=_print_user_label(user),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e

    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="haoligo-{document_type}-{document_id}.pdf"'},
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get(
    "/documents/{document_type}/{document_id}/variables",
    summary="维保完成单打印变量（设计器预览）",
)
async def get_haoligo_print_variables(
    document_type: str,
    document_id: int,
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    user: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    if document_type not in SUPPORTED_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的单据类型，可选：{', '.join(sorted(SUPPORTED_DOCUMENT_TYPES))}",
        )
    await ensure_haoligo_document_print_access(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
        document_type=document_type,
        document_id=document_id,
    )
    svc = HaoligoDocumentPrintService()
    try:
        variables = await svc.get_document_variables_for_print(
            tenant_id,
            document_type,
            document_id,
            print_user=_print_user_label(user),
        )
        return {
            "success": True,
            "document_type": document_type,
            "template_code": DOCUMENT_TEMPLATE_CODES.get(document_type),
            "variables": variables,
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/load-presets", summary="加载好力 GO 维保完成单打印模板预设")
async def load_haoligo_print_presets(
    request: Request,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    _: Annotated[User, Depends(get_current_user)],
    auth: Annotated[AuthContext, Depends(get_auth_context)],
):
    await ensure_haoligo_print_preset_loader(
        auth=auth,
        tenant_id=tenant_id,
        request=request,
    )
    from apps.haoligo.services.print_template_presets import load_haoligo_print_template_presets

    created = await load_haoligo_print_template_presets(tenant_id)
    return {"success": True, "created": created}
