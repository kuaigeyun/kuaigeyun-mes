"""
供应链数据 API 模块

提供供应链数据的 RESTful API 接口（客户、供应商），支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.supply_chain_service import SupplyChainService
from apps.master_data.schemas.supply_chain_schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    SupplierCreate, SupplierUpdate, SupplierResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/supply-chain", tags=["Supply Chain"])


# ==================== 客户相关接口 ====================

@router.post("/customers", response_model=CustomerResponse, summary="创建客户")
async def create_customer(
    data: CustomerCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建客户
    
    - **code**: 客户编码（必填，组织内唯一）
    - **name**: 客户名称（必填）
    - **short_name**: 简称（可选）
    - **contact_person**: 联系人（可选）
    - **phone**: 电话（可选）
    - **email**: 邮箱（可选）
    - **address**: 地址（可选）
    - **category**: 客户分类（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await SupplyChainService.create_customer(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/customers", response_model=List[CustomerResponse], summary="获取客户列表")
async def list_customers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="客户分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取客户列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 客户分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await SupplyChainService.list_customers(tenant_id, skip, limit, category, is_active)


@router.get("/customers/{customer_uuid}", response_model=CustomerResponse, summary="获取客户详情")
async def get_customer(
    customer_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取客户详情
    
    - **customer_uuid**: 客户UUID
    """
    try:
        return await SupplyChainService.get_customer_by_uuid(tenant_id, customer_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/customers/{customer_uuid}", response_model=CustomerResponse, summary="更新客户")
async def update_customer(
    customer_uuid: str,
    data: CustomerUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新客户
    
    - **customer_uuid**: 客户UUID
    - **code**: 客户编码（可选）
    - **name**: 客户名称（可选）
    - **short_name**: 简称（可选）
    - **contact_person**: 联系人（可选）
    - **phone**: 电话（可选）
    - **email**: 邮箱（可选）
    - **address**: 地址（可选）
    - **category**: 客户分类（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await SupplyChainService.update_customer(tenant_id, customer_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/customers/{customer_uuid}", summary="删除客户")
async def delete_customer(
    customer_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除客户（软删除）
    
    - **customer_uuid**: 客户UUID
    """
    try:
        await SupplyChainService.delete_customer(tenant_id, customer_uuid)
        return {"message": "客户删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==================== 供应商相关接口 ====================

@router.post("/suppliers", response_model=SupplierResponse, summary="创建供应商")
async def create_supplier(
    data: SupplierCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建供应商
    
    - **code**: 供应商编码（必填，组织内唯一）
    - **name**: 供应商名称（必填）
    - **short_name**: 简称（可选）
    - **contact_person**: 联系人（可选）
    - **phone**: 电话（可选）
    - **email**: 邮箱（可选）
    - **address**: 地址（可选）
    - **category**: 供应商分类（可选）
    - **is_active**: 是否启用（默认：true）
    """
    try:
        return await SupplyChainService.create_supplier(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/suppliers", response_model=List[SupplierResponse], summary="获取供应商列表")
async def list_suppliers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="供应商分类（过滤）"),
    is_active: Optional[bool] = Query(None, description="是否启用")
):
    """
    获取供应商列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 供应商分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    """
    return await SupplyChainService.list_suppliers(tenant_id, skip, limit, category, is_active)


@router.get("/suppliers/{supplier_uuid}", response_model=SupplierResponse, summary="获取供应商详情")
async def get_supplier(
    supplier_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取供应商详情
    
    - **supplier_uuid**: 供应商UUID
    """
    try:
        return await SupplyChainService.get_supplier_by_uuid(tenant_id, supplier_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/suppliers/{supplier_uuid}", response_model=SupplierResponse, summary="更新供应商")
async def update_supplier(
    supplier_uuid: str,
    data: SupplierUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新供应商
    
    - **supplier_uuid**: 供应商UUID
    - **code**: 供应商编码（可选）
    - **name**: 供应商名称（可选）
    - **short_name**: 简称（可选）
    - **contact_person**: 联系人（可选）
    - **phone**: 电话（可选）
    - **email**: 邮箱（可选）
    - **address**: 地址（可选）
    - **category**: 供应商分类（可选）
    - **is_active**: 是否启用（可选）
    """
    try:
        return await SupplyChainService.update_supplier(tenant_id, supplier_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/suppliers/{supplier_uuid}", summary="删除供应商")
async def delete_supplier(
    supplier_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除供应商（软删除）
    
    - **supplier_uuid**: 供应商UUID
    """
    try:
        await SupplyChainService.delete_supplier(tenant_id, supplier_uuid)
        return {"message": "供应商删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

