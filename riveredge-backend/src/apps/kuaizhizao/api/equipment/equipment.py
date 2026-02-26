"""
设备管理 API 路由

提供设备的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.models.equipment import Equipment, EquipmentCalibration
from apps.kuaizhizao.models.maintenance_plan import MaintenancePlan, MaintenanceExecution
from apps.kuaizhizao.models.equipment_fault import EquipmentFault, EquipmentRepair
from apps.kuaizhizao.schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentResponse,
    EquipmentListResponse,
    EquipmentCalibrationCreate,
    EquipmentCalibrationResponse,
)
from apps.kuaizhizao.schemas.equipment_oee import (
    EquipmentOEResponse,
    EquipmentOEEListResponse,
    EquipmentOEETrendResponse,
)
from apps.kuaizhizao.services.equipment_service import EquipmentService
from apps.kuaizhizao.services.equipment_oee_service import EquipmentOEEService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/equipment", tags=["Kuaige Zhizao Equipment"])


@router.post("", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    data: EquipmentCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备
    
    创建新设备并保存到数据库。
    
    Args:
        data: 设备创建数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 创建的设备对象
        
    Raises:
        HTTPException: 当设备编码已存在或数据验证失败时抛出
    """
    try:
        equipment = await EquipmentService.create_equipment(
            tenant_id=tenant_id,
            data=data,
            created_by=current_user.id
        )
        return EquipmentResponse.model_validate(equipment)
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )


