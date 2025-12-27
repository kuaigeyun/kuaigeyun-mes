"""
会议资源 API 模块

提供会议资源的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.meeting_resource_service import MeetingResourceService
from apps.kuaioa.schemas.meeting_resource_schemas import (
    MeetingResourceCreate, MeetingResourceUpdate, MeetingResourceResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/meeting-resource", tags=["Meeting Resources"])


@router.post("", response_model=MeetingResourceResponse, summary="创建会议资源")
async def create_meetingresource(
    data: MeetingResourceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建会议资源"""
    try:
        return await MeetingResourceService.create_meetingresource(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MeetingResourceResponse], summary="获取会议资源列表")
async def list_meetingresources(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取会议资源列表"""
    return await MeetingResourceService.list_meetingresources(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=MeetingResourceResponse, summary="获取会议资源详情")
async def get_meetingresource(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取会议资源详情"""
    try:
        return await MeetingResourceService.get_meetingresource_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=MeetingResourceResponse, summary="更新会议资源")
async def update_meetingresource(
    obj_uuid: str,
    data: MeetingResourceUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新会议资源"""
    try:
        return await MeetingResourceService.update_meetingresource(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除会议资源")
async def delete_meetingresource(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除会议资源（软删除）"""
    try:
        await MeetingResourceService.delete_meetingresource(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
