"""
编码规则管理 API 路由

提供编码规则的 CRUD 操作和编码生成功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body

from core.schemas.code_rule import (
    CodeRuleCreate,
    CodeRuleUpdate,
    CodeRuleResponse,
    CodeGenerationRequest,
    CodeGenerationResponse,
)
from core.services.business.code_rule_service import CodeRuleService
from core.services.business.code_generation_service import CodeGenerationService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/code-rules", tags=["Code Rules"])


@router.post("", response_model=CodeRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    data: CodeRuleCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建编码规则
    
    创建新编码规则并保存到数据库。
    
    Args:
        data: 编码规则创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeRuleResponse: 创建的编码规则对象
        
    Raises:
        HTTPException: 当规则代码已存在或表达式无效时抛出
    """
    try:
        rule = await CodeRuleService.create_rule(
            tenant_id=tenant_id,
            data=data
        )
        return CodeRuleResponse.model_validate(rule)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[CodeRuleResponse])
async def list_rules(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取编码规则列表
    
    获取当前组织的编码规则列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[CodeRuleResponse]: 编码规则列表
    """
    rules = await CodeRuleService.list_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [CodeRuleResponse.model_validate(r) for r in rules]


@router.get("/{uuid}", response_model=CodeRuleResponse)
async def get_rule(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取编码规则详情
    
    根据UUID获取编码规则的详细信息。
    
    Args:
        uuid: 规则UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeRuleResponse: 编码规则对象
        
    Raises:
        HTTPException: 当规则不存在时抛出
    """
    try:
        rule = await CodeRuleService.get_rule_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return CodeRuleResponse.model_validate(rule)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=CodeRuleResponse)
async def update_rule(
    uuid: str,
    data: CodeRuleUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新编码规则
    
    更新编码规则信息。
    
    Args:
        uuid: 规则UUID
        data: 编码规则更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeRuleResponse: 更新后的编码规则对象
        
    Raises:
        HTTPException: 当规则不存在或表达式无效时抛出
    """
    try:
        rule = await CodeRuleService.update_rule(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return CodeRuleResponse.model_validate(rule)
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
async def delete_rule(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除编码规则（软删除）
    
    删除编码规则（软删除）。
    系统规则不可删除。
    
    Args:
        uuid: 规则UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当规则不存在或是系统规则时抛出
    """
    try:
        await CodeRuleService.delete_rule(
            tenant_id=tenant_id,
            uuid=uuid
        )
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


@router.post("/generate", response_model=CodeGenerationResponse)
async def generate_code(
    request: CodeGenerationRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    生成编码（会更新序号）
    
    根据编码规则生成编码，并更新序号。
    
    Args:
        request: 编码生成请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeGenerationResponse: 生成的编码
        
    Raises:
        HTTPException: 当规则不存在或未启用时抛出
    """
    try:
        code = await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=request.rule_code,
            context=request.context
        )
        
        # 获取规则名称
        rule = await CodeRuleService.get_rule_by_code(tenant_id, request.rule_code)
        rule_name = rule.name if rule else request.rule_code
        
        return CodeGenerationResponse(
            code=code,
            rule_name=rule_name
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.post("/test-generate", response_model=CodeGenerationResponse)
async def test_generate_code(
    request: CodeGenerationRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试生成编码（不更新序号）
    
    根据编码规则测试生成编码，不更新序号。
    
    Args:
        request: 编码生成请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeGenerationResponse: 生成的编码（测试用）
        
    Raises:
        HTTPException: 当规则不存在或未启用时抛出
    """
    try:
        code = await CodeGenerationService.test_generate_code(
            tenant_id=tenant_id,
            rule_code=request.rule_code,
            context=request.context
        )
        
        # 获取规则名称
        rule = await CodeRuleService.get_rule_by_code(tenant_id, request.rule_code)
        rule_name = rule.name if rule else request.rule_code
        
        return CodeGenerationResponse(
            code=code,
            rule_name=rule_name
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

