"""
销售合同条款 API（条款项 / 条款组）
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status as http_status
from loguru import logger

from core.api.deps import get_current_tenant
from core.api.deps.access import require_module_access
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError

from apps.kuaizhizao.schemas.sales_contract_term import (
    SalesContractTermGroupCreate,
    SalesContractTermGroupListResponse,
    SalesContractTermGroupResponse,
    SalesContractTermGroupUpdate,
    SalesContractTermItemCreate,
    SalesContractTermItemListResponse,
    SalesContractTermItemResponse,
    SalesContractTermItemUpdate,
)
from apps.kuaizhizao.services.sales_contract_term_service import SalesContractTermService

term_service = SalesContractTermService()
router = APIRouter(
    prefix="/sales-contracts",
    tags=["App · Kuaige Zhizao · Sales Contract Terms"],
    dependencies=[Depends(require_module_access("kuaizhizao", "sales-contract"))],
)


@router.get("/term-items", response_model=SalesContractTermItemListResponse, summary="List term items")
async def list_term_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    tenant_id: int = Depends(get_current_tenant),
):
    return await term_service.list_term_items(
        tenant_id, skip=skip, limit=limit, keyword=keyword, is_active=is_active
    )


@router.post("/term-items", response_model=SalesContractTermItemResponse, summary="Create term item")
async def create_term_item(
    data: SalesContractTermItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.create_term_item(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建条款项失败: %s", e)
        raise HTTPException(status_code=500, detail="创建条款项失败")


@router.get("/term-items/{item_id}", response_model=SalesContractTermItemResponse, summary="Get term item")
async def get_term_item(
    item_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.get_term_item(tenant_id, item_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/term-items/{item_id}", response_model=SalesContractTermItemResponse, summary="Update term item")
async def update_term_item(
    item_id: int,
    data: SalesContractTermItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.update_term_item(tenant_id, item_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/term-items/{item_id}", summary="Delete term item")
async def delete_term_item(
    item_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await term_service.delete_term_item(tenant_id, item_id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/term-groups", response_model=SalesContractTermGroupListResponse, summary="List term groups")
async def list_term_groups(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    keyword: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    include_items: bool = Query(False),
    tenant_id: int = Depends(get_current_tenant),
):
    return await term_service.list_term_groups(
        tenant_id,
        skip=skip,
        limit=limit,
        keyword=keyword,
        is_active=is_active,
        include_items=include_items,
    )


@router.post("/term-groups", response_model=SalesContractTermGroupResponse, summary="Create term group")
async def create_term_group(
    data: SalesContractTermGroupCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.create_term_group(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建条款组失败: %s", e)
        raise HTTPException(status_code=500, detail="创建条款组失败")


@router.get("/term-groups/{group_id}", response_model=SalesContractTermGroupResponse, summary="Get term group")
async def get_term_group(
    group_id: int = Path(...),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.get_term_group(tenant_id, group_id, include_items=True)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/term-groups/{group_id}", response_model=SalesContractTermGroupResponse, summary="Update term group")
async def update_term_group(
    group_id: int,
    data: SalesContractTermGroupUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await term_service.update_term_group(tenant_id, group_id, data)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/term-groups/{group_id}", summary="Delete term group")
async def delete_term_group(
    group_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await term_service.delete_term_group(tenant_id, group_id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
