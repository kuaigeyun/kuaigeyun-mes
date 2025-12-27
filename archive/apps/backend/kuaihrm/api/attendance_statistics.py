"""
考勤统计 API 模块

提供考勤统计的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.attendance_statistics_service import AttendanceStatisticsService
from apps.kuaihrm.schemas.attendance_statistics_schemas import (
    AttendanceStatisticsCreate, AttendanceStatisticsUpdate, AttendanceStatisticsResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/attendance-statistics", tags=["Attendance Statistics"])


@router.post("", response_model=AttendanceStatisticsResponse, summary="创建考勤统计")
async def create_attendance_statistics(
    data: AttendanceStatisticsCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建考勤统计"""
    try:
        return await AttendanceStatisticsService.create_attendance_statistics(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[AttendanceStatisticsResponse], summary="获取考勤统计列表")
async def list_attendance_statistics(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    employee_id: Optional[int] = Query(None),
    statistics_period: Optional[str] = Query(None)
):
    """获取考勤统计列表"""
    return await AttendanceStatisticsService.list_attendance_statistics(
        tenant_id, skip, limit, employee_id, statistics_period
    )


@router.get("/{statistics_uuid}", response_model=AttendanceStatisticsResponse, summary="获取考勤统计详情")
async def get_attendance_statistics(
    statistics_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取考勤统计详情"""
    try:
        return await AttendanceStatisticsService.get_attendance_statistics_by_uuid(tenant_id, statistics_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{statistics_uuid}", response_model=AttendanceStatisticsResponse, summary="更新考勤统计")
async def update_attendance_statistics(
    statistics_uuid: str,
    data: AttendanceStatisticsUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新考勤统计"""
    try:
        return await AttendanceStatisticsService.update_attendance_statistics(tenant_id, statistics_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{statistics_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除考勤统计")
async def delete_attendance_statistics(
    statistics_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除考勤统计（软删除）"""
    try:
        await AttendanceStatisticsService.delete_attendance_statistics(tenant_id, statistics_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

