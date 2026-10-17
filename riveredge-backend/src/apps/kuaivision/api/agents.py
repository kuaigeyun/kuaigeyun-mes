"""边缘节点管理 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status

from apps.kuaivision.schemas.vision import AgentCreate, AgentListResponse, AgentResponse, AgentUpdate
from apps.kuaivision.services.agent_service import AgentService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant, get_current_user
from infra.models.user import User

router = APIRouter(prefix="/agents", tags=["App - KuaiVision - Agents"])


@router.get(
    "",
    response_model=AgentListResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:read"))],
)
async def list_agents(
    tenant_id: int = Depends(get_current_tenant),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: Optional[str] = None,
):
    items, total = await AgentService.list_agents(tenant_id, page=page, page_size=page_size, q=q)
    return AgentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post(
    "",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:create"))],
)
async def create_agent(
    data: AgentCreate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await AgentService.create(tenant_id, data, user)


@router.get(
    "/{uuid}",
    response_model=AgentResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:read"))],
)
async def get_agent(uuid: str, tenant_id: int = Depends(get_current_tenant)):
    return await AgentService.get_response(tenant_id, uuid)


@router.put(
    "/{uuid}",
    response_model=AgentResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:update"))],
)
async def update_agent(
    uuid: str,
    data: AgentUpdate,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await AgentService.update(tenant_id, uuid, data, user)


@router.post(
    "/{uuid}/rotate-token",
    response_model=AgentResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:update"))],
)
async def rotate_token(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await AgentService.rotate_token(tenant_id, uuid, user)


@router.post(
    "/{uuid}/bump-config",
    response_model=AgentResponse,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:update"))],
)
async def bump_config(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    return await AgentService.bump_config(tenant_id, uuid, user)


@router.delete(
    "/{uuid}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission_codes("kuaivision:agent:delete"))],
)
async def delete_agent(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
):
    await AgentService.soft_delete(tenant_id, uuid, user)
