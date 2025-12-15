"""
财务报表 API 模块

提供财务报表的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.financial_report_service import FinancialReportService
from apps.kuaiacc.schemas.financial_report_schemas import (
    FinancialReportCreate, FinancialReportUpdate, FinancialReportResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/financial-reports", tags=["财务报表"])


@router.post("", response_model=FinancialReportResponse, summary="创建财务报表")
async def create_financial_report(
    data: FinancialReportCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建财务报表"""
    try:
        return await FinancialReportService.create_financial_report(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[FinancialReportResponse], summary="获取财务报表列表")
async def list_financial_reports(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    report_type: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None)
):
    """获取财务报表列表"""
    return await FinancialReportService.list_financial_reports(
        tenant_id, skip, limit, report_type, year, status
    )


@router.get("/{uuid}", response_model=FinancialReportResponse, summary="获取财务报表详情")
async def get_financial_report(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取财务报表详情"""
    try:
        return await FinancialReportService.get_financial_report_by_uuid(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=FinancialReportResponse, summary="更新财务报表")
async def update_financial_report(
    uuid: str,
    data: FinancialReportUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新财务报表"""
    try:
        return await FinancialReportService.update_financial_report(tenant_id, uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除财务报表")
async def delete_financial_report(
    uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除财务报表（软删除）"""
    try:
        await FinancialReportService.delete_financial_report(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/generate", response_model=FinancialReportResponse, summary="生成财务报表")
async def generate_report(
    report_type: str = Query(..., description="报表类型"),
    report_period: str = Query(..., description="报表期间"),
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """生成财务报表"""
    try:
        return await FinancialReportService.generate_report(tenant_id, report_type, report_period)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

