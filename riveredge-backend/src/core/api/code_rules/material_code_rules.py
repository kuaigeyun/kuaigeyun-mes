"""
物料编码规则配置 API 路由

提供物料编码规则配置的 CRUD 操作、版本管理、编码预览等功能。

Author: Luigi Lu
Date: 2026-01-08
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path, Body

from core.schemas.material_code_rule import (
    MaterialCodeRuleMainCreate,
    MaterialCodeRuleMainUpdate,
    MaterialCodeRuleMainResponse,
    MaterialCodeRuleAliasCreate,
    MaterialCodeRuleAliasUpdate,
    MaterialCodeRuleAliasResponse,
    CodePreviewRequest,
    CodePreviewResponse,
)
from core.services.business.material_code_rule_service import MaterialCodeRuleService
from core.api.deps.deps import get_current_tenant, get_current_user_id
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/material-code-rules", tags=["Material Code Rules"])


# ==================== 主编码规则配置 ====================

@router.get("/main/active", response_model=MaterialCodeRuleMainResponse)
async def get_active_main_rule(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取当前生效的主编码规则
    
    Args:
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MaterialCodeRuleMainResponse: 当前生效的主编码规则
        
    Raises:
        HTTPException: 当规则不存在时抛出
    """
    rule = await MaterialCodeRuleService.get_active_main_rule(tenant_id=tenant_id)
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="未找到当前生效的主编码规则"
        )
    return MaterialCodeRuleMainResponse.model_validate(rule)


@router.post("/main", response_model=MaterialCodeRuleMainResponse, status_code=status.HTTP_201_CREATED)
async def create_main_rule(
    data: MaterialCodeRuleMainCreate,
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    创建主编码规则
    
    Args:
        data: 主编码规则创建数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialCodeRuleMainResponse: 创建的主编码规则对象
        
    Raises:
        HTTPException: 当模板无效时抛出
    """
    try:
        rule = await MaterialCodeRuleService.create_main_rule(
            tenant_id=tenant_id,
            rule_name=data.rule_name,
            template=data.template,
            prefix=data.prefix,
            sequence_config=data.sequence_config,
            material_types=[mt.dict() for mt in data.material_types] if data.material_types else None,
            created_by=user_id,
        )
        return MaterialCodeRuleMainResponse.model_validate(rule)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.put("/main/{rule_id}", response_model=MaterialCodeRuleMainResponse)
async def update_main_rule(
    rule_id: int = Path(..., description="规则ID"),
    data: MaterialCodeRuleMainUpdate = Body(...),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    更新主编码规则
    
    Args:
        rule_id: 规则ID
        data: 主编码规则更新数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialCodeRuleMainResponse: 更新后的主编码规则对象
        
    Raises:
        HTTPException: 当规则不存在或模板无效时抛出
    """
    try:
        rule = await MaterialCodeRuleService.update_main_rule(
            tenant_id=tenant_id,
            rule_id=rule_id,
            rule_name=data.rule_name,
            template=data.template,
            prefix=data.prefix,
            sequence_config=data.sequence_config,
            material_types=[mt.dict() for mt in data.material_types] if data.material_types else None,
            updated_by=user_id,
        )
        return MaterialCodeRuleMainResponse.model_validate(rule)
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


@router.post("/main/{rule_id}/activate", response_model=MaterialCodeRuleMainResponse)
async def activate_main_rule(
    rule_id: int = Path(..., description="规则ID"),
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    启用主编码规则（禁用其他规则）
    
    Args:
        rule_id: 规则ID
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialCodeRuleMainResponse: 启用后的主编码规则对象
        
    Raises:
        HTTPException: 当规则不存在时抛出
    """
    try:
        rule = await MaterialCodeRuleService.activate_main_rule(
            tenant_id=tenant_id,
            rule_id=rule_id,
            updated_by=user_id,
        )
        return MaterialCodeRuleMainResponse.model_validate(rule)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


# ==================== 部门编码规则配置 ====================

@router.get("/alias/{code_type}", response_model=MaterialCodeRuleAliasResponse)
async def get_alias_rule(
    code_type: str = Path(..., description="编码类型代码"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取部门编码规则
    
    Args:
        code_type: 编码类型代码（如：SALE, DES, SUP）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        MaterialCodeRuleAliasResponse: 部门编码规则对象
        
    Raises:
        HTTPException: 当规则不存在时抛出
    """
    rule = await MaterialCodeRuleService.get_alias_rule(
        tenant_id=tenant_id,
        code_type=code_type,
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到编码类型 {code_type} 的规则配置"
        )
    return MaterialCodeRuleAliasResponse.model_validate(rule)


@router.post("/alias", response_model=MaterialCodeRuleAliasResponse, status_code=status.HTTP_201_CREATED)
async def create_alias_rule(
    data: MaterialCodeRuleAliasCreate,
    tenant_id: int = Depends(get_current_tenant),
    user_id: Optional[int] = Depends(get_current_user_id),
):
    """
    创建部门编码规则
    
    Args:
        data: 部门编码规则创建数据
        tenant_id: 当前组织ID（依赖注入）
        user_id: 当前用户ID（依赖注入）
        
    Returns:
        MaterialCodeRuleAliasResponse: 创建的部门编码规则对象
        
    Raises:
        HTTPException: 当编码类型已存在或模板无效时抛出
    """
    try:
        rule = await MaterialCodeRuleService.create_alias_rule(
            tenant_id=tenant_id,
            code_type=data.code_type,
            code_type_name=data.code_type_name,
            template=data.template,
            prefix=data.prefix,
            validation_pattern=data.validation_pattern,
            departments=data.departments,
            created_by=user_id,
        )
        return MaterialCodeRuleAliasResponse.model_validate(rule)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


# ==================== 编码预览 ====================

@router.post("/preview", response_model=CodePreviewResponse)
async def preview_code(
    data: CodePreviewRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    预览编码生成效果
    
    用于在配置规则时预览编码生成效果。
    
    Args:
        data: 编码预览请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodePreviewResponse: 预览的编码
        
    Raises:
        HTTPException: 当模板无效时抛出
    """
    try:
        preview_code = await MaterialCodeRuleService.preview_code(
            tenant_id=tenant_id,
            template=data.template,
            prefix=data.prefix,
            material_type=data.material_type,
            sample_sequence=data.sample_sequence,
        )
        return CodePreviewResponse(preview_code=preview_code)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
