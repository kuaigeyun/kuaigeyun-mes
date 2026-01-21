"""
成本核算规则 API 路由

提供成本核算规则的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.cost import (
    CostRuleCreate,
    CostRuleUpdate,
    CostRuleResponse,
    CostRuleListResponse,
)
from apps.kuaizhizao.services.cost_service import CostRuleService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/cost/rules", tags=["Kuaige Zhizao Cost Rules"])


@router.post("", response_model=CostRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_rule(
    data: CostRuleCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建成本核算规则
    
    创建新的成本核算规则并保存到数据库。
    
    Args:
        data: 成本核算规则创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostRuleResponse: 创建的成本核算规则对象
        
    Raises:
        HTTPException: 当规则编码已存在或数据验证失败时抛出
    """
    try:
        cost_rule = await CostRuleService().create_cost_rule(
            tenant_id=tenant_id,
            cost_rule_data=data,
            created_by=current_user.id
        )
        return CostRuleResponse.model_validate(cost_rule)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=CostRuleListResponse)
async def list_cost_rules(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    rule_type: Optional[str] = Query(None, description="规则类型（可选）"),
    cost_type: Optional[str] = Query(None, description="成本类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选，搜索编码、名称）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询成本核算规则列表
    
    根据条件查询成本核算规则列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        rule_type: 规则类型（可选）
        cost_type: 成本类型（可选）
        is_active: 是否启用（可选）
        search: 搜索关键词（可选）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostRuleListResponse: 成本核算规则列表
    """
    service = CostRuleService()
    
    # 先查询总数（使用相同的查询条件，但不分页）
    from apps.kuaizhizao.models.cost_rule import CostRule
    from tortoise.queryset import Q
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
    
    # 查询分页数据
    rules = await service.list_cost_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        rule_type=rule_type,
        cost_type=cost_type,
        is_active=is_active,
        search=search,
    )
    
    return CostRuleListResponse(
        items=rules,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/{uuid}", response_model=CostRuleResponse)
async def get_cost_rule(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询成本核算规则详情
    
    根据UUID查询成本核算规则详情。
    
    Args:
        uuid: 成本核算规则UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostRuleResponse: 成本核算规则详情
        
    Raises:
        HTTPException: 当成本核算规则不存在时抛出
    """
    try:
        # 先通过UUID获取ID
        from apps.kuaizhizao.models.cost_rule import CostRule
        cost_rule = await CostRule.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_rule:
            raise NotFoundError(f"成本核算规则 {uuid} 不存在")
        
        cost_rule_response = await CostRuleService().get_cost_rule_by_id(
            tenant_id=tenant_id,
            cost_rule_id=cost_rule.id
        )
        return CostRuleResponse.model_validate(cost_rule_response)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=CostRuleResponse)
async def update_cost_rule(
    uuid: str,
    data: CostRuleUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新成本核算规则
    
    根据UUID更新成本核算规则。
    
    Args:
        uuid: 成本核算规则UUID
        data: 成本核算规则更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CostRuleResponse: 更新后的成本核算规则对象
        
    Raises:
        HTTPException: 当成本核算规则不存在或数据验证失败时抛出
    """
    try:
        # 先通过UUID获取ID
        from apps.kuaizhizao.models.cost_rule import CostRule
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cost_rule(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除成本核算规则（软删除）
    
    根据UUID删除成本核算规则（软删除）。
    
    Args:
        uuid: 成本核算规则UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当成本核算规则不存在时抛出
    """
    try:
        # 先通过UUID获取ID
        from apps.kuaizhizao.models.cost_rule import CostRule
        cost_rule = await CostRule.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not cost_rule:
            raise NotFoundError(f"成本核算规则 {uuid} 不存在")
        
        await CostRuleService().delete_cost_rule(
            tenant_id=tenant_id,
            cost_rule_id=cost_rule.id
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

