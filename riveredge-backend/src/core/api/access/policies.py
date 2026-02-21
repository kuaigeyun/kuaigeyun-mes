from fastapi import APIRouter, Depends, HTTPException, status

from core.api.deps.access import require_access
from core.api.deps.deps import get_current_tenant
from core.models.policy_binding import PolicyBinding
from core.schemas.access_policy import AccessPolicyCreate, AccessPolicyResponse, AccessPolicyUpdate
from core.services.authorization.access_policy_service import AccessPolicyService
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/access/policies", tags=["Core Access Policies"])


async def _to_policy_response(item) -> AccessPolicyResponse:
    bindings = await PolicyBinding.filter(policy_id=item.id).all()
    return AccessPolicyResponse(
        uuid=str(item.uuid),
        tenant_id=item.tenant_id,
        name=item.name,
        effect=item.effect,
        priority=item.priority,
        target_resource=item.target_resource,
        target_action=item.target_action,
        condition_expr=item.condition_expr,
        enabled=item.enabled,
        bindings=[
            {"subject_type": b.subject_type, "subject_id": b.subject_id}
            for b in bindings
        ],
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("", response_model=list[AccessPolicyResponse])
async def list_policies(
    _: object = Depends(require_access("system.policy", "read")),
    tenant_id: int = Depends(get_current_tenant),
):
    items = await AccessPolicyService.list_policies(tenant_id=tenant_id)
    return [await _to_policy_response(i) for i in items]


@router.post("", response_model=AccessPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    data: AccessPolicyCreate,
    _: object = Depends(require_access("system.policy", "create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        item = await AccessPolicyService.create_policy(tenant_id=tenant_id, data=data.model_dump())
        return await _to_policy_response(item)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.put("/{policy_uuid}", response_model=AccessPolicyResponse)
async def update_policy(
    policy_uuid: str,
    data: AccessPolicyUpdate,
    _: object = Depends(require_access("system.policy", "update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        item = await AccessPolicyService.update_policy(tenant_id=tenant_id, policy_uuid=policy_uuid, data=data.model_dump(exclude_unset=True))
        return await _to_policy_response(item)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{policy_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(
    policy_uuid: str,
    _: object = Depends(require_access("system.policy", "delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await AccessPolicyService.delete_policy(tenant_id=tenant_id, policy_uuid=policy_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
