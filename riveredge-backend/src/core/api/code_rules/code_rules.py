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
from core.config.code_rule_pages import (
    CODE_RULE_PAGES,
    PAGE_CODE_TO_FIXED_TEXT_PRESET,
    get_canonical_rule_code,
)
from core.services.business.code_rule_service import CodeRuleService
from core.services.business.code_generation_service import CodeGenerationService
from core.api.deps.deps import get_current_tenant
from core.services.system.installed_feature_scope import (
    code_rule_disallowed_rule_codes,
    get_installed_application_codes,
    is_page_path_in_installed_apps,
)
from core.services.code_rule.code_rule_page_discovery import apply_manifest_display_overlay
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/code-rules", tags=["Core - Code Rules"])


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
    installed = await get_installed_application_codes(tenant_id)
    rules = await CodeRuleService.list_rules(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active,
        disallowed_rule_codes=code_rule_disallowed_rule_codes(installed),
    )
    return [CodeRuleResponse.model_validate(r) for r in rules]


@router.get("/pages", response_model=List[CodeRulePageConfigResponse])
async def list_code_rule_pages(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取编码规则功能页面配置列表
    
    返回系统中所有有编码字段的功能页面配置，用于在编码规则页面展示和配置。
    以 core.config.code_rule_pages.CODE_RULE_PAGES 为完整数据源（含 rule_code 等技术字段），
    展示名称（page_name、code_field_label、module）优先与各应用 manifest.code_rule_pages 对齐。
    仅返回路由归属应用已在当前租户安装并启用的页面。
    
    Returns:
        List[CodeRulePageConfigResponse]: 功能页面配置列表
    """
    installed = await get_installed_application_codes(tenant_id)
    # 使用后端完整配置作为唯一数据源，确保编码规则页面列表完整
    # 为每个页面附加 fixed_text_preset（拼音缩写），前端无需维护重复配置
    result = []
    for page in CODE_RULE_PAGES:
        if not is_page_path_in_installed_apps(page.get("page_path"), installed):
            continue
        p = apply_manifest_display_overlay(dict(page))
        p["fixed_text_preset"] = PAGE_CODE_TO_FIXED_TEXT_PRESET.get(p.get("page_code", ""))
        result.append(CodeRulePageConfigResponse(**p))
    return result


@router.get("/pages/{page_code}", response_model=CodeRulePageConfigResponse)
async def get_page_config(
    page_code: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取指定页面的编码规则配置
    
    根据页面代码获取编码规则配置，包括是否自动生成、是否允许手动填写等。
    从 core.config.code_rule_pages.CODE_RULE_PAGES 中查找。
    
    Args:
        page_code: 页面代码（如：kuaizhizao-sales-order）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        CodeRulePageConfigResponse: 页面编码规则配置
        
    Raises:
        HTTPException: 当页面不存在时抛出
    """
    # 从完整配置中查找页面
    page_config = None
    for page in CODE_RULE_PAGES:
        if page.get("page_code") == page_code:
            page_config = page.copy()
            break

    if not page_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"页面配置不存在: {page_code}"
        )
    page_config = apply_manifest_display_overlay(page_config)
    installed = await get_installed_application_codes(tenant_id)
    if not is_page_path_in_installed_apps(page_config.get("page_path"), installed):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"页面配置不可用（应用未启用）: {page_code}",
        )
    page_config["fixed_text_preset"] = PAGE_CODE_TO_FIXED_TEXT_PRESET.get(page_code)

    canonical_rule_code = get_canonical_rule_code(page_code)
    page_config["rule_code"] = canonical_rule_code

    if canonical_rule_code:
        rule = await CodeRuleService.get_rule_by_code(
            tenant_id, canonical_rule_code, active_only=False
        )
        if rule:
            page_config["allow_manual_edit"] = rule.allow_manual_edit
            page_config["auto_generate"] = rule.is_active
        else:
            page_config["auto_generate"] = False
    else:
        page_config["auto_generate"] = False

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
    生成编码（会更新序号）。
    仅按 manifest rule_code 精确查找已保存规则。
    """
    try:
        code = await CodeGenerationService.generate_code(
            tenant_id=tenant_id,
            rule_code=request.rule_code,
            context=request.context
        )
        rule, _ = await CodeRuleService.resolve_rule_by_code(tenant_id, request.rule_code)
        rule_name = rule.name if rule else request.rule_code
        return CodeGenerationResponse(code=code, rule_name=rule_name)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.post("/restore-preset")
async def restore_preset_rules(
    scope: str = Body("all", embed=True),  # 'all' | 'page'
    page_code: Optional[str] = Body(None, embed=True),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    恢复预置编码规则
    
    - scope='all': 为所有页面恢复/创建预设规则（拼音缩写+4位流水 或 拼音缩写+YYYYMMDD+4位流水）
    - scope='page': 为指定 page_code 恢复预设规则
    """
    from core.services.default.default_values_service import DefaultValuesService
    
    restored = []
    if scope == "all":
        restored = await DefaultValuesService.restore_all_preset_pages(tenant_id)
    elif scope == "page" and page_code:
        ok = await DefaultValuesService.restore_preset_for_page(tenant_id, page_code)
        if ok:
            restored.append(page_code)
    
    return {"restored": restored, "message": f"已恢复 {len(restored)} 个页面的预设规则"}


@router.post("/enable-all")
async def enable_all_rules(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量启用所有编码规则

    将当前组织下所有未启用的编码规则设置为启用状态。
    """
    count = await CodeRuleService.bulk_enable_all(tenant_id)
    return {"enabled": count, "message": f"已启用 {count} 个编码规则"}


@router.post("/test-generate", response_model=CodeGenerationResponse)
async def test_generate_code(
    request: CodeGenerationRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试生成编码（不更新序号）。
    仅按 manifest rule_code 精确查找已保存规则。
    """
    try:
        code = await CodeGenerationService.test_generate_code(
            tenant_id=tenant_id,
            rule_code=request.rule_code,
            context=request.context,
            check_duplicate=request.check_duplicate or False,
            entity_type=request.entity_type
        )
        rule, _ = await CodeRuleService.resolve_rule_by_code(tenant_id, request.rule_code)
        rule_name = rule.name if rule else request.rule_code
        if not (code or "").strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"编码规则 {request.rule_code} 未生成有效编号，请检查规则是否已启用并保存",
            )
        return CodeGenerationResponse(code=code, rule_name=rule_name)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