@router.get("", response_model=EquipmentListResponse)
async def list_equipment(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    type: Optional[str] = Query(None, description="设备类型（可选）"),
    category: Optional[str] = Query(None, description="设备分类（可选）"),
    status: Optional[str] = Query(None, description="设备状态（可选）"),
    is_active: Optional[bool] = Query(None, description="是否启用（可选）"),
    workstation_id: Optional[int] = Query(None, description="工位ID（可选）"),
    search: Optional[str] = Query(None, description="搜索关键词（可选，搜索编码、名称）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备列表
    
    获取当前组织的设备列表，支持筛选和搜索。
    
    Args:
        skip: 跳过数量
        limit: 限制数量
        type: 设备类型（可选）
        category: 设备分类（可选）
        status: 设备状态（可选）
        is_active: 是否启用（可选）
        workstation_id: 工位ID（可选）
        search: 搜索关键词（可选，搜索编码、名称）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentListResponse: 设备列表响应
    """
    equipment_list, total = await EquipmentService.list_equipment(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        type=type,
        category=category,
        status=status,
        is_active=is_active,
        workstation_id=workstation_id,
        search=search
    )
    
    items = [EquipmentResponse.model_validate(eq) for eq in equipment_list]
    
    return EquipmentListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit
    )


@router.get("/{uuid}", response_model=EquipmentResponse)
async def get_equipment(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备详情
    
    根据UUID获取设备详情。
    
    Args:
        uuid: 设备UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 设备详情
        
    Raises:
        HTTPException: 当设备不存在时抛出
    """
    try:
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        return EquipmentResponse.model_validate(equipment)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.put("/{uuid}", response_model=EquipmentResponse)
async def update_equipment(
    uuid: str,
    data: EquipmentUpdate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新设备
    
    更新设备信息。
    
    Args:
        uuid: 设备UUID
        data: 设备更新数据
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        EquipmentResponse: 更新后的设备对象
        
    Raises:
        HTTPException: 当设备不存在或数据验证失败时抛出
    """
    try:
        equipment = await EquipmentService.update_equipment(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return EquipmentResponse.model_validate(equipment)
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
async def delete_equipment(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除设备
    
    软删除设备（标记为已删除，不实际删除数据）。
    
    Args:
        uuid: 设备UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当设备不存在时抛出
    """
    try:
        await EquipmentService.delete_equipment(tenant_id, uuid)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{uuid}/trace")
async def get_equipment_trace(
    uuid: str,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备使用记录追溯
    
    获取设备的使用历史、维护历史、故障历史。
    
    Args:
        uuid: 设备UUID
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 设备追溯信息，包含使用历史、维护历史、故障历史
        
    Raises:
        HTTPException: 当设备不存在时抛出
    """
    try:
        # 验证设备是否存在
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        
        # 获取维护计划历史
        maintenance_plans = await MaintenancePlan.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment.uuid,
            deleted_at__isnull=True
        ).order_by("-created_at").limit(50)
        
        # 获取维护执行记录历史
        maintenance_executions = await MaintenanceExecution.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment.uuid,
            deleted_at__isnull=True
        ).order_by("-execution_date").limit(50)
        
        # 获取故障记录历史
        equipment_faults = await EquipmentFault.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment.uuid,
            deleted_at__isnull=True
        ).order_by("-fault_date").limit(50)
        
        # 获取维修记录历史
        equipment_repairs = await EquipmentRepair.filter(
            tenant_id=tenant_id,
            equipment_uuid=equipment.uuid,
            deleted_at__isnull=True
        ).order_by("-repair_date").limit(50)
        
        # 获取校验记录历史
        equipment_calibrations = await EquipmentCalibration.filter(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            deleted_at__isnull=True
        ).order_by("-calibration_date").limit(50)
        
        return {
            "equipment": {
                "uuid": equipment.uuid,
                "code": equipment.code,
                "name": equipment.name,
                "status": equipment.status,
            },
            "maintenance_plans": [
                {
                    "uuid": plan.uuid,
                    "plan_no": plan.plan_no,
                    "plan_name": plan.plan_name,
                    "plan_type": plan.plan_type,
                    "maintenance_type": plan.maintenance_type,
                    "status": plan.status,
                    "planned_start_date": plan.planned_start_date.isoformat() if plan.planned_start_date else None,
                    "planned_end_date": plan.planned_end_date.isoformat() if plan.planned_end_date else None,
                    "created_at": plan.created_at.isoformat(),
                }
                for plan in maintenance_plans
            ],
            "maintenance_executions": [
                {
                    "uuid": exec.uuid,
                    "execution_no": exec.execution_no,
                    "execution_date": exec.execution_date.isoformat(),
                    "executor_name": exec.executor_name,
                    "execution_result": exec.execution_result,
                    "status": exec.status,
                    "maintenance_cost": float(exec.maintenance_cost) if exec.maintenance_cost else None,
                    "created_at": exec.created_at.isoformat(),
                }
                for exec in maintenance_executions
            ],
            "equipment_faults": [
                {
                    "uuid": fault.uuid,
                    "fault_no": fault.fault_no,
                    "fault_date": fault.fault_date.isoformat(),
                    "fault_type": fault.fault_type,
                    "fault_level": fault.fault_level,
                    "status": fault.status,
                    "repair_required": fault.repair_required,
                    "created_at": fault.created_at.isoformat(),
                }
                for fault in equipment_faults
            ],
            "equipment_repairs": [
                {
                    "uuid": repair.uuid,
                    "repair_no": repair.repair_no,
                    "repair_date": repair.repair_date.isoformat(),
                    "repair_type": repair.repair_type,
                    "repairer_name": repair.repairer_name,
                    "repair_duration": float(repair.repair_duration) if repair.repair_duration else None,
                    "repair_cost": float(repair.repair_cost) if repair.repair_cost else None,
                    "status": repair.status,
                    "repair_result": repair.repair_result,
                    "created_at": repair.created_at.isoformat(),
                }
                for repair in equipment_repairs
            ],
            "equipment_calibrations": [
                {
                    "uuid": calib.uuid,
                    "calibration_date": calib.calibration_date.isoformat(),
                    "result": calib.result,
                    "certificate_no": calib.certificate_no,
                    "expiry_date": calib.expiry_date.isoformat() if calib.expiry_date else None,
                    "remark": calib.remark,
                    "created_at": calib.created_at.isoformat(),
                }
                for calib in equipment_calibrations
            ],
        }
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/{uuid}/calibrations", response_model=EquipmentCalibrationResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment_calibration(
    uuid: str,
    data: EquipmentCalibrationCreate,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建设备校验记录
    """
    try:
        calib = await EquipmentService.create_equipment_calibration(
            tenant_id=tenant_id,
            equipment_uuid=uuid,
            data=data
        )
        return EquipmentCalibrationResponse.model_validate(calib)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ========== 设备OEE统计相关端点 ==========

@router.get("/{uuid}/oee", response_model=EquipmentOEResponse)
async def get_equipment_oee(
    uuid: str,
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备OEE统计
    
    根据设备UUID获取设备OEE统计数据。
    """
    try:
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        
        date_start_dt = None
        date_end_dt = None
        if date_start:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        if date_end:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        
        oee_service = EquipmentOEEService()
        oee_data = await oee_service.calculate_equipment_oee(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            date_start=date_start_dt,
            date_end=date_end_dt,
        )
        
        return EquipmentOEResponse(**oee_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"计算OEE失败: {str(e)}")


@router.get("/oee/list", response_model=EquipmentOEEListResponse)
async def list_equipment_oee(
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    equipment_ids: Optional[str] = Query(None, description="设备ID列表（逗号分隔）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备OEE统计列表
    
    获取当前组织的设备OEE统计列表。
    """
    try:
        date_start_dt = None
        date_end_dt = None
        if date_start:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        if date_end:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        
        equipment_id_list = None
        if equipment_ids:
            equipment_id_list = [int(id.strip()) for id in equipment_ids.split(',') if id.strip()]
        
        oee_service = EquipmentOEEService()
        oee_list = await oee_service.list_equipment_oee(
            tenant_id=tenant_id,
            date_start=date_start_dt,
            date_end=date_end_dt,
            equipment_ids=equipment_id_list,
            skip=skip,
            limit=limit,
        )
        
        items = [EquipmentOEResponse(**data) for data in oee_list]
        
        return EquipmentOEEListResponse(items=items, total=len(items))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取OEE统计列表失败: {str(e)}")


@router.get("/{uuid}/oee/trend", response_model=EquipmentOEETrendResponse)
async def get_equipment_oee_trend(
    uuid: str,
    date_start: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    date_end: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    period: str = Query("day", description="统计周期（day/week/month）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取设备OEE趋势数据
    
    根据设备UUID获取设备OEE趋势数据。
    """
    try:
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        
        date_start_dt = None
        date_end_dt = None
        if date_start:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        if date_end:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        
        if period not in ["day", "week", "month"]:
            raise ValidationError("统计周期必须是 day、week 或 month 之一")
        
        oee_service = EquipmentOEEService()
        trend_data = await oee_service.get_equipment_oee_trend(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            date_start=date_start_dt,
            date_end=date_end_dt,
            period=period,
        )
        
        return EquipmentOEETrendResponse(**trend_data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取OEE趋势数据失败: {str(e)}")

