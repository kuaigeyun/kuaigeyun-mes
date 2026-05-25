"""
工程图纸 API 模块
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status

from apps.master_data.schemas.drawing_schemas import (
    EngineeringDrawingCreate,
    EngineeringDrawingListResponse,
    EngineeringDrawingObsoleteRequest,
    EngineeringDrawingResponse,
    EngineeringDrawingRevisionCreate,
    EngineeringDrawingUpdate,
)
from apps.master_data.services.drawing_service import DrawingService
from core.api.deps.access import require_module_access
from core.api.deps.deps import get_current_tenant, get_current_user
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from loguru import logger

router = APIRouter(
    prefix="/process/drawings",
    tags=["App · Master Data · Drawings"],
    dependencies=[Depends(require_module_access("master-data", "process"))],
)


def _http_exception(status_code: int, message: str, route: str = "/process/drawings") -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_drawings_api_error trace_id={} route={} status_code={} message={}",
        trace_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.get("/by-context", response_model=list[EngineeringDrawingResponse], response_model_by_alias=True, summary="List released drawings by context")
async def list_drawings_by_context(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_uuid: Optional[str] = Query(None, alias="materialUuid"),
    process_route_uuid: Optional[str] = Query(None, alias="processRouteUuid"),
    operation_uuid: Optional[str] = Query(None, alias="operationUuid"),
):
    """按物料/工艺路线/工序查询已发布图纸（供车间、工单等模块调用）"""
    return await DrawingService.list_by_context(
        tenant_id,
        material_uuid=material_uuid,
        process_route_uuid=process_route_uuid,
        operation_uuid=operation_uuid,
    )


@router.get("", response_model=EngineeringDrawingListResponse, response_model_by_alias=True, summary="List engineering drawings")
async def list_drawings(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    status: Optional[str] = Query(None),
    drawing_type: Optional[str] = Query(None, alias="drawingType"),
    keyword: Optional[str] = Query(None),
    material_uuid: Optional[str] = Query(None, alias="materialUuid"),
    process_route_uuid: Optional[str] = Query(None, alias="processRouteUuid"),
    operation_uuid: Optional[str] = Query(None, alias="operationUuid"),
    sort_by: Optional[str] = Query(None, alias="sortBy"),
    sort_order: Optional[str] = Query(None, alias="sortOrder"),
):
    items, total = await DrawingService.list_drawings(
        tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        drawing_type=drawing_type,
        keyword=keyword,
        material_uuid=material_uuid,
        process_route_uuid=process_route_uuid,
        operation_uuid=operation_uuid,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return EngineeringDrawingListResponse(data=items, total=total)


@router.post("", response_model=EngineeringDrawingResponse, response_model_by_alias=True, status_code=status.HTTP_201_CREATED, summary="Create drawing draft")
async def create_drawing(
    data: EngineeringDrawingCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await DrawingService.create_drawing(tenant_id, data, created_by=current_user.id)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/{drawing_uuid}", response_model=EngineeringDrawingResponse, response_model_by_alias=True, summary="Get drawing detail")
async def get_drawing(
    drawing_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await DrawingService.get_drawing(tenant_id, drawing_uuid)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put("/{drawing_uuid}", response_model=EngineeringDrawingResponse, response_model_by_alias=True, summary="Update drawing draft")
async def update_drawing(
    drawing_uuid: str,
    data: EngineeringDrawingUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await DrawingService.update_drawing(tenant_id, drawing_uuid, data)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.delete("/{drawing_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete drawing draft")
async def delete_drawing(
    drawing_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await DrawingService.delete_drawing(tenant_id, drawing_uuid)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{drawing_uuid}/release", response_model=EngineeringDrawingResponse, response_model_by_alias=True, summary="Release drawing")
async def release_drawing(
    drawing_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await DrawingService.release_drawing(tenant_id, drawing_uuid, released_by=current_user.id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{drawing_uuid}/obsolete", response_model=EngineeringDrawingResponse, response_model_by_alias=True, summary="Obsolete drawing")
async def obsolete_drawing(
    drawing_uuid: str,
    body: EngineeringDrawingObsoleteRequest,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await DrawingService.obsolete_drawing(tenant_id, drawing_uuid, body)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/{drawing_uuid}/revision", response_model=EngineeringDrawingResponse, response_model_by_alias=True, status_code=status.HTTP_201_CREATED, summary="Create new revision draft")
async def create_revision(
    drawing_uuid: str,
    body: EngineeringDrawingRevisionCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await DrawingService.create_revision(tenant_id, drawing_uuid, body, created_by=current_user.id)
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))


@router.post("/generate-code", summary="Generate drawing code")
async def generate_drawing_code(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """按 ENGINEERING_DRAWING_CODE 规则生成图号"""
    try:
        code = await CodeGenerationService.generate_code(tenant_id, "ENGINEERING_DRAWING_CODE")
        return {"code": code}
    except Exception as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, f"图号生成失败: {e}")
