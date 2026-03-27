"""
成本核算规则 API 路由（轻管理会计）

Author: Luigi Lu
Date: 2026-03-14
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from tortoise.queryset import Q

from apps.kuaizhizao.schemas.cost import (
    CostRuleCreate,
    CostRuleUpdate,
    CostRuleResponse,
    CostRuleListResponse,
)
from apps.kuaicaiwu.services.cost_service import CostRuleService
from apps.kuaicaiwu.models.cost_rule import CostRule
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/cost/rules", tags=["Kuaicaiwu Cost Rules"])


@router.post("", response_model=CostRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_rule(
    data: CostRuleCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_rule = await CostRuleService().create_cost_rule(
            tenant_id=tenant_id,
            cost_rule_data=data,
            created_by=current_user.id
        )
        return CostRuleResponse.model_validate(cost_rule)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.get("", response_model=CostRuleListResponse)
async def list_cost_rules(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    rule_type: Optional[str] = Query(None),
    cost_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    service = CostRuleService()
    count_query = CostRule.filter(tenant_id=tenant_id, deleted_at__isnull=True)
    if rule_type:
        count_query = count_query.filter(rule_type=rule_type)
    if cost_type:
        count_query = count_query.filter(cost_type=cost_type)
    if is_active is not None:
        count_query = count_query.filter(is_active=is_active)
    if search:
        count_query = count_query.filter(Q(code__icontains=search) | Q(name__icontains=search))
    total = await count_query.count()
    rules = await service.list_cost_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        rule_type=rule_type,
        cost_type=cost_type,
        is_active=is_active,
        search=search,
    )
    return CostRuleListResponse(items=rules, total=total, skip=skip, limit=limit)


@router.get("/{uuid}", response_model=CostRuleResponse)
async def get_cost_rule(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_rule = await CostRule.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_rule:
            raise NotFoundError(f"成本核算规则 {uuid} 不存在")
        cost_rule_response = await CostRuleService().get_cost_rule_by_id(
            tenant_id=tenant_id,
            cost_rule_id=cost_rule.id
        )
        return CostRuleResponse.model_validate(cost_rule_response)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{uuid}", response_model=CostRuleResponse)
async def update_cost_rule(
    uuid: str,
    data: CostRuleUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_rule = await CostRule.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_rule:
            raise NotFoundError(f"成本核算规则 {uuid} 不存在")
        cost_rule_response = await CostRuleService().update_cost_rule(
            tenant_id=tenant_id,
            cost_rule_id=cost_rule.id,
            cost_rule_data=data,
            updated_by=current_user.id
        )
        return CostRuleResponse.model_validate(cost_rule_response)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost_rule(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        cost_rule = await CostRule.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_rule:
            raise NotFoundError(f"成本核算规则 {uuid} 不存在")
        await CostRuleService().delete_cost_rule(
            tenant_id=tenant_id,
            cost_rule_id=cost_rule.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/init-presets", status_code=status.HTTP_201_CREATED)
async def init_preset_rules(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await CostRuleService().init_preset_rules(
            tenant_id=tenant_id,
            created_by=current_user.id
        )
        return {"status": "success", "message": "已初始化推荐成本核算规则"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
