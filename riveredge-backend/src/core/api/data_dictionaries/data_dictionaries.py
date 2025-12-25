"""
数据字典管理 API 路由

提供数据字典的 CRUD 操作和字典项管理。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.models.data_dictionary import DataDictionary
from core.models.dictionary_item import DictionaryItem
from core.schemas.data_dictionary import (
    DataDictionaryCreate,
    DataDictionaryUpdate,
    DataDictionaryResponse,
)
from core.schemas.dictionary_item import (
    DictionaryItemCreate,
    DictionaryItemUpdate,
    DictionaryItemResponse,
)
from core.services.data.data_dictionary_service import DataDictionaryService
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/data-dictionaries", tags=["Core Data Dictionaries"])


@router.post("", response_model=DataDictionaryResponse, status_code=status.HTTP_201_CREATED)
async def create_dictionary(
    data: DataDictionaryCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建数据字典
    
    创建新数据字典并保存到数据库。
    
    Args:
        data: 数据字典创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataDictionaryResponse: 创建的数据字典对象
        
    Raises:
        HTTPException: 当字典代码已存在或数据验证失败时抛出
    """
    try:
        dictionary = await DataDictionaryService.create_dictionary(
            tenant_id=tenant_id,
            data=data
        )
        return DataDictionaryResponse.model_validate(dictionary)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[DataDictionaryResponse])
async def list_dictionaries(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据字典列表
    
    获取当前组织的数据字典列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[DataDictionaryResponse]: 数据字典列表
    """
    dictionaries = await DataDictionaryService.list_dictionaries(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        is_active=is_active
    )
    return [DataDictionaryResponse.model_validate(d) for d in dictionaries]


@router.get("/{uuid}", response_model=DataDictionaryResponse)
async def get_dictionary(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取数据字典详情
    
    根据UUID获取数据字典的详细信息。
    
    Args:
        uuid: 数据字典UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataDictionaryResponse: 数据字典对象
        
    Raises:
        HTTPException: 当字典不存在时抛出
    """
    try:
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return DataDictionaryResponse.model_validate(dictionary)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/code/{code}", response_model=DataDictionaryResponse)
async def get_dictionary_by_code(
    code: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    根据代码获取数据字典
    
    根据字典代码获取数据字典的详细信息。
    
    Args:
        code: 字典代码
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataDictionaryResponse: 数据字典对象
        
    Raises:
        HTTPException: 当字典不存在时抛出
    """
    dictionary = await DataDictionaryService.get_dictionary_by_code(
        tenant_id=tenant_id,
        code=code
    )
    
    if not dictionary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="字典不存在"
        )
    
    return DataDictionaryResponse.model_validate(dictionary)


@router.put("/{uuid}", response_model=DataDictionaryResponse)
async def update_dictionary(
    uuid: str,
    data: DataDictionaryUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新数据字典
    
    更新数据字典的信息。
    
    Args:
        uuid: 数据字典UUID
        data: 更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DataDictionaryResponse: 更新后的数据字典对象
        
    Raises:
        HTTPException: 当字典不存在或数据验证失败时抛出
    """
    try:
        dictionary = await DataDictionaryService.update_dictionary(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return DataDictionaryResponse.model_validate(dictionary)
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
async def delete_dictionary(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除数据字典（软删除）
    
    删除数据字典，系统字典不可删除。
    
    Args:
        uuid: 数据字典UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当字典不存在或是系统字典时抛出
    """
    try:
        await DataDictionaryService.delete_dictionary(
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


# 字典项 API
@router.post("/{dictionary_uuid}/items", response_model=DictionaryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    dictionary_uuid: str,
    data: DictionaryItemCreate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建字典项
    
    为指定字典创建新的字典项。
    
    Args:
        dictionary_uuid: 字典UUID
        data: 字典项创建数据（会自动设置 dictionary_uuid）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DictionaryItemResponse: 创建的字典项对象
        
    Raises:
        HTTPException: 当字典不存在或字典项值已存在时抛出
    """
    # 设置字典UUID
    data.dictionary_uuid = dictionary_uuid
    
    try:
        item = await DataDictionaryService.create_item(
            tenant_id=tenant_id,
            data=data
        )
        
        # 获取字典UUID用于响应
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id=tenant_id,
            uuid=dictionary_uuid
        )
        
        response = DictionaryItemResponse.model_validate(item)
        response.dictionary_uuid = dictionary.uuid
        return response
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


@router.get("/{dictionary_uuid}/items", response_model=List[DictionaryItemResponse])
async def list_items(
    dictionary_uuid: str,
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取字典项列表
    
    获取指定字典的所有字典项。
    
    Args:
        dictionary_uuid: 字典UUID
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[DictionaryItemResponse]: 字典项列表
        
    Raises:
        HTTPException: 当字典不存在时抛出
    """
    try:
        items = await DataDictionaryService.get_items_by_dictionary(
            tenant_id=tenant_id,
            dictionary_uuid=dictionary_uuid,
            is_active=is_active
        )
        
        # 获取字典UUID用于响应
        dictionary = await DataDictionaryService.get_dictionary_by_uuid(
            tenant_id=tenant_id,
            uuid=dictionary_uuid
        )
        
        return [
            DictionaryItemResponse.model_validate(item, update={"dictionary_uuid": dictionary.uuid})
            for item in items
        ]
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/items/{uuid}", response_model=DictionaryItemResponse)
async def update_item(
    uuid: str,
    data: DictionaryItemUpdate,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新字典项
    
    更新字典项的信息。
    
    Args:
        uuid: 字典项UUID
        data: 更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        DictionaryItemResponse: 更新后的字典项对象
        
    Raises:
        HTTPException: 当字典项不存在或数据验证失败时抛出
    """
    try:
        item = await DataDictionaryService.update_item(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        
        # 获取字典UUID用于响应
        dictionary = await DataDictionary.filter(
            id=item.dictionary_id,
            tenant_id=tenant_id
        ).first()
        
        response = DictionaryItemResponse.model_validate(item)
        response.dictionary_uuid = dictionary.uuid if dictionary else ""
        return response
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


@router.delete("/items/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除字典项（软删除）
    
    删除字典项。
    
    Args:
        uuid: 字典项UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当字典项不存在时抛出
    """
    try:
        await DataDictionaryService.delete_item(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

