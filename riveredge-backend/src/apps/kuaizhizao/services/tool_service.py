"""
工装管理服务模块

提供工装及其生命周期记录的业务逻辑处理。

Author: Antigravity
Date: 2026-02-02
"""

from typing import List, Optional, Tuple
from datetime import datetime
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.kuaizhizao.models.tool import Tool, ToolUsage, ToolMaintenance, ToolCalibration
from apps.kuaizhizao.schemas.tool import (
    ToolCreate, ToolUpdate,
    ToolUsageCreate,
    ToolMaintenanceCreate,
    ToolCalibrationCreate
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ToolService:
    """
    工装基础信息服务
    """
    
    @staticmethod
    async def create_tool(tenant_id: int, data: ToolCreate) -> Tool:
        try:
            if not data.code:
                try:
                    data.code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="TOOL_CODE",
                        context=None
                    )
                except Exception:
                    data.code = f"TL{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            tool = Tool(tenant_id=tenant_id, **data.model_dump(exclude_none=True))
            await tool.save()
            return tool
        except IntegrityError:
            raise ValidationError(f"工装编码 {data.code} 已存在")

    @staticmethod
    async def get_tool_by_uuid(tenant_id: int, uuid: str) -> Tool:
        tool = await Tool.filter(tenant_id=tenant_id, uuid=uuid, deleted_at__isnull=True).first()
        if not tool:
            raise NotFoundError("工装不存在")
        return tool

    @staticmethod
    async def list_tools(
        tenant_id: int, 
        skip: int = 0, 
        limit: int = 100,
        type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Tool], int]:
        query = Tool.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if type: query = query.filter(type=type)
        if status: query = query.filter(status=status)
        if search:
            query = query.filter(Q(code__icontains=search) | Q(name__icontains=search))
        
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-created_at")
        return items, total

    @staticmethod
    async def update_tool(tenant_id: int, uuid: str, data: ToolUpdate) -> Tool:
        tool = await ToolService.get_tool_by_uuid(tenant_id, uuid)
        update_data = data.model_dump(exclude_unset=True)
        
        for key, value in update_data.items():
            setattr(tool, key, value)
        
        await tool.save()
        return tool


class ToolUsageService:
    """
    工装领用归还服务
    """

    @staticmethod
    async def list_usages(
        tenant_id: int,
        tool_uuid: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[ToolUsage], int]:
        tool = await ToolService.get_tool_by_uuid(tenant_id, tool_uuid)
        query = ToolUsage.filter(tenant_id=tenant_id, tool_id=tool.id, deleted_at__isnull=True)
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-checkout_date")
        return items, total
    
    @staticmethod
    async def checkout_tool(tenant_id: int, data: ToolUsageCreate) -> ToolUsage:
        tool = await Tool.filter(tenant_id=tenant_id, uuid=data.tool_uuid).first()
        if not tool: raise ValidationError("工装不存在")
        if tool.status == "领用中": raise ValidationError("工装已在领用中")
        
        if not data.usage_no:
            data.usage_no = f"TO{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
        usage = ToolUsage(
            tenant_id=tenant_id,
            tool_id=tool.id,
            tool_uuid=tool.uuid,
            **data.model_dump(exclude={'tool_uuid'})
        )
        await usage.save()
        
        tool.status = "领用中"
        tool.total_usage_count += 1
        await tool.save()
        return usage

    @staticmethod
    async def checkin_tool(tenant_id: int, uuid: str, remark: Optional[str] = None) -> ToolUsage:
        usage = await ToolUsage.filter(tenant_id=tenant_id, uuid=uuid).first()
        if not usage or usage.status == "已归还":
            raise ValidationError("有效的领用记录不存在或已归还")
            
        usage.checkin_date = datetime.now()
        usage.status = "已归还"
        if remark: usage.remark = remark
        await usage.save()
        
        tool = await Tool.get(id=usage.tool_id)
        tool.status = "正常"
        await tool.save()
        return usage


class ToolMaintenanceService:
    """
    工装维保及校验服务
    """

    @staticmethod
    async def list_maintenances(
        tenant_id: int,
        tool_uuid: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[ToolMaintenance], int]:
        tool = await ToolService.get_tool_by_uuid(tenant_id, tool_uuid)
        query = ToolMaintenance.filter(tenant_id=tenant_id, tool_id=tool.id, deleted_at__isnull=True)
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-maintenance_date")
        return items, total

    @staticmethod
    async def list_calibrations(
        tenant_id: int,
        tool_uuid: str,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[ToolCalibration], int]:
        tool = await ToolService.get_tool_by_uuid(tenant_id, tool_uuid)
        query = ToolCalibration.filter(tenant_id=tenant_id, tool_id=tool.id, deleted_at__isnull=True)
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-calibration_date")
        return items, total

    @staticmethod
    async def record_maintenance(tenant_id: int, data: ToolMaintenanceCreate) -> ToolMaintenance:
        tool = await Tool.filter(tenant_id=tenant_id, uuid=data.tool_uuid).first()
        if not tool: raise ValidationError("工装不存在")
        
        maint = ToolMaintenance(
            tenant_id=tenant_id,
            tool_id=tool.id,
            tool_uuid=tool.uuid,
            **data.model_dump(exclude={'tool_uuid'})
        )
        await maint.save()
        
        # 更新工装上次维保时间
        tool.last_maintenance_date = data.maintenance_date
        if tool.maintenance_period:
            from datetime import timedelta
            tool.next_maintenance_date = data.maintenance_date + timedelta(days=tool.maintenance_period)
        await tool.save()
        return maint

    @staticmethod
    async def record_calibration(tenant_id: int, data: ToolCalibrationCreate) -> ToolCalibration:
        tool = await Tool.filter(tenant_id=tenant_id, uuid=data.tool_uuid).first()
        if not tool: raise ValidationError("工装不存在")
        
        calib = ToolCalibration(
            tenant_id=tenant_id,
            tool_id=tool.id,
            tool_uuid=tool.uuid,
            **data.model_dump(exclude={'tool_uuid'})
        )
        await calib.save()
        
        # 更新工装上次校验时间
        tool.last_calibration_date = data.calibration_date
        if data.expiry_date:
            tool.next_calibration_date = data.expiry_date
        elif tool.calibration_period:
            from datetime import timedelta
            tool.next_calibration_date = data.calibration_date + timedelta(days=tool.calibration_period)
        
        if data.result == "不合格":
            tool.status = "停用"
        elif tool.status == "校验中":
            tool.status = "正常"
            
        await tool.save()
        return calib
