"""审批表单 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.forms import (
    FormRequestCreate,
    FormRequestUpdate,
    FormTemplateCreate,
    FormTemplateUpdate,
)
from apps.kuaioa.services.form_service import FormRequestService, FormTemplateService
from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/forms", tags=["App - Kuaioa - Forms"])
template_service = FormTemplateService()
request_service = FormRequestService()


@router.get("/templates", summary="List form templates")
async def list_form_templates(
    keyword: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    _auth=Depends(require_access("kuaioa.form-template", "read", required_permissions=["kuaioa:form-template:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await template_service.list_templates(
        tenant_id, keyword=keyword, category=category, is_active=is_active
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create form template")
async def create_form_template(
    data: FormTemplateCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-template", "create", required_permissions=["kuaioa:form-template:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.create_template(tenant_id, data, current_user.id)
        return {"data": row, "success": True}
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.put("/templates/{template_id}", summary="Update form template")
async def update_form_template(
    data: FormTemplateUpdate,
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-template", "update", required_permissions=["kuaioa:form-template:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.update_template(tenant_id, template_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/templates/{template_id}", summary="Delete form template")
async def delete_form_template(
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-template", "delete", required_permissions=["kuaioa:form-template:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await template_service.delete_template(tenant_id, template_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.get("/requests", summary="List form requests")
async def list_form_requests(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    template_id: Optional[int] = Query(None),
    _auth=Depends(require_access("kuaioa.form-request", "read", required_permissions=["kuaioa:form-request:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await request_service.list_requests(
        tenant_id, keyword=keyword, status=status_filter, template_id=template_id
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/requests/{request_id}", summary="Get form request")
async def get_form_request(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_access("kuaioa.form-request", "read", required_permissions=["kuaioa:form-request:read"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.get_request(tenant_id, request_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/requests", status_code=status.HTTP_201_CREATED, summary="Create form request")
async def create_form_request(
    data: FormRequestCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-request", "create", required_permissions=["kuaioa:form-request:create"])),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await request_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/requests/{request_id}", summary="Update form request")
async def update_form_request(
    data: FormRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-request", "update", required_permissions=["kuaioa:form-request:update"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.update_request(tenant_id, request_id, data, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/requests/{request_id}", summary="Delete form request")
async def delete_form_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-request", "delete", required_permissions=["kuaioa:form-request:delete"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await request_service.delete_request(tenant_id, request_id, current_user.id)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/submit", summary="Submit form request")
async def submit_form_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-request", "submit", required_permissions=["kuaioa:form-request:submit"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.submit_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/revoke", summary="Revoke form request")
async def revoke_form_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_access("kuaioa.form-request", "revoke", required_permissions=["kuaioa:form-request:revoke"])),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})
