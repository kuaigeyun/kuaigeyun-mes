"""
供应链风险 API 模块

提供供应链风险的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiscm.services.supply_chain_risk_service import SupplyChainRiskService
from apps.kuaiscm.schemas.supply_chain_risk_schemas import (
    SupplyChainRiskCreate, SupplyChainRiskUpdate, SupplyChainRiskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/supply-chain-risks", tags=["SupplyChainRisks"])


@router.post("", response_model=SupplyChainRiskResponse, status_code=status.HTTP_201_CREATED, summary="创建供应链风险")
async def create_supply_chain_risk(
    data: SupplyChainRiskCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """创建供应链风险"""
    try:
        return await SupplyChainRiskService.create_supply_chain_risk(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SupplyChainRiskResponse], summary="获取供应链风险列表")
async def list_supply_chain_risks(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    risk_type: Optional[str] = Query(None, description="风险类型（过滤）"),
    risk_level: Optional[str] = Query(None, description="风险等级（过滤）"),
    warning_status: Optional[str] = Query(None, description="预警状态（过滤）")
):
    """获取供应链风险列表"""
    return await SupplyChainRiskService.list_supply_chain_risks(tenant_id, skip, limit, risk_type, risk_level, warning_status)


@router.get("/{risk_uuid}", response_model=SupplyChainRiskResponse, summary="获取供应链风险详情")
async def get_supply_chain_risk(
    risk_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """根据UUID获取供应链风险详情"""
    try:
        return await SupplyChainRiskService.get_supply_chain_risk_by_uuid(tenant_id, risk_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{risk_uuid}", response_model=SupplyChainRiskResponse, summary="更新供应链风险")
async def update_supply_chain_risk(
    risk_uuid: str,
    data: SupplyChainRiskUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """更新供应链风险"""
    try:
        return await SupplyChainRiskService.update_supply_chain_risk(tenant_id, risk_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{risk_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除供应链风险")
async def delete_supply_chain_risk(
    risk_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """删除供应链风险"""
    try:
        await SupplyChainRiskService.delete_supply_chain_risk(tenant_id, risk_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

