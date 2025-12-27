"""
人机料法资源分配 API 模块

提供人机料法资源分配的 RESTful API 接口。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaimes.services.resource_allocation_service import ResourceAllocationService
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/resource-allocation", tags=["Resource Allocation"])


@router.post("/allocate-equipment/{work_order_uuid}", summary="为工单分配设备")
async def allocate_equipment_to_work_order(
    work_order_uuid: str,
    equipment_id: int,
    equipment_name: str,
    equipment_code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    为工单分配设备（机）

    - **work_order_uuid**: 工单UUID
    - **equipment_id**: 设备ID
    - **equipment_name**: 设备名称
    - **equipment_code**: 设备编码
    """
    try:
        result = await ResourceAllocationService.allocate_equipment_to_work_order(
            tenant_id=tenant_id,
            work_order_uuid=work_order_uuid,
            equipment_id=equipment_id,
            equipment_name=equipment_name,
            equipment_code=equipment_code
        )
        return result
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/allocate-operator/{work_order_uuid}", summary="为工单分配操作员")
async def allocate_operator_to_work_order(
    work_order_uuid: str,
    operator_id: int,
    operator_name: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    为工单分配操作员（人）

    - **work_order_uuid**: 工单UUID
    - **operator_id**: 操作员ID
    - **operator_name**: 操作员姓名
    """
    try:
        result = await ResourceAllocationService.allocate_operator_to_work_order(
            tenant_id=tenant_id,
            work_order_uuid=work_order_uuid,
            operator_id=operator_id,
            operator_name=operator_name
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/set-materials/{work_order_uuid}", summary="设置工单材料")
async def set_work_order_materials(
    work_order_uuid: str,
    materials: List[Dict[str, Any]],
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    material_requirements: Optional[str] = None
):
    """
    设置工单所需材料（料）

    - **work_order_uuid**: 工单UUID
    - **materials**: 材料清单
    - **material_requirements**: 材料需求说明
    """
    try:
        result = await ResourceAllocationService.set_work_order_materials(
            tenant_id=tenant_id,
            work_order_uuid=work_order_uuid,
            materials=materials,
            material_requirements=material_requirements
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/set-process-method/{work_order_uuid}", summary="设置工单工艺方法")
async def set_work_order_process_method(
    work_order_uuid: str,
    process_method: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    quality_requirements: Optional[str] = None
):
    """
    设置工单工艺方法（法）

    - **work_order_uuid**: 工单UUID
    - **process_method**: 工艺方法说明
    - **quality_requirements**: 质量要求
    """
    try:
        result = await ResourceAllocationService.set_work_order_process_method(
            tenant_id=tenant_id,
            work_order_uuid=work_order_uuid,
            process_method=process_method,
            quality_requirements=quality_requirements
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/work-order/{work_order_uuid}", summary="获取工单资源分配情况")
async def get_work_order_resource_allocation(
    work_order_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取工单的资源分配情况（人机料法）

    - **work_order_uuid**: 工单UUID
    """
    try:
        result = await ResourceAllocationService.get_work_order_resource_allocation(
            tenant_id=tenant_id,
            work_order_uuid=work_order_uuid
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/check-availability", summary="检查资源可用性")
async def check_resource_availability(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    equipment_id: Optional[int] = None,
    operator_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    检查资源可用性

    - **equipment_id**: 设备ID
    - **operator_id**: 操作员ID
    - **start_date**: 开始日期 (ISO格式)
    - **end_date**: 结束日期 (ISO格式)
    """
    from datetime import datetime

    parsed_start_date = None
    parsed_end_date = None

    if start_date:
        try:
            parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的开始日期格式")

    if end_date:
        try:
            parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的结束日期格式")

    result = await ResourceAllocationService.check_resource_availability(
        tenant_id=tenant_id,
        equipment_id=equipment_id,
        operator_id=operator_id,
        start_date=parsed_start_date,
        end_date=parsed_end_date
    )
    return result
