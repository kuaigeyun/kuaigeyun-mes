"""交付流程模板 API"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Path, Query, status

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.delivery_project import (
    DeliveryProcessTemplateCreate,
    DeliveryProcessTemplateListEnvelope,
    DeliveryProcessTemplateResponse,
    DeliveryProcessTemplateUpdate,
)
from apps.kuaizhizao.services.delivery_process_template_service import DeliveryProcessTemplateService
from core.api.deps import get_current_user, get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(
    prefix="/delivery-process-templates",
    tags=["App - Kuaige Zhizao - Delivery Process Templates"],
    dependencies=[Depends(require_kuaizhizao_module_access("delivery-process-template"))],
)

_service = DeliveryProcessTemplateService()


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": uuid.uuid4().hex},
    )


@router.post("", response_model=DeliveryProcessTemplateResponse, summary="Create process template")
async def create_template(
    body: DeliveryProcessTemplateCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.create_template(tenant_id, body, current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("", response_model=DeliveryProcessTemplateListEnvelope, summary="List process templates")
async def list_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    active_only: bool = Query(False),
    keyword: Optional[str] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await _service.list_templates(
        tenant_id, skip=skip, limit=limit, active_only=active_only, keyword=keyword
    )


@router.get("/{template_id:int}", response_model=DeliveryProcessTemplateResponse, summary="Get process template")
async def get_template(
    template_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.get_template(tenant_id, template_id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put("/{template_id:int}", response_model=DeliveryProcessTemplateResponse, summary="Update process template")
async def update_template(
    body: DeliveryProcessTemplateUpdate,
    template_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.update_template(tenant_id, template_id, body, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/{template_id:int}", summary="Delete process template")
async def delete_template(
    template_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await _service.delete_template(tenant_id, template_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{template_id:int}/set-default", response_model=DeliveryProcessTemplateResponse, summary="Set default template")
async def set_default_template(
    template_id: int = Path(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await _service.set_default(tenant_id, template_id, current_user)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
