"""
打卡记录 API 模块

提供打卡记录的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.attendance_record_service import AttendanceRecordService
from apps.kuaihrm.schemas.attendance_record_schemas import (
    AttendanceRecordCreate, AttendanceRecordUpdate, AttendanceRecordResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/attendance-records", tags=["打卡记录"])


@router.post("", response_model=AttendanceRecordResponse, summary="创建打卡记录")
async def create_attendance_record(
    data: AttendanceRecordCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建打卡记录"""
    try:
        return await AttendanceRecordService.create_attendance_record(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[AttendanceRecordResponse], summary="获取打卡记录列表")
async def list_attendance_records(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None)
):
    """获取打卡记录列表"""
    return await AttendanceRecordService.list_attendance_records(
        tenant_id, skip, limit, employee_id, status, start_date, end_date
    )


@router.get("/{record_uuid}", response_model=AttendanceRecordResponse, summary="获取打卡记录详情")
async def get_attendance_record(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取打卡记录详情"""
    try:
        return await AttendanceRecordService.get_attendance_record_by_uuid(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{record_uuid}", response_model=AttendanceRecordResponse, summary="更新打卡记录")
async def update_attendance_record(
    record_uuid: str,
    data: AttendanceRecordUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新打卡记录"""
    try:
        return await AttendanceRecordService.update_attendance_record(tenant_id, record_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{record_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除打卡记录")
async def delete_attendance_record(
    record_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除打卡记录（软删除）"""
    try:
        await AttendanceRecordService.delete_attendance_record(tenant_id, record_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

