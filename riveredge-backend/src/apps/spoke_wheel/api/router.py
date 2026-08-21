"""辐条轮毂总装 — REST API"""
from fastapi import APIRouter, Depends, Query, status
from typing import Optional

from core.api.deps.deps import get_current_tenant
from core.api.deps.access import require_access
from infra.api.deps.deps import get_current_user

from apps.spoke_wheel.schemas import (
    SpokeWheelAssemblyCreate,
    SpokeWheelAssemblyUpdate,
    SpokeWheelAssemblyOut,
    ConcentricityCheckCreate,
    ConcentricityCheckOut,
)
from apps.spoke_wheel.services import (
    create_assembly,
    list_assemblies,
    get_assembly,
    update_assembly,
    create_concentricity_check,
    list_checks_by_assembly,
)


router = APIRouter(prefix="", tags=["App - Spoke Wheel MES - 辐条轮毂总装"])


@router.post(
    "/assemblies",
    response_model=SpokeWheelAssemblyOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_access("spoke-wheel.assembly", "create", required_permissions=["spoke-wheel:assembly:create"]))],
)
async def api_create_assembly(
    payload: SpokeWheelAssemblyCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user=Depends(get_current_user),
):
    """创建总装记录(草稿)"""
    return await create_assembly(payload, tenant_id, current_user)


@router.get(
    "/assemblies",
    response_model=list[SpokeWheelAssemblyOut],
    dependencies=[Depends(require_access("spoke-wheel.assembly", "read", required_permissions=["spoke-wheel:assembly:read"]))],
)
async def api_list_assemblies(
    status_filter: Optional[str] = Query(None, alias="status"),
    work_order_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
):
    items, total = await list_assemblies(tenant_id, status_filter, work_order_id, page, page_size)
    return items


@router.get(
    "/assemblies/{assembly_id}",
    response_model=SpokeWheelAssemblyOut,
    dependencies=[Depends(require_access("spoke-wheel.assembly", "read", required_permissions=["spoke-wheel:assembly:read"]))],
)
async def api_get_assembly(
    assembly_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    return await get_assembly(tenant_id, assembly_id)


@router.patch(
    "/assemblies/{assembly_id}",
    response_model=SpokeWheelAssemblyOut,
    dependencies=[Depends(require_access("spoke-wheel.assembly", "update", required_permissions=["spoke-wheel:assembly:update"]))],
)
async def api_update_assembly(
    assembly_id: int,
    payload: SpokeWheelAssemblyUpdate,
    tenant_id: int = Depends(get_current_tenant),
    current_user=Depends(get_current_user),
):
    return await update_assembly(tenant_id, assembly_id, payload, current_user)


@router.post(
    "/concentricity-checks",
    response_model=ConcentricityCheckOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_access("spoke-wheel.concentricity", "create", required_permissions=["spoke-wheel:concentricity:create"]))],
)
async def api_create_check(
    payload: ConcentricityCheckCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user=Depends(get_current_user),
):
    """录入 3 个百分表读数 → 自动算极差 → 判定同心度是否 ≤ tolerance(默认 0.8mm)"""
    return await create_concentricity_check(payload, tenant_id, current_user)


@router.get(
    "/concentricity-checks/by-assembly/{assembly_id}",
    response_model=list[ConcentricityCheckOut],
    dependencies=[Depends(require_access("spoke-wheel.concentricity", "read", required_permissions=["spoke-wheel:concentricity:read"]))],
)
async def api_list_checks(
    assembly_id: int,
    tenant_id: int = Depends(get_current_tenant),
):
    return await list_checks_by_assembly(tenant_id, assembly_id)