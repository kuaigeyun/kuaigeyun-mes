"""
语言管理 API 路由

提供语言的 CRUD 操作和翻译管理。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.language import (
    LanguageCreate,
    LanguageUpdate,
    LanguageResponse,
    TranslationUpdateRequest,
    TranslationGetResponse,
)
from core.services.language_service import LanguageService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/languages", tags=["Languages"])


@router.post("", response_model=LanguageResponse, status_code=status.HTTP_201_CREATED)
async def create_language(
    data: LanguageCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建语言
    
    创建新语言并保存到数据库。
    
    Args:
        data: 语言创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        LanguageResponse: 创建的语言对象
        
    Raises:
        HTTPException: 当语言代码已存在时抛出
    """
    try:
        language = await LanguageService.create_language(
            tenant_id=tenant_id,
            data=data
        )
        return LanguageResponse.model_validate(language)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[LanguageResponse])
async def list_languages(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取语言列表
    
    获取当前组织的语言列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[LanguageResponse]: 语言列表
    """
    languages = await LanguageService.list_languages(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [LanguageResponse.model_validate(l) for l in languages]


@router.get("/{uuid}", response_model=LanguageResponse)
async def get_language(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取语言详情
    
    根据UUID获取语言的详细信息。
    
    Args:
        uuid: 语言UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        LanguageResponse: 语言对象
        
    Raises:
        HTTPException: 当语言不存在时抛出
    """
    try:
        language = await LanguageService.get_language_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return LanguageResponse.model_validate(language)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=LanguageResponse)
async def update_language(
    uuid: str,
    data: LanguageUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新语言
    
    更新语言信息。
    
    Args:
        uuid: 语言UUID
        data: 语言更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        LanguageResponse: 更新后的语言对象
        
    Raises:
        HTTPException: 当语言不存在时抛出
    """
    try:
        language = await LanguageService.update_language(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return LanguageResponse.model_validate(language)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_language(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除语言（软删除）
    
    删除语言（软删除）。
    默认语言不可删除。
    
    Args:
        uuid: 语言UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当语言不存在或是默认语言时抛出
    """
    try:
        await LanguageService.delete_language(
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


@router.get("/code/{code}/translations", response_model=TranslationGetResponse)
async def get_translations(
    code: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取翻译内容
    
    根据语言代码获取翻译内容。
    如果语言不存在，返回默认语言的翻译。
    
    Args:
        code: 语言代码
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        TranslationGetResponse: 翻译内容
    """
    translations = await LanguageService.get_translations(tenant_id, code)
    
    # 获取语言信息
    language = await LanguageService.get_language_by_code(tenant_id, code)
    if not language:
        default_language = await LanguageService.get_default_language(tenant_id)
        if default_language:
            return TranslationGetResponse(
                translations=translations,
                language_code=default_language.code,
                language_name=default_language.name
            )
        return TranslationGetResponse(
            translations=translations,
            language_code=code,
            language_name=code
        )
    
    return TranslationGetResponse(
        translations=translations,
        language_code=language.code,
        language_name=language.name
    )


@router.put("/{uuid}/translations", response_model=LanguageResponse)
async def update_translations(
    uuid: str,
    data: TranslationUpdateRequest,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新翻译内容
    
    更新指定语言的翻译内容。
    
    Args:
        uuid: 语言UUID
        data: 翻译更新请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        LanguageResponse: 更新后的语言对象
        
    Raises:
        HTTPException: 当语言不存在时抛出
    """
    try:
        language = await LanguageService.update_translations(
            tenant_id=tenant_id,
            uuid=uuid,
            translations=data.translations
        )
        return LanguageResponse.model_validate(language)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

