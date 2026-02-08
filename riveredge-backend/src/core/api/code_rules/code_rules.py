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
    CodeRulePageConfigResponse,
)
from core.config.code_rule_pages import CODE_RULE_PAGES
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


@router.get("/pages", response_model=List[CodeRulePageConfigResponse])
async def list_code_rule_pages():
    """
    获取编码规则功能页面配置列表
    
    返回系统中所有有编码字段的功能页面配置，用于在编码规则页面展示和配置。
    通过服务发现机制自动从应用的 manifest.json 中提取页面配置。
    
    Returns:
        List[CodeRulePageConfigResponse]: 功能页面配置列表
    """
    from core.services.code_rule.code_rule_page_discovery import CodeRulePageDiscoveryService
    
    # 使用服务发现获取页面配置
    pages = CodeRulePageDiscoveryService.get_all_pages()
    return [CodeRulePageConfigResponse(**page) for page in pages]


@router.get("/pages/{page_code}", response_model=CodeRulePageConfigResponse)
async def get_page_config(
    page_code: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取指定页面的编码规则配置
    
    根据页面代码获取编码规则配置，包括是否自动生成、是否允许手动填写等。
    通过服务发现机制自动从应用的 manifest.json 中查找页面配置。
    
    Args:
        page_code: 页面代码（如：kuaizhizao-sales-order）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeRulePageConfigResponse: 页面编码规则配置
        
    Raises:
        HTTPException: 当页面不存在时抛出
    """
    from core.services.code_rule.code_rule_page_discovery import CodeRulePageDiscoveryService
    
    # 使用服务发现获取所有页面配置
    all_pages = CodeRulePageDiscoveryService.get_all_pages()
    
    # 查找页面配置
    page_config = None
    for page in all_pages:
        if page.get("page_code") == page_code:
            page_config = page.copy()
            break
    
    if not page_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"页面配置不存在: {page_code}"
        )
    
    # 获取规则代码：优先使用配置的 rule_code，否则由 page_code 派生（如 master-data-factory-workshop -> MASTER_DATA_FACTORY_WORKSHOP）
    rule_code = page_config.get("rule_code") or page_code.upper().replace("-", "_")
    
    # 如果配置了编码规则或可派生，尝试从数据库获取规则详情
    if rule_code:
        try:
            rule = await CodeRuleService.get_rule_by_code(tenant_id, rule_code)
            if rule:
                page_config["rule_code"] = rule_code
                page_config["allow_manual_edit"] = rule.allow_manual_edit
                page_config["auto_generate"] = rule.is_active  # 规则启用时自动生成
            elif not page_config.get("rule_code"):
                # 规则不存在且配置中无 rule_code，不添加（保持原样）
                pass
        except Exception:
            # 如果获取规则时出错，保持页面配置的默认值
            pass
    
    return CodeRulePageConfigResponse(**page_config)


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
    如果规则不存在或未启用，返回空编码，不抛出错误（用于预览功能）。
    
    Args:
        request: 编码生成请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeGenerationResponse: 生成的编码（测试用），如果规则不存在则返回空编码
    """
    try:
        code = await CodeGenerationService.test_generate_code(
            tenant_id=tenant_id,
            rule_code=request.rule_code,
            context=request.context,
            check_duplicate=request.check_duplicate or False,
            entity_type=request.entity_type
        )
        
        # 获取规则名称
        rule = await CodeRuleService.get_rule_by_code(tenant_id, request.rule_code)
        rule_name = rule.name if rule else request.rule_code
        
        return CodeGenerationResponse(
            code=code,
            rule_name=rule_name
        )
    except ValidationError as e:
        # 对于 test-generate，如果规则不存在或未启用，返回空编码而不是抛出错误
        # 这样前端可以优雅地处理（规则可能还未创建）
        error_message = str(e)
        if "不存在" in error_message or "未启用" in error_message:
            # 规则不存在或未启用，返回空编码
            return CodeGenerationResponse(
                code="",
                rule_name=request.rule_code
            )
        # 其他验证错误，仍然抛出
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_message
        )

