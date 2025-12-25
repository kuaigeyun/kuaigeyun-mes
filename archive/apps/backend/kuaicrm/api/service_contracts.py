"""
服务合同 API 模块

提供服务合同的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.service_contract_service import ServiceContractService
from apps.kuaicrm.schemas.service_contract_schemas import (
    ServiceContractCreate, ServiceContractUpdate, ServiceContractResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/service-contracts", tags=["Service Contracts"])


@router.post("", response_model=ServiceContractResponse, summary="创建服务合同")
async def create_contract(
    data: ServiceContractCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建服务合同
    
    - **contract_no**: 合同编号（必填，组织内唯一）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **contract_type**: 合同类型（必填）
    - **contract_start_date**: 合同开始日期（必填）
    - **contract_end_date**: 合同结束日期（必填）
    """
    try:
        return await ServiceContractService.create_contract(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[ServiceContractResponse], summary="获取服务合同列表")
async def list_contracts(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    contract_status: Optional[str] = Query(None, description="合同状态（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取服务合同列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **contract_status**: 合同状态（可选，用于过滤）
    - **customer_id**: 客户ID（可选）
    """
    return await ServiceContractService.list_contracts(tenant_id, skip, limit, contract_status, customer_id)


@router.get("/{contract_uuid}", response_model=ServiceContractResponse, summary="获取服务合同详情")
async def get_contract(
    contract_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取服务合同详情
    
    - **contract_uuid**: 合同UUID
    """
    try:
        return await ServiceContractService.get_contract_by_uuid(tenant_id, contract_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{contract_uuid}", response_model=ServiceContractResponse, summary="更新服务合同")
async def update_contract(
    contract_uuid: str,
    data: ServiceContractUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新服务合同
    
    - **contract_uuid**: 合同UUID
    - **data**: 合同更新数据
    """
    try:
        return await ServiceContractService.update_contract(tenant_id, contract_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{contract_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除服务合同")
async def delete_contract(
    contract_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除服务合同（软删除）
    
    - **contract_uuid**: 合同UUID
    """
    try:
        await ServiceContractService.delete_contract(tenant_id, contract_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
