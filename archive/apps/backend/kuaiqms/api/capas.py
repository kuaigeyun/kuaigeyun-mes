"""
CAPA API 模块

提供CAPA的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiqms.services.capa_service import CAPAService
from apps.kuaiqms.schemas.capa_schemas import (
    CAPACreate, CAPAUpdate, CAPAResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/capas", tags=["CAPAs"])


@router.post("", response_model=CAPAResponse, status_code=status.HTTP_201_CREATED, summary="创建CAPA")
async def create_capa(
    data: CAPACreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建CAPA"""
    try:
        return await CAPAService.create_capa(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[CAPAResponse], summary="获取CAPA列表")
async def list_capas(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    capa_type: Optional[str] = Query(None, description="CAPA类型（过滤）"),
    status: Optional[str] = Query(None, description="CAPA状态（过滤）")
):
    """获取CAPA列表"""
    return await CAPAService.list_capas(tenant_id, skip, limit, capa_type, status)


@router.get("/{capa_uuid}", response_model=CAPAResponse, summary="获取CAPA详情")
async def get_capa(
    capa_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取CAPA详情"""
    try:
        return await CAPAService.get_capa_by_uuid(tenant_id, capa_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{capa_uuid}", response_model=CAPAResponse, summary="更新CAPA")
async def update_capa(
    capa_uuid: str,
    data: CAPAUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新CAPA"""
    try:
        return await CAPAService.update_capa(tenant_id, capa_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{capa_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除CAPA")
async def delete_capa(
    capa_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除CAPA"""
    try:
        await CAPAService.delete_capa(tenant_id, capa_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
