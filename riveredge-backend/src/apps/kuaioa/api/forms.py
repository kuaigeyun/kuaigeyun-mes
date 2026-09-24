"""审批表单 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.constants.general_signoff_business_types import (
    list_general_signoff_business_types,
)
from apps.kuaioa.schemas.forms import (
    FormRequestCreate,
    FormRequestUpdate,
    FormTemplateCreate,
    FormTemplateUpdate,
)
from apps.kuaioa.services.form_service import FormRequestService, FormTemplateService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

router = APIRouter(prefix="/forms", tags=["App - Kuaioa - Forms"])
template_service = FormTemplateService()
request_service = FormRequestService()


@router.get("/business-types", summary="List general signoff business types")
async def list_form_business_types(
    _auth=Depends(require_permission_codes("kuaioa:form-template:read")),
):
    rows = list_general_signoff_business_types()
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/templates", summary="List form templates")
async def list_form_templates(
    keyword: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    business_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:form-template:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await template_service.list_templates(
        tenant_id,
        keyword=keyword,
        category=category,
        business_type=business_type,
        is_active=is_active,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.post("/templates", status_code=status.HTTP_201_CREATED, summary="Create form template")
async def create_form_template(
    data: FormTemplateCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-template:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.create_template(tenant_id, data, current_user)
        return {"data": row, "success": True}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={"message": str(e)})


@router.get("/templates/by-code/{template_code}", summary="Get form template by code")
async def get_form_template_by_code(
    template_code: str = Path(..., min_length=1, max_length=50),
    _auth=Depends(require_permission_codes("kuaioa:form-request:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.get_template_by_code(tenant_id, template_code)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.get("/templates/{template_id}", summary="Get form template")
async def get_form_template(
    template_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:form-template:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.get_template(tenant_id, template_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.put("/templates/{template_id}", summary="Update form template")
async def update_form_template(
    data: FormTemplateUpdate,
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-template:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await template_service.update_template(tenant_id, template_id, data, current_user)
        return {"data": row, "success": True}
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail={"message": str(e)})
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.delete("/templates/{template_id}", summary="Delete form template")
async def delete_form_template(
    template_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-template:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await template_service.delete_template(tenant_id, template_id, current_user)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.get("/requests", summary="List form requests")
async def list_form_requests(
    keyword: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    template_id: Optional[int] = Query(None),
    business_type: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:form-request:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await request_service.list_requests(
        tenant_id,
        keyword=keyword,
        status=status_filter,
        template_id=template_id,
        business_type=business_type,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/requests/{request_id}", summary="Get form request")
async def get_form_request(
    request_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:form-request:read")),
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
    _auth=Depends(require_permission_codes("kuaioa:form-request:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    row = await request_service.create_request(tenant_id, data, current_user)
    return {"data": row, "success": True}


@router.put("/requests/{request_id}", summary="Update form request")
async def update_form_request(
    data: FormRequestUpdate,
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-request:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.update_request(tenant_id, request_id, data, current_user)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.delete("/requests/{request_id}", summary="Delete form request")
async def delete_form_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-request:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await request_service.delete_request(tenant_id, request_id, current_user)
        return {"success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})


@router.post("/requests/{request_id}/submit", summary="Submit form request")
async def submit_form_request(
    request_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:form-request:submit")),
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
    _auth=Depends(require_permission_codes("kuaioa:form-request:revoke")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await request_service.revoke_request(tenant_id, request_id, current_user.id)
        return {"data": row, "success": True}
    except (NotFoundError, BusinessLogicError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, NotFoundError) else status.HTTP_409_CONFLICT
        raise HTTPException(status_code=code, detail={"message": str(e)})
