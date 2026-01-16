"""
设备维护提醒 API 路由

提供设备维护提醒相关的API接口。

Author: Luigi Lu
Date: 2026-01-16
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from apps.kuaizhizao.schemas.maintenance_reminder import (
    MaintenanceReminderResponse,
    MaintenanceReminderListResponse,
    MaintenanceReminderMarkReadRequest,
    MaintenanceReminderMarkHandledRequest,
)
from apps.kuaizhizao.services.maintenance_reminder_service import MaintenanceReminderService
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user as soil_get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/maintenance-reminders", tags=["Kuaige Zhizao Maintenance Reminders"])


@router.get("", response_model=MaintenanceReminderListResponse)
async def list_maintenance_reminders(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    reminder_type: Optional[str] = Query(None, description="提醒类型（可选）"),
    is_read: Optional[bool] = Query(None, description="是否已读（可选）"),
    is_handled: Optional[bool] = Query(None, description="是否已处理（可选）"),
    equipment_uuid: Optional[str] = Query(None, description="设备UUID（可选）"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取维护提醒列表
    
    获取设备维护提醒列表，支持筛选和搜索。
    """
    try:
        reminder_service = MaintenanceReminderService()
        reminders, total = await reminder_service.list_reminders(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            reminder_type=reminder_type,
            is_read=is_read,
            is_handled=is_handled,
            equipment_uuid=equipment_uuid,
        )
        
        # 获取未读数量
        unread_count = await reminder_service.get_unread_count(tenant_id)
        
        items = [MaintenanceReminderResponse.model_validate(r) for r in reminders]
        
        return MaintenanceReminderListResponse(
            items=items,
            total=total,
            skip=skip,
            limit=limit,
            unread_count=unread_count
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取提醒列表失败: {str(e)}")


@router.get("/unread-count", response_model=dict)
async def get_unread_count(
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取未读提醒数量
    
    获取当前用户的未读维护提醒数量。
    """
    try:
        reminder_service = MaintenanceReminderService()
        count = await reminder_service.get_unread_count(tenant_id)
        
        return {
            "unread_count": count
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"获取未读数量失败: {str(e)}")


@router.post("/mark-read", response_model=dict)
async def mark_reminders_as_read(
    data: MaintenanceReminderMarkReadRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    标记提醒为已读
    
    将指定的维护提醒标记为已读。
    """
    try:
        reminder_service = MaintenanceReminderService()
        count = await reminder_service.mark_as_read(
            tenant_id=tenant_id,
            reminder_uuids=data.reminder_uuids,
            read_by=current_user.id
        )
        
        return {
            "success": True,
            "marked_count": count
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"标记已读失败: {str(e)}")


@router.post("/mark-handled", response_model=MaintenanceReminderResponse)
async def mark_reminder_as_handled(
    data: MaintenanceReminderMarkHandledRequest,
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    标记提醒为已处理
    
    将指定的维护提醒标记为已处理。
    """
    try:
        reminder_service = MaintenanceReminderService()
        reminder = await reminder_service.mark_as_handled(
            tenant_id=tenant_id,
            reminder_uuid=data.reminder_uuid,
            handled_by=current_user.id,
            remark=data.remark
        )
        
        return MaintenanceReminderResponse.model_validate(reminder)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"标记已处理失败: {str(e)}")


@router.post("/check", response_model=dict)
async def check_maintenance_plans(
    advance_days: int = Query(7, ge=1, le=30, description="提前提醒天数"),
    current_user: User = Depends(soil_get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    手动检查维护计划（创建提醒）
    
    手动触发维护计划检查，创建到期提醒。
    通常由Inngest定时任务自动调用，也可手动调用。
    """
    try:
        reminder_service = MaintenanceReminderService()
        result = await reminder_service.check_maintenance_plans(
            tenant_id=tenant_id,
            advance_days=advance_days,
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"检查维护计划失败: {str(e)}")
