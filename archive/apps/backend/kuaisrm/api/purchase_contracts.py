"""
采购合同 API 模块

提供采购合同的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaisrm.services.purchase_contract_service import PurchaseContractService
from apps.kuaisrm.schemas.purchase_contract_schemas import (
    PurchaseContractCreate, PurchaseContractUpdate, PurchaseContractResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/purchase-contracts", tags=["Purchase Contracts"])


@router.post("", response_model=PurchaseContractResponse, status_code=status.HTTP_201_CREATED, summary="创建采购合同")
async def create_purchase_contract(
    data: PurchaseContractCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建采购合同
    
    - **contract_no**: 合同编号（必填，组织内唯一）
    - **contract_name**: 合同名称（必填）
    - **supplier_id**: 供应商ID（必填）
    - **contract_date**: 合同签订日期（必填）
    """
    try:
        return await PurchaseContractService.create_purchase_contract(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[PurchaseContractResponse], summary="获取采购合同列表")
async def list_purchase_contracts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="合同状态（过滤）"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（过滤）")
):
    """
    获取采购合同列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 合同状态（可选，用于过滤）
    - **supplier_id**: 供应商ID（可选）
    """
    return await PurchaseContractService.list_purchase_contracts(tenant_id, skip, limit, status, supplier_id)


@router.get("/{contract_uuid}", response_model=PurchaseContractResponse, summary="获取采购合同详情")
async def get_purchase_contract(
    contract_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取采购合同详情
    
    - **contract_uuid**: 合同UUID
    """
    try:
        return await PurchaseContractService.get_purchase_contract_by_uuid(tenant_id, contract_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{contract_uuid}", response_model=PurchaseContractResponse, summary="更新采购合同")
async def update_purchase_contract(
    contract_uuid: str,
    data: PurchaseContractUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新采购合同
    
    - **contract_uuid**: 合同UUID
    - **data**: 合同更新数据
    """
    try:
        return await PurchaseContractService.update_purchase_contract(tenant_id, contract_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{contract_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除采购合同")
async def delete_purchase_contract(
    contract_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除采购合同（软删除）
    
    - **contract_uuid**: 合同UUID
    """
    try:
        await PurchaseContractService.delete_purchase_contract(tenant_id, contract_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
