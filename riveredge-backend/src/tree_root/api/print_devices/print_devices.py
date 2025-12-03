"""
打印设备管理 API 路由

提供打印设备的 CRUD 操作和打印设备连接测试功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query

from tree_root.schemas.print_device import (
    PrintDeviceCreate,
    PrintDeviceUpdate,
    PrintDeviceTestRequest,
    PrintDevicePrintRequest,
    PrintDeviceResponse,
    PrintDeviceTestResponse,
    PrintDevicePrintResponse,
)
from tree_root.services.print_device_service import PrintDeviceService
from tree_root.api.deps.deps import get_current_tenant
from soil.api.deps.deps import get_current_user as soil_get_current_user
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/print-devices", tags=["PrintDevices"])


@router.post("", response_model=PrintDeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_print_device(
    data: PrintDeviceCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建打印设备
    
    创建新的打印设备。
    
    Args:
        data: 打印设备创建数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintDeviceResponse: 创建的打印设备对象
        
    Raises:
        HTTPException: 当设备代码已存在时抛出
    """
    try:
        print_device = await PrintDeviceService.create_print_device(
            tenant_id=tenant_id,
            data=data
        )
        return PrintDeviceResponse.model_validate(print_device)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=List[PrintDeviceResponse])
async def list_print_devices(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="设备类型（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取打印设备列表
    
    获取当前组织的打印设备列表，支持分页和筛选。
    
    Args:
        skip: 跳过数量（默认 0）
        limit: 限制数量（默认 100，最大 1000）
        type: 设备类型（可选）
        is_active: 是否启用（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[PrintDeviceResponse]: 打印设备列表
    """
    print_devices = await PrintDeviceService.list_print_devices(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        is_active=is_active
    )
    return [PrintDeviceResponse.model_validate(pd) for pd in print_devices]


@router.get("/{uuid}", response_model=PrintDeviceResponse)
async def get_print_device(
    uuid: str,
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取打印设备详情
    
    根据UUID获取打印设备详情。
    
    Args:
        uuid: 打印设备UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintDeviceResponse: 打印设备对象
        
    Raises:
        HTTPException: 当打印设备不存在时抛出
    """
    try:
        print_device = await PrintDeviceService.get_print_device_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return PrintDeviceResponse.model_validate(print_device)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=PrintDeviceResponse)
async def update_print_device(
    uuid: str,
    data: PrintDeviceUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新打印设备
    
    更新打印设备信息。
    
    Args:
        uuid: 打印设备UUID
        data: 打印设备更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintDeviceResponse: 更新后的打印设备对象
        
    Raises:
        HTTPException: 当打印设备不存在时抛出
    """
    try:
        print_device = await PrintDeviceService.update_print_device(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return PrintDeviceResponse.model_validate(print_device)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_print_device(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除打印设备
    
    软删除打印设备。
    
    Args:
        uuid: 打印设备UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当打印设备不存在时抛出
    """
    try:
        await PrintDeviceService.delete_print_device(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/test", response_model=PrintDeviceTestResponse)
async def test_print_device(
    uuid: str,
    data: PrintDeviceTestRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    测试打印设备连接
    
    测试打印设备连接状态。
    
    Args:
        uuid: 打印设备UUID
        data: 测试请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintDeviceTestResponse: 测试结果
        
    Raises:
        HTTPException: 当打印设备不存在或测试失败时抛出
    """
    try:
        result = await PrintDeviceService.test_print_device(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return PrintDeviceTestResponse(**result)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.post("/{uuid}/print", response_model=PrintDevicePrintResponse)
async def print_with_device(
    uuid: str,
    data: PrintDevicePrintRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    使用打印设备执行打印任务
    
    使用打印设备执行打印任务（同步或异步）。
    
    Args:
        uuid: 打印设备UUID
        data: 打印请求数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        PrintDevicePrintResponse: 打印结果
        
    Raises:
        HTTPException: 当打印设备不存在或打印失败时抛出
    """
    try:
        result = await PrintDeviceService.print_with_device(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return PrintDevicePrintResponse(**result)
    except (NotFoundError, ValidationError) as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )

