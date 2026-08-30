"""
供应链数据 API 模块

提供供应链数据的 RESTful API 接口（客户、供应商），支持多组织隔离。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status
from typing import Any, Optional, Annotated
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from apps.master_data.api._master_data_route_access import require_master_data_module_access
from infra.models.user import User
from apps.master_data.services.supply_chain_service import SupplyChainService
from apps.common.bulk_import import BulkCreateResponse
from apps.master_data.schemas.supply_chain_schemas import (
    CustomerCreate,
    CustomerBulkCreateRequest,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse,
    SupplierCreate,
    SupplierBulkCreateRequest,
    SupplierUpdate,
    SupplierResponse,
    SupplierListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from apps.master_data.schemas.master_data_sync import (
    MasterDataSyncBindingOut,
    MasterDataSyncBindingUpsert,
    MasterDataSyncFromSourceOut,
    MasterDataSyncFromSourceRequest,
)

router = APIRouter(prefix="/supply-chain", tags=["App - Master Data - Supply Chain"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/supply-chain",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_supply_chain_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


# ==================== 客户相关接口 ====================

@router.post(
    "/customers",
    response_model=CustomerResponse,
    summary="Create customer",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
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
        return await SupplyChainService.create_customer(tenant_id, data, current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/customers/batch-create",
    response_model=BulkCreateResponse,
    response_model_by_alias=True,
    summary="Batch create customers",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
async def bulk_create_customers(
    data: CustomerBulkCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量创建客户（Excel 导入分片）。

    - 单次最多 200 条；前端按分片循环调用。
    - 单条失败不回滚已成功行，失败原因见 failedItems。
    """
    try:
        return await SupplyChainService.bulk_create_customers(
            tenant_id, list(data.items), current_user
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


customer_sync_service = None  # lazy below


def _customer_sync_service():
    from apps.master_data.services.customer_sync_service import CustomerSyncService
    global customer_sync_service
    if customer_sync_service is None:
        customer_sync_service = CustomerSyncService()
    return customer_sync_service


@router.get(
    "/customers/sync-binding",
    response_model=MasterDataSyncBindingOut,
    summary="客户同步绑定配置",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
async def get_customer_sync_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    return await _customer_sync_service().get_binding(tenant_id)


@router.put(
    "/customers/sync-binding",
    response_model=MasterDataSyncBindingOut,
    summary="保存客户同步绑定配置",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
async def put_customer_sync_binding(
    body: MasterDataSyncBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await _customer_sync_service().upsert_binding(tenant_id, body)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post(
    "/customers/sync-from-source",
    response_model=MasterDataSyncFromSourceOut,
    summary="从数据接口或数据集同步客户",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
async def sync_customers_from_source(
    body: MasterDataSyncFromSourceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    stream: bool = Query(False, description="为 true 时以 NDJSON 流式返回进度"),
):
    try:
        if stream:
            from core.services.data.sync_progress_stream import stream_sync_ndjson

            return await stream_sync_ndjson(
                lambda: _customer_sync_service().sync_from_source(tenant_id, current_user, body)
            )
        return await _customer_sync_service().sync_from_source(tenant_id, current_user, body)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


def _is_missing_db_column_error(exc: BaseException) -> bool:
    msg = str(exc).lower()
    return "column" in msg and "does not exist" in msg


@router.get(
    "/customers",
    response_model=CustomerListResponse,
    summary="List customers",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
async def list_customers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="客户分类（过滤）"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    keyword: Optional[str] = Query(None, description="搜索关键词（编号、名称、联系人等）"),
    code: Optional[str] = Query(None, description="客户编号（模糊）"),
    name: Optional[str] = Query(None, description="客户名称（模糊）"),
    salesman_id: Optional[int] = Query(None, alias="salesmanId", description="归属业务员"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取客户列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 客户分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（可选）
    """
    try:
        items, total = await SupplyChainService.list_customers(
            tenant_id,
            skip,
            limit,
            category,
            is_active,
            keyword,
            code,
            name,
            salesman_id,
            sort_by,
            sort_order,
            created_start_date,
            created_end_date,
            updated_start_date,
            updated_end_date,
            current_user,
        )
        return CustomerListResponse(data=items, total=total)
    except Exception as e:
        if _is_missing_db_column_error(e):
            logger.exception(
                "master_data list_customers DB schema mismatch tenant_id={} error={}",
                tenant_id,
                e,
            )
            raise _http_exception_with_trace(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "客户表缺少数据库字段（常与未执行迁移有关）。请在 riveredge-backend 目录执行：aerich upgrade，并重启 API 服务。",
                route="/supply-chain/customers",
                tenant_id=tenant_id,
            )
        raise


@router.get(
    "/customers/{customer_uuid}",
    response_model=CustomerResponse,
    summary="Get customer",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
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


@router.put(
    "/customers/{customer_uuid}",
    response_model=CustomerResponse,
    summary="Update customer",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
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
        return await SupplyChainService.update_customer(tenant_id, customer_uuid, data, current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/customers/{customer_uuid}",
    summary="Delete customer",
    dependencies=[Depends(require_master_data_module_access("supply-chain:customer"))],
)
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
        await SupplyChainService.delete_customer(tenant_id, customer_uuid, current_user)
        return {"message": "客户删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 供应商相关接口 ====================

supplier_sync_service = None


def _supplier_sync_service():
    from apps.master_data.services.supplier_sync_service import SupplierSyncService
    global supplier_sync_service
    if supplier_sync_service is None:
        supplier_sync_service = SupplierSyncService()
    return supplier_sync_service


@router.get(
    "/suppliers/sync-binding",
    response_model=MasterDataSyncBindingOut,
    summary="供应商同步绑定配置",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def get_supplier_sync_binding(
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    return await _supplier_sync_service().get_binding(tenant_id)


@router.put(
    "/suppliers/sync-binding",
    response_model=MasterDataSyncBindingOut,
    summary="保存供应商同步绑定配置",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def put_supplier_sync_binding(
    body: MasterDataSyncBindingUpsert,
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await _supplier_sync_service().upsert_binding(tenant_id, body)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post(
    "/suppliers/sync-from-source",
    response_model=MasterDataSyncFromSourceOut,
    summary="从数据接口或数据集同步供应商",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def sync_suppliers_from_source(
    body: MasterDataSyncFromSourceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    try:
        return await _supplier_sync_service().sync_from_source(tenant_id, current_user, body)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post(
    "/suppliers",
    response_model=SupplierResponse,
    summary="Create supplier",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
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
        return await SupplyChainService.create_supplier(tenant_id, data, current_user=current_user)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/suppliers/batch-create",
    response_model=BulkCreateResponse,
    response_model_by_alias=True,
    summary="Batch create suppliers",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def bulk_create_suppliers(
    data: SupplierBulkCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """
    批量创建供应商（Excel 导入分片）。

    - 单次最多 200 条；前端按分片循环调用。
    - 单条失败不回滚已成功行，失败原因见 failedItems。
    """
    try:
        return await SupplyChainService.bulk_create_suppliers(
            tenant_id, list(data.items), current_user=current_user
        )
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/suppliers",
    response_model=SupplierListResponse,
    summary="List suppliers",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def list_suppliers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    category: Optional[str] = Query(None, description="供应商分类（过滤）"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="是否启用"),
    qualification_status: Optional[str] = Query(
        None, alias="qualificationStatus", description="准入状态"
    ),
    keyword: Optional[str] = Query(None, description="搜索关键词（编码、名称、联系人等）"),
    code: Optional[str] = Query(None, description="供应商编码（模糊匹配）"),
    name: Optional[str] = Query(None, description="供应商名称（模糊匹配）"),
    buyer_id: Optional[int] = Query(None, alias="buyerId", description="归属采购员"),
    sort_by: Optional[str] = Query(None, alias="sortBy", description="排序字段"),
    sort_order: Optional[str] = Query(None, alias="sortOrder", description="asc 或 desc"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
):
    """
    获取供应商列表

    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **category**: 供应商分类（可选，用于过滤）
    - **is_active**: 是否启用（可选）
    - **keyword**: 搜索关键词（供应商编码或名称）
    - **code**: 供应商编码（精确匹配）
    - **name**: 供应商名称（模糊匹配）
    """
    items, total = await SupplyChainService.list_suppliers(
        tenant_id,
        skip,
        limit,
        category,
        is_active,
        keyword,
        code,
        name,
        buyer_id,
        qualification_status,
        sort_by,
        sort_order,
        created_start_date,
        created_end_date,
        updated_start_date,
        updated_end_date,
        current_user,
    )
    return SupplierListResponse(data=items, total=total)


@router.get(
    "/suppliers/{supplier_uuid}",
    response_model=SupplierResponse,
    summary="Get supplier",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
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


@router.put(
    "/suppliers/{supplier_uuid}",
    response_model=SupplierResponse,
    summary="Update supplier",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
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
        return await SupplyChainService.update_supplier(tenant_id, supplier_uuid, data, current_user=current_user)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/suppliers/{supplier_uuid}/recalculate-rating",
    summary="Recalculate supplier rating from delivery and IQC",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
async def recalculate_supplier_rating(
    supplier_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    lookback_days: int = 90,
):
    """按近 N 天交期达成率与来料合格率重算评级并回写主数据。"""
    try:
        return await SupplyChainService.recalculate_supplier_rating(
            tenant_id, supplier_uuid, lookback_days=lookback_days
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/suppliers/{supplier_uuid}",
    summary="Delete supplier",
    dependencies=[Depends(require_master_data_module_access("supply-chain:supplier"))],
)
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

