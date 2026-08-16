"""图纸仓库文件夹 API"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, status

from apps.master_data.api._master_data_route_access import require_master_data_module_access
from apps.master_data.schemas.drawing_folder_schemas import (
    DrawingFolderCreate,
    DrawingFolderResponse,
    DrawingFolderTreeResponse,
    DrawingFolderUpdate,
)
from apps.master_data.services.drawing_folder_service import DrawingFolderService
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from loguru import logger

router = APIRouter(
    prefix="/process/drawing-folders",
    tags=["App - Master Data - Drawing Folders"],
    dependencies=[Depends(require_master_data_module_access("process:drawing"))],
)


def _http_exception(status_code: int, message: str) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_drawing_folders_api_error trace_id={} status_code={} message={}",
        trace_id,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@router.get("/tree", response_model=DrawingFolderTreeResponse, response_model_by_alias=True, summary="Drawing folder tree")
async def list_drawing_folder_tree(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    data = await DrawingFolderService.list_tree(tenant_id)
    return DrawingFolderTreeResponse(data=data)


@router.post(
    "",
    response_model=DrawingFolderResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
    summary="Create drawing folder",
)
async def create_drawing_folder(
    data: DrawingFolderCreate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await DrawingFolderService.create_folder(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.put(
    "/{folder_uuid}",
    response_model=DrawingFolderResponse,
    response_model_by_alias=True,
    summary="Update drawing folder",
)
async def update_drawing_folder(
    folder_uuid: str,
    data: DrawingFolderUpdate,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    try:
        return await DrawingFolderService.update_folder(
            tenant_id, folder_uuid, data, current_user=current_user
        )
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))


@router.delete("/{folder_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete drawing folder")
async def delete_drawing_folder(
    folder_uuid: str,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        await DrawingFolderService.delete_folder(tenant_id, folder_uuid)
    except ValidationError as e:
        raise _http_exception(status.HTTP_400_BAD_REQUEST, str(e))
    except NotFoundError as e:
        raise _http_exception(status.HTTP_404_NOT_FOUND, str(e))
