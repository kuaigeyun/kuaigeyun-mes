"""
工装状态解析服务：根据在途业务单据计算工装应处状态。

Author: RiverEdge
Date: 2026-06-29
"""

from __future__ import annotations

from apps.kuaizhizao.constants.tool_status import (
    MANUAL_LOCK_STATUSES,
    OPEN_CALIBRATION_STATUSES,
    OPEN_MAINTENANCE_STATUSES,
    OPEN_REPAIR_STATUSES,
    OUTSTANDING_BORROW_STATUS,
    TOOL_STATUS_CALIBRATION,
    TOOL_STATUS_IDLE,
    TOOL_STATUS_IN_USE,
    TOOL_STATUS_MAINTENANCE,
    TOOL_STATUS_PENDING_ACTIVATION,
    TOOL_STATUS_REPAIR,
)
from apps.kuaizhizao.models.tool import Tool
from apps.kuaizhizao.models.tool_ops import (
    ToolBorrow,
    ToolMaintenance,
    ToolOpsCalibration,
    ToolRepair,
)
from infra.exceptions.exceptions import NotFoundError


class ToolStatusService:
    """根据业务单据优先级解析并回写工装状态。"""

    @staticmethod
    async def resolve(tenant_id: int, tool_id: int, *, persist: bool = True) -> str:
        tool = await Tool.filter(
            tenant_id=tenant_id,
            id=tool_id,
            deleted_at__isnull=True,
        ).first()
        if not tool:
            raise NotFoundError(f"工装不存在: {tool_id}")

        if tool.status in MANUAL_LOCK_STATUSES:
            return tool.status

        if tool.status == TOOL_STATUS_PENDING_ACTIVATION:
            return tool.status

        resolved = TOOL_STATUS_IDLE

        open_maintenance = await ToolMaintenance.filter(
            tenant_id=tenant_id,
            tool_id=tool_id,
            status__in=list(OPEN_MAINTENANCE_STATUSES),
            deleted_at__isnull=True,
        ).exists()
        if open_maintenance:
            resolved = TOOL_STATUS_MAINTENANCE
        else:
            open_repair = await ToolRepair.filter(
                tenant_id=tenant_id,
                tool_id=tool_id,
                status__in=list(OPEN_REPAIR_STATUSES),
                deleted_at__isnull=True,
            ).exists()
            if open_repair:
                resolved = TOOL_STATUS_REPAIR
            else:
                open_calibration = await ToolOpsCalibration.filter(
                    tenant_id=tenant_id,
                    tool_id=tool_id,
                    status__in=list(OPEN_CALIBRATION_STATUSES),
                    deleted_at__isnull=True,
                ).exists()
                if open_calibration:
                    resolved = TOOL_STATUS_CALIBRATION
                else:
                    outstanding_borrow = await ToolBorrow.filter(
                        tenant_id=tenant_id,
                        tool_id=tool_id,
                        status=OUTSTANDING_BORROW_STATUS,
                        deleted_at__isnull=True,
                    ).exists()
                    if outstanding_borrow:
                        resolved = TOOL_STATUS_IN_USE

        if persist and tool.status != resolved:
            tool.status = resolved
            await tool.save(update_fields=["status", "updated_at"])

        return resolved
