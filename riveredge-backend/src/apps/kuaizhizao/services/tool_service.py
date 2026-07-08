"""
工装管理服务模块

提供工装台账 CRUD 及保养/校准提醒业务逻辑。

Author: Antigravity
Date: 2026-02-02
"""

from __future__ import annotations

import math
from typing import List, Optional, Tuple
from datetime import datetime, date
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.kuaizhizao.models.tool import Tool
from apps.kuaizhizao.models.tool_ops import ToolMaintenanceScheme, ToolSchemeBinding
from apps.kuaizhizao.schemas.tool import ToolCreate, ToolUpdate
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ToolService:
    """工装基础信息服务"""

    @staticmethod
    async def create_tool(tenant_id: int, data: ToolCreate) -> Tool:
        try:
            if not data.code:
                try:
                    data.code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="TOOL_CODE",
                        context=None,
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
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> Tuple[List[Tool], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            TOOL_LEDGER_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = Tool.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if type:
            query = query.filter(type=type)
        if status:
            query = query.filter(status=status)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["code", "name"],
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_equipment_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )
        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            TOOL_LEDGER_SORTABLE_FIELDS,
            "-updated_at",
        )
        items = await query.offset(skip).limit(limit).order_by(order_clause)
        return items, total

    @staticmethod
    async def update_tool(tenant_id: int, uuid: str, data: ToolUpdate) -> Tool:
        tool = await ToolService.get_tool_by_uuid(tenant_id, uuid)
        update_data = data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(tool, key, value)

        await tool.save()
        return tool

    @staticmethod
    async def delete_tool(tenant_id: int, uuid: str) -> None:
        from tortoise import timezone as tz

        tool = await ToolService.get_tool_by_uuid(tenant_id, uuid)
        tool.deleted_at = tz.now()
        await tool.save()


class ToolMaintenanceReminderService:
    """工装保养/校准提醒服务（方案触发 + 台账上次日期）"""

    @staticmethod
    async def _get_scheme_for_tool(tenant_id: int, tool: Tool) -> Optional[ToolMaintenanceScheme]:
        scheme_id = tool.maintenance_scheme_id
        if not scheme_id:
            binding = await ToolSchemeBinding.filter(
                tenant_id=tenant_id,
                tool_id=tool.id,
                scheme_type="maintenance",
                deleted_at__isnull=True,
            ).order_by("id").first()
            if binding:
                scheme_id = binding.scheme_id
        if not scheme_id:
            return None
        return await ToolMaintenanceScheme.filter(
            tenant_id=tenant_id,
            id=scheme_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def list_reminders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        reminder_type: Optional[str] = None,
    ) -> Tuple[List[dict], int]:
        tools = await Tool.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        results: List[dict] = []
        today = date.today()

        for tool in tools:
            scheme = await ToolMaintenanceReminderService._get_scheme_for_tool(tenant_id, tool)
            trigger_type = scheme.trigger_type if scheme else "days"
            interval = tool.maintenance_period
            if scheme and scheme.trigger_interval_usage:
                interval = scheme.trigger_interval_usage

            if trigger_type == "days":
                interval_days = scheme.trigger_interval_days if scheme else tool.maintenance_period
                if not interval_days or interval_days <= 0:
                    continue
                last_date = tool.last_maintenance_date
                if not last_date:
                    days_since = interval_days
                    rtype = "overdue"
                else:
                    days_since = (today - last_date).days
                    if days_since >= interval_days:
                        rtype = "overdue"
                    elif days_since >= max(1, int(interval_days * 0.9)):
                        rtype = "due_soon"
                    else:
                        continue
                if reminder_type and rtype != reminder_type:
                    continue
                results.append({
                    "tool_uuid": tool.uuid,
                    "tool_code": tool.code,
                    "tool_name": tool.name,
                    "trigger_type": "days",
                    "total_usage_count": tool.total_usage_count or 0,
                    "maintenance_interval": interval,
                    "next_maintenance_at_count": None,
                    "usages_until_due": None,
                    "last_maintenance_date": last_date,
                    "days_since_maintenance": days_since,
                    "trigger_interval_days": interval_days,
                    "reminder_type": rtype,
                })
            else:
                if not interval or interval <= 0:
                    continue
                total = tool.total_usage_count or 0
                next_at = math.ceil(total / interval) * interval if total > 0 else interval
                usages_until = next_at - total
                if usages_until <= 0:
                    rtype = "overdue"
                elif usages_until <= max(5, int(interval * 0.1)):
                    rtype = "due_soon"
                else:
                    continue
                if reminder_type and rtype != reminder_type:
                    continue
                results.append({
                    "tool_uuid": tool.uuid,
                    "tool_code": tool.code,
                    "tool_name": tool.name,
                    "trigger_type": "usage_count",
                    "total_usage_count": total,
                    "maintenance_interval": interval,
                    "next_maintenance_at_count": next_at,
                    "usages_until_due": usages_until,
                    "last_maintenance_date": tool.last_maintenance_date,
                    "days_since_maintenance": (
                        (today - tool.last_maintenance_date).days
                        if tool.last_maintenance_date else None
                    ),
                    "trigger_interval_days": scheme.trigger_interval_days if scheme else None,
                    "reminder_type": rtype,
                })

        results.sort(key=lambda x: (0 if x["reminder_type"] == "overdue" else 1, x.get("usages_until_due") or 0))
        total_count = len(results)
        return results[skip : skip + limit], total_count

    @staticmethod
    async def list_calibration_alerts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        due_type: Optional[str] = None,
    ) -> Tuple[List[dict], int]:
        today = date.today()
        tools = await Tool.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            needs_calibration=True,
        )
        results: List[dict] = []
        for tool in tools:
            if not tool.next_calibration_date:
                continue
            delta = (tool.next_calibration_date - today).days
            if delta > 7:
                continue
            rtype = "overdue" if delta < 0 else "due_soon"
            if due_type and rtype != due_type:
                continue
            results.append({
                "tool_uuid": tool.uuid,
                "tool_code": tool.code,
                "tool_name": tool.name,
                "reminder_type": "calibration",
                "due_type": rtype,
                "due_date": tool.next_calibration_date,
                "days_until_due": delta,
                "calibration_period": tool.calibration_period,
                "last_calibration_date": tool.last_calibration_date,
            })
        results.sort(key=lambda x: (0 if x["due_type"] == "overdue" else 1, x["days_until_due"]))
        total = len(results)
        return results[skip : skip + limit], total
