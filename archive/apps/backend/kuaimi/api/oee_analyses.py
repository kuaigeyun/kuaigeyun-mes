"""
设备综合效率分析 API 模块

提供设备综合效率分析的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimi.services.oee_analysis_service import OEEAnalysisService
from apps.kuaimi.schemas.oee_analysis_schemas import (
    OEEAnalysisCreate, OEEAnalysisUpdate, OEEAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/oee-analyses", tags=["OEEAnalyses"])


@router.post("", response_model=OEEAnalysisResponse, status_code=status.HTTP_201_CREATED, summary="创建设备综合效率分析")
async def create_oee_analysis(
    data: OEEAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建设备综合效率分析"""
    try:
        return await OEEAnalysisService.create_oee_analysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[OEEAnalysisResponse], summary="获取设备综合效率分析列表")
async def list_oee_analyses(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    device_id: Optional[int] = Query(None, description="设备ID（过滤）"),
    analysis_period: Optional[str] = Query(None, description="分析周期（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）")
):
    """获取设备综合效率分析列表"""
    return await OEEAnalysisService.list_oee_analyses(tenant_id, skip, limit, device_id, analysis_period, status)


@router.get("/{analysis_uuid}", response_model=OEEAnalysisResponse, summary="获取设备综合效率分析详情")
async def get_oee_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取设备综合效率分析详情"""
    try:
        return await OEEAnalysisService.get_oee_analysis_by_uuid(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{analysis_uuid}", response_model=OEEAnalysisResponse, summary="更新设备综合效率分析")
async def update_oee_analysis(
    analysis_uuid: str,
    data: OEEAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新设备综合效率分析"""
    try:
        return await OEEAnalysisService.update_oee_analysis(tenant_id, analysis_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{analysis_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除设备综合效率分析")
async def delete_oee_analysis(
    analysis_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除设备综合效率分析"""
    try:
        await OEEAnalysisService.delete_oee_analysis(tenant_id, analysis_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

