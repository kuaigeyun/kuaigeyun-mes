"""图档反查 API"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status

from apps.master_data.api._master_data_route_access import require_master_data_module_access
from apps.master_data.schemas.drawing_where_used_schemas import DrawingWhereUsedResponse
from apps.master_data.services.drawing_where_used_service import DrawingWhereUsedService
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import AuthorizationError, NotFoundError, ValidationError
from infra.models.user import User
from loguru import logger

router = APIRouter(
    prefix="/process/drawing-where-used",
    tags=["App - Master Data - Drawing Where Used"],
    dependencies=[Depends(require_master_data_module_access("process:drawing-where-used"))],
)


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_drawing_where_used_api_error trace_id={} status_code={} message={}",
        trace_id,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.get("", response_model=DrawingWhereUsedResponse, response_model_by_alias=True, summary="Drawing where-used")
async def query_drawing_where_used(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
    material_uuid: Optional[str] = Query(None, alias="materialUuid"),
    process_route_uuid: Optional[str] = Query(None, alias="processRouteUuid"),
    operation_uuid: Optional[str] = Query(None, alias="operationUuid"),
    work_order_uuid: Optional[str] = Query(None, alias="workOrderUuid"),
    drawing_uuid: Optional[str] = Query(None, alias="drawingUuid"),
):
    try:
        return await DrawingWhereUsedService.query(
            tenant_id,
            material_uuid=material_uuid,
            process_route_uuid=process_route_uuid,
            operation_uuid=operation_uuid,
            work_order_uuid=work_order_uuid,
            drawing_uuid=drawing_uuid,
            current_user=current_user,
        )
    except AuthorizationError as e:
        raise _http_exception(status.HTTP_403_FORBIDDEN, str(e))
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
