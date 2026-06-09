"""工单组 API。"""

from typing import List

from fastapi import APIRouter, Depends, Query

from core.api.deps import get_current_tenant, get_current_user
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from infra.models.user import User
from apps.kuaizhizao.schemas.work_order_group import WorkOrderGroupResponse
from apps.kuaizhizao.services.work_order_group_service import WorkOrderGroupService

router = APIRouter(
    tags=["App · Kuaige Zhizao · Work Order Groups"],
    dependencies=[Depends(require_kuaizhizao_module_access("work-order"))],
)


@router.get(
    "/work-order-groups",
    response_model=List[WorkOrderGroupResponse],
    summary="List work order groups",
)
async def list_work_order_groups(
    computation_id: int = Query(..., description="需求计算 ID"),
    tenant_id: int = Depends(get_current_tenant),
) -> List[WorkOrderGroupResponse]:
    svc = WorkOrderGroupService()
    rows = await svc.list_groups_by_computation(tenant_id, computation_id)
    return [WorkOrderGroupResponse.model_validate(r) for r in rows]


@router.get(
    "/work-order-groups/{group_id}",
    response_model=WorkOrderGroupResponse,
    summary="Get work order group detail",
)
async def get_work_order_group(
    group_id: int,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> WorkOrderGroupResponse:
    svc = WorkOrderGroupService()
    row = await svc.get_group_detail(tenant_id, group_id)
    return WorkOrderGroupResponse.model_validate(row)
