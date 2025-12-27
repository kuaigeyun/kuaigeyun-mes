"""
考勤规则 API 模块

提供考勤规则的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaihrm.services.attendance_rule_service import AttendanceRuleService
from apps.kuaihrm.schemas.attendance_rule_schemas import (
    AttendanceRuleCreate, AttendanceRuleUpdate, AttendanceRuleResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/attendance-rules", tags=["Attendance Rules"])


@router.post("", response_model=AttendanceRuleResponse, summary="创建考勤规则")
async def create_attendance_rule(
    data: AttendanceRuleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建考勤规则"""
    try:
        return await AttendanceRuleService.create_attendance_rule(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[AttendanceRuleResponse], summary="获取考勤规则列表")
async def list_attendance_rules(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    rule_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取考勤规则列表"""
    return await AttendanceRuleService.list_attendance_rules(
        tenant_id, skip, limit, rule_type, status
    )


@router.get("/{rule_uuid}", response_model=AttendanceRuleResponse, summary="获取考勤规则详情")
async def get_attendance_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取考勤规则详情"""
    try:
        return await AttendanceRuleService.get_attendance_rule_by_uuid(tenant_id, rule_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{rule_uuid}", response_model=AttendanceRuleResponse, summary="更新考勤规则")
async def update_attendance_rule(
    rule_uuid: str,
    data: AttendanceRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新考勤规则"""
    try:
        return await AttendanceRuleService.update_attendance_rule(tenant_id, rule_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{rule_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除考勤规则")
async def delete_attendance_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除考勤规则（软删除）"""
    try:
        await AttendanceRuleService.delete_attendance_rule(tenant_id, rule_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

