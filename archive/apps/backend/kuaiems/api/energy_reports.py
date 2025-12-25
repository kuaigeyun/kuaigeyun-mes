"""
能源报表 API 模块

提供能源报表的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiems.services.energy_report_service import EnergyReportService
from apps.kuaiems.schemas.energy_report_schemas import (
    EnergyReportCreate, EnergyReportUpdate, EnergyReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/energy-reports", tags=["EnergyReports"])


@router.post("", response_model=EnergyReportResponse, status_code=status.HTTP_201_CREATED, summary="创建能源报表")
async def create_energy_report(
    data: EnergyReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建能源报表"""
    try:
        return await EnergyReportService.create_energy_report(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[EnergyReportResponse], summary="获取能源报表列表")
async def list_energy_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    report_type: Optional[str] = Query(None, description="报表类型（过滤）"),
    energy_type: Optional[str] = Query(None, description="能源类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取能源报表列表"""
    return await EnergyReportService.list_energy_reports(tenant_id, skip, limit, report_type, energy_type, status)


@router.get("/{report_uuid}", response_model=EnergyReportResponse, summary="获取能源报表详情")
async def get_energy_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取能源报表详情"""
    try:
        return await EnergyReportService.get_energy_report_by_uuid(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{report_uuid}", response_model=EnergyReportResponse, summary="更新能源报表")
async def update_energy_report(
    report_uuid: str,
    data: EnergyReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新能源报表"""
    try:
        return await EnergyReportService.update_energy_report(tenant_id, report_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{report_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除能源报表")
async def delete_energy_report(
    report_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除能源报表"""
    try:
        await EnergyReportService.delete_energy_report(tenant_id, report_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

