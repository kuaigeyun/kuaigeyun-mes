"""
文档版本 API 模块

提供文档版本的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.document_version_service import DocumentVersionService
from apps.kuaioa.schemas.document_version_schemas import (
    DocumentVersionCreate, DocumentVersionUpdate, DocumentVersionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/document-version", tags=["Document Versions"])


@router.post("", response_model=DocumentVersionResponse, summary="创建文档版本")
async def create_documentversion(
    data: DocumentVersionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建文档版本"""
    try:
        return await DocumentVersionService.create_documentversion(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[DocumentVersionResponse], summary="获取文档版本列表")
async def list_documentversions(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取文档版本列表"""
    return await DocumentVersionService.list_documentversions(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=DocumentVersionResponse, summary="获取文档版本详情")
async def get_documentversion(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取文档版本详情"""
    try:
        return await DocumentVersionService.get_documentversion_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=DocumentVersionResponse, summary="更新文档版本")
async def update_documentversion(
    obj_uuid: str,
    data: DocumentVersionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新文档版本"""
    try:
        return await DocumentVersionService.update_documentversion(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除文档版本")
async def delete_documentversion(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除文档版本（软删除）"""
    try:
        await DocumentVersionService.delete_documentversion(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
