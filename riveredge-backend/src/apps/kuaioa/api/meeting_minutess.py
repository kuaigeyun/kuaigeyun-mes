"""
会议纪要 API 模块

提供会议纪要的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaioa.services.meeting_minutes_service import MeetingMinutesService
from apps.kuaioa.schemas.meeting_minutes_schemas import (
    MeetingMinutesCreate, MeetingMinutesUpdate, MeetingMinutesResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/meeting-minutes", tags=["会议纪要"])


@router.post("", response_model=MeetingMinutesResponse, summary="创建会议纪要")
async def create_meetingminutes(
    data: MeetingMinutesCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建会议纪要"""
    try:
        return await MeetingMinutesService.create_meetingminutes(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[MeetingMinutesResponse], summary="获取会议纪要列表")
async def list_meetingminutess(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取会议纪要列表"""
    return await MeetingMinutesService.list_meetingminutess(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=MeetingMinutesResponse, summary="获取会议纪要详情")
async def get_meetingminutes(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取会议纪要详情"""
    try:
        return await MeetingMinutesService.get_meetingminutes_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=MeetingMinutesResponse, summary="更新会议纪要")
async def update_meetingminutes(
    obj_uuid: str,
    data: MeetingMinutesUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新会议纪要"""
    try:
        return await MeetingMinutesService.update_meetingminutes(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除会议纪要")
async def delete_meetingminutes(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除会议纪要（软删除）"""
    try:
        await MeetingMinutesService.delete_meetingminutes(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
