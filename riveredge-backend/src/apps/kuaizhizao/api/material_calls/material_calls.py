"""
叫料请求 API 模块
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User

from apps.kuaizhizao.services.material_call_service import MaterialCallService
from apps.kuaizhizao.schemas.material_call import (
    MaterialCallRequestCreate,
    MaterialCallRequestUpdate,
    MaterialCallRequestResponse,
    MaterialCallBatchFromWorkOrderRequest,
)

router = APIRouter(prefix="/material-calls", tags=["Kuaige Zhizao - Material Call"])

@router.post("", response_model=MaterialCallRequestResponse, summary="发起叫料请求")
async def create_material_call(
    create_data: MaterialCallRequestCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallRequestResponse:
    """生产现场发起物料叫料请求"""
    return await MaterialCallService().create_call_request(tenant_id, create_data, current_user)


@router.post(
    "/batch-from-work-order",
    response_model=List[MaterialCallRequestResponse],
    summary="整单叫料（按工单齐套缺料批量生成）",
)
async def batch_material_calls_from_work_order(
    body: MaterialCallBatchFromWorkOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialCallRequestResponse]:
    """按工单 BOM 齐套分析，对 shortage_quantity>0 的物料逐条生成叫料单（call_type=FULL_ORDER）。"""
    return await MaterialCallService().batch_create_from_work_order_kitting(
        tenant_id=tenant_id,
        work_order_id=body.work_order_id,
        user=current_user,
    )


@router.get("", response_model=List[MaterialCallRequestResponse], summary="查询叫料请求列表")
async def list_material_calls(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选"),
    work_order_id: Optional[int] = Query(None, description="工单ID筛选"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[MaterialCallRequestResponse]:
    """查询叫料请求列表，支持按状态和工单过滤"""
    return await MaterialCallService().list_call_requests(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        work_order_id=work_order_id
    )

@router.patch("/{call_id}", response_model=MaterialCallRequestResponse, summary="更新叫料请求状态/信息")
async def update_material_call(
    call_id: int = Path(..., description="叫料请求ID"),
    update_data: MaterialCallRequestUpdate = None,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallRequestResponse:
    """更新叫料请求，如仓库端开始处理或完成配送"""
    return await MaterialCallService().update_call_request(
        tenant_id=tenant_id,
        call_id=call_id,
        update_data=update_data,
        user=current_user
    )

@router.post("/{call_id}/cancel", summary="取消叫料请求")
async def cancel_material_call(
    call_id: int = Path(..., description="叫料请求ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """取消尚未处理的叫料请求"""
    success = await MaterialCallService().cancel_call_request(tenant_id, call_id, current_user.id)
    return {"success": success}
