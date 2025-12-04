"""
电子记录管理 API 路由

提供电子记录的 CRUD 操作和签名、归档功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from core.schemas.electronic_record import (
    ElectronicRecordCreate,
    ElectronicRecordUpdate,
    ElectronicRecordSignRequest,
    ElectronicRecordArchiveRequest,
    ElectronicRecordResponse,
)
from core.services.electronic_record_service import ElectronicRecordService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/electronic-records", tags=["ElectronicRecords"])


@router.post("", response_model=ElectronicRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_electronic_record(
    data: ElectronicRecordCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建电子记录
    
    创建新的电子记录。
    
    Args:
        data: 电子记录创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ElectronicRecordResponse: 创建的电子记录对象
        
    Raises:
        HTTPException: 当记录代码已存在时抛出
    """
    try:
        electronic_record = await ElectronicRecordService.create_electronic_record(
            tenant_id=tenant_id,
            data=data
        )
        return ElectronicRecordResponse.model_validate(electronic_record)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[ElectronicRecordResponse])
async def list_electronic_records(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="记录类型（可选）"),
    status: Optional[str] = Query(None, description="记录状态（可选）"),
    lifecycle_stage: Optional[str] = Query(None, description="生命周期阶段（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取电子记录列表
    
    获取当前组织的电子记录列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 记录类型（可选）
        status: 记录状态（可选）
        lifecycle_stage: 生命周期阶段（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[ElectronicRecordResponse]: 电子记录列表
    """
    electronic_records = await ElectronicRecordService.list_electronic_records(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        status=status,
        lifecycle_stage=lifecycle_stage
    )
    return [ElectronicRecordResponse.model_validate(er) for er in electronic_records]


@router.get("/{uuid}", response_model=ElectronicRecordResponse)
async def get_electronic_record(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取电子记录详情
    
    根据UUID获取电子记录详情。
    
    Args:
        uuid: 电子记录UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ElectronicRecordResponse: 电子记录对象
        
    Raises:
        HTTPException: 当电子记录不存在时抛出
    """
    try:
        electronic_record = await ElectronicRecordService.get_electronic_record_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return ElectronicRecordResponse.model_validate(electronic_record)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=ElectronicRecordResponse)
async def update_electronic_record(
    uuid: str,
    data: ElectronicRecordUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新电子记录
    
    更新电子记录信息。
    
    Args:
        uuid: 电子记录UUID
        data: 电子记录更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ElectronicRecordResponse: 更新后的电子记录对象
        
    Raises:
        HTTPException: 当电子记录不存在时抛出
    """
    try:
        electronic_record = await ElectronicRecordService.update_electronic_record(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ElectronicRecordResponse.model_validate(electronic_record)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_electronic_record(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除电子记录
    
    软删除电子记录。
    
    Args:
        uuid: 电子记录UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当电子记录不存在时抛出
    """
    try:
        await ElectronicRecordService.delete_electronic_record(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/sign", response_model=ElectronicRecordResponse)
async def sign_electronic_record(
    uuid: str,
    data: ElectronicRecordSignRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    签名电子记录
    
    触发电子记录签名工作流。
    
    Args:
        uuid: 电子记录UUID
        data: 签名请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ElectronicRecordResponse: 更新后的电子记录对象
        
    Raises:
        HTTPException: 当电子记录不存在或状态不允许签名时抛出
    """
    try:
        electronic_record = await ElectronicRecordService.sign_electronic_record(
            tenant_id=tenant_id,
            uuid=uuid,
            user_id=current_user.id,
            data=data
        )
        return ElectronicRecordResponse.model_validate(electronic_record)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.post("/{uuid}/archive", response_model=ElectronicRecordResponse)
async def archive_electronic_record(
    uuid: str,
    data: ElectronicRecordArchiveRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    归档电子记录
    
    触发电子记录归档工作流。
    
    Args:
        uuid: 电子记录UUID
        data: 归档请求数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        ElectronicRecordResponse: 更新后的电子记录对象
        
    Raises:
        HTTPException: 当电子记录不存在或状态不允许归档时抛出
    """
    try:
        electronic_record = await ElectronicRecordService.archive_electronic_record(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return ElectronicRecordResponse.model_validate(electronic_record)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

