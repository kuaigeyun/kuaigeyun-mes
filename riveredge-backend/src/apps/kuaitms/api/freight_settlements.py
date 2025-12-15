"""
运费结算 API 模块

提供运费结算的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaitms.services.freight_settlement_service import FreightSettlementService
from apps.kuaitms.schemas.freight_settlement_schemas import (
    FreightSettlementCreate, FreightSettlementUpdate, FreightSettlementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/freight-settlements", tags=["FreightSettlements"])


@router.post("", response_model=FreightSettlementResponse, status_code=status.HTTP_201_CREATED, summary="创建运费结算")
async def create_freight_settlement(
    data: FreightSettlementCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建运费结算"""
    try:
        return await FreightSettlementService.create_freight_settlement(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[FreightSettlementResponse], summary="获取运费结算列表")
async def list_freight_settlements(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="状态（过滤）"),
    settlement_status: Optional[str] = Query(None, description="结算状态（过滤）")
):
    """获取运费结算列表"""
    return await FreightSettlementService.list_freight_settlements(tenant_id, skip, limit, status, settlement_status)


@router.get("/{settlement_uuid}", response_model=FreightSettlementResponse, summary="获取运费结算详情")
async def get_freight_settlement(
    settlement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """获取运费结算详情"""
    try:
        return await FreightSettlementService.get_freight_settlement_by_uuid(tenant_id, settlement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{settlement_uuid}", response_model=FreightSettlementResponse, summary="更新运费结算")
async def update_freight_settlement(
    settlement_uuid: str,
    data: FreightSettlementUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新运费结算"""
    try:
        return await FreightSettlementService.update_freight_settlement(tenant_id, settlement_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{settlement_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除运费结算")
async def delete_freight_settlement(
    settlement_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除运费结算"""
    try:
        await FreightSettlementService.delete_freight_settlement(tenant_id, settlement_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

