"""
线边仓管理与倒冲记录 API 模块

提供线边仓库存查询、调拨、盘点及倒冲记录查询接口。

Author: RiverEdge Team
Date: 2026-02-02
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from loguru import logger

from apps.kuaizhizao.models.line_side_inventory import LineSideInventory
from apps.kuaizhizao.models.backflush_record import BackflushRecord
from apps.kuaizhizao.schemas.line_side_warehouse import (
    LineSideInventoryResponse,
    LineSideInventoryListResponse,
    BackflushRecordResponse,
    BackflushRecordListResponse,
)
from apps.master_data.models.warehouse import Warehouse
from apps.kuaizhizao.services.backflush_service import BackflushService
from core.api.deps import get_current_tenant, get_current_user_id
router = APIRouter(prefix="/line-side-warehouse", tags=["线边仓管理"])
backflush_router = APIRouter(prefix="/backflush-records", tags=["倒冲记录"])


@router.get(
    "/warehouses",
    summary="获取线边仓列表",
    description="获取所有类型为线边仓的仓库列表",
)
async def list_line_side_warehouses(
    tenant_id: int = Depends(get_current_tenant),
) -> list:
    """获取线边仓列表"""
    warehouses = await Warehouse.filter(
        tenant_id=tenant_id,
        warehouse_type="line_side",
        deleted_at__isnull=True,
    ).all()
    return [
        {
            "id": w.id,
            "code": w.code,
            "name": w.name,
            "workshop_id": w.workshop_id,
            "workshop_name": w.workshop_name,
            "work_center_id": w.work_center_id,
            "work_center_name": w.work_center_name,
        }
        for w in warehouses
    ]


@router.get(
    "/inventory",
    summary="获取线边仓库存列表",
    description="按仓库、物料等条件查询线边仓库存",
)
async def list_line_side_inventory(
    tenant_id: int = Depends(get_current_tenant),
    warehouse_id: Optional[int] = Query(None, description="线边仓ID"),
    material_code: Optional[str] = Query(None, description="物料编码（模糊）"),
    material_name: Optional[str] = Query(None, description="物料名称（模糊）"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> LineSideInventoryListResponse:
    """获取线边仓库存列表"""
    query = LineSideInventory.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if warehouse_id:
        query = query.filter(warehouse_id=warehouse_id)
    if material_code:
        query = query.filter(material_code__icontains=material_code)
    if material_name:
        query = query.filter(material_name__icontains=material_name)

    total = await query.count()
    items = await query.offset(skip).limit(limit).order_by("-updated_at").all()

    return LineSideInventoryListResponse(
        items=[LineSideInventoryResponse.model_validate(i) for i in items],
        total=total,
    )


@backflush_router.get(
    "",
    summary="获取倒冲记录列表",
    description="按工单、日期、物料等条件查询倒冲记录",
)
async def list_backflush_records(
    tenant_id: int = Depends(get_current_tenant),
    work_order_code: Optional[str] = Query(None, description="工单编码（模糊）"),
    material_code: Optional[str] = Query(None, description="物料编码（模糊）"),
    status: Optional[str] = Query(None, description="状态：pending/completed/failed"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> BackflushRecordListResponse:
    """获取倒冲记录列表"""
    query = BackflushRecord.filter(
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if work_order_code:
        query = query.filter(work_order_code__icontains=work_order_code)
    if material_code:
        query = query.filter(material_code__icontains=material_code)
    if status:
        query = query.filter(status=status)

    total = await query.count()
    items = await query.offset(skip).limit(limit).order_by("-created_at").all()

    return BackflushRecordListResponse(
        items=[BackflushRecordResponse.model_validate(i) for i in items],
        total=total,
    )


@backflush_router.get(
    "/{record_id}",
    summary="获取倒冲记录详情",
)
async def get_backflush_record(
    record_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> BackflushRecordResponse:
    """获取倒冲记录详情"""
    from infra.exceptions.exceptions import NotFoundError

    record = await BackflushRecord.get_or_none(
        id=record_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not record:
        raise NotFoundError(f"倒冲记录不存在: {record_id}")
    return BackflushRecordResponse.model_validate(record)


@backflush_router.post(
    "/{record_id}/retry",
    summary="重试失败的倒冲",
    description="对状态为 failed 的倒冲记录进行重试",
)
async def retry_backflush_record(
    record_id: int,
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
) -> dict:
    """重试失败的倒冲记录"""
    service = BackflushService()
    new_record = await service.retry_failed_backflush(
        tenant_id=tenant_id,
        failed_record_id=record_id,
        processed_by=user_id,
    )

    if new_record:
        return {"message": "重试成功", "success": True}
    return {"message": "重试失败，线边仓库存仍不足", "success": False}
