"""
叫料请求 API 模块
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path
from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User

from apps.kuaizhizao.services.material_call_service import MaterialCallService
from apps.kuaizhizao.services.warehouse_service import ProductionPickingService
from apps.kuaizhizao.schemas.material_call import (
    MaterialCallRequestCreate,
    MaterialCallRequestUpdate,
    MaterialCallRequestResponse,
    MaterialCallBatchFromWorkOrderRequest,
    MaterialCallPushPickingPreviewResponse,
)
from apps.kuaizhizao.schemas.warehouse import (
    ProductionPickingPullFromMaterialCallRequest,
    ProductionPickingWithItemsResponse,
)

router = APIRouter(prefix="/material-calls", tags=["App - Kuaige Zhizao - Material Call"])

@router.post("", response_model=MaterialCallRequestResponse, summary="Create material call request")
async def create_material_call(
    create_data: MaterialCallRequestCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallRequestResponse:
    """生产现场发起物料叫料请求"""
    return await MaterialCallService().create_call_request(tenant_id, create_data, current_user)


@router.post(
    "/batch-from-work-order",
    response_model=MaterialCallRequestResponse,
    summary="Full-order material call from kitting shortages",
)
async def batch_material_calls_from_work_order(
    body: MaterialCallBatchFromWorkOrderRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallRequestResponse:
    """按工单 BOM 齐套分析，对 shortage_quantity>0 的物料生成 **一张** 叫料单、多行明细（call_type=FULL_ORDER）。"""
    return await MaterialCallService().batch_create_from_work_order_kitting(
        tenant_id=tenant_id,
        work_order_id=body.work_order_id,
        user=current_user,
    )


@router.get("", response_model=List[MaterialCallRequestResponse], summary="List material call requests")
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


@router.get("/{call_id}", response_model=MaterialCallRequestResponse, summary="Get material call request")
async def get_material_call(
    call_id: int = Path(..., description="叫料请求ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallRequestResponse:
    """查询叫料单详情（含明细）"""
    return await MaterialCallService().get_call_request(tenant_id, call_id)


@router.get(
    "/{call_id}/push-production-picking/preview",
    response_model=MaterialCallPushPickingPreviewResponse,
    summary="Preview push material call to production picking",
)
async def preview_push_material_call_to_production_picking(
    call_id: int = Path(..., description="补料申请ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> MaterialCallPushPickingPreviewResponse:
    """补料申请下推生产领料预览：按申请明细返回可领物料与数量。"""
    data = await ProductionPickingService().preview_push_material_call_to_production_picking(
        tenant_id=tenant_id,
        material_call_id=call_id,
    )
    return MaterialCallPushPickingPreviewResponse.model_validate(data)


@router.post(
    "/{call_id}/push-production-picking",
    response_model=ProductionPickingWithItemsResponse,
    summary="Create production picking from material call",
)
async def push_material_call_to_production_picking(
    call_id: int = Path(..., description="补料申请ID"),
    body: ProductionPickingPullFromMaterialCallRequest = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> ProductionPickingWithItemsResponse:
    """从补料申请下推创建生产领料单（正式发料，明细来自补料申请）。"""
    if int(body.material_call_id) != int(call_id):
        from infra.exceptions.exceptions import ValidationError

        raise ValidationError("路径与请求体中的补料申请ID不一致")
    return await ProductionPickingService().create_production_picking_from_material_call_pull(
        tenant_id=tenant_id,
        created_by=current_user.id,
        material_call_id=call_id,
        warehouse_id=body.warehouse_id,
        warehouse_name=body.warehouse_name,
        picker_name=body.picker_name,
        notes=body.notes,
        lines=body.lines,
    )


@router.patch("/{call_id}", response_model=MaterialCallRequestResponse, summary="Update material call request")
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

@router.post("/{call_id}/cancel", summary="Cancel material call request")
async def cancel_material_call(
    call_id: int = Path(..., description="叫料请求ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """撤回叫料：仅待处理且已送达数量为 0（仓库监控页仍可用 PATCH 取消其他状态）"""
    success = await MaterialCallService().cancel_call_request(tenant_id, call_id, current_user.id)
    return {"success": success}
