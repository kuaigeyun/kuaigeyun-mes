"""
经营数据分析 API 模块

提供经营数据分析的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiepm.services.business_data_analysis_service import BusinessDataAnalysisService
from apps.kuaiepm.schemas.business_data_analysis_schemas import (
    BusinessDataAnalysisCreate, BusinessDataAnalysisUpdate, BusinessDataAnalysisResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/business-data-analysis", tags=["Business Data Analysis"])


@router.post("", response_model=BusinessDataAnalysisResponse, summary="创建经营数据分析")
async def create_businessdataanalysis(
    data: BusinessDataAnalysisCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建经营数据分析"""
    try:
        return await BusinessDataAnalysisService.create_businessdataanalysis(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[BusinessDataAnalysisResponse], summary="获取经营数据分析列表")
async def list_businessdataanalysiss(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None)
):
    """获取经营数据分析列表"""
    return await BusinessDataAnalysisService.list_businessdataanalysiss(tenant_id, skip, limit, status)


@router.get("/{obj_uuid}", response_model=BusinessDataAnalysisResponse, summary="获取经营数据分析详情")
async def get_businessdataanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取经营数据分析详情"""
    try:
        return await BusinessDataAnalysisService.get_businessdataanalysis_by_uuid(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{obj_uuid}", response_model=BusinessDataAnalysisResponse, summary="更新经营数据分析")
async def update_businessdataanalysis(
    obj_uuid: str,
    data: BusinessDataAnalysisUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新经营数据分析"""
    try:
        return await BusinessDataAnalysisService.update_businessdataanalysis(tenant_id, obj_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{obj_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除经营数据分析")
async def delete_businessdataanalysis(
    obj_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除经营数据分析（软删除）"""
    try:
        await BusinessDataAnalysisService.delete_businessdataanalysis(tenant_id, obj_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
