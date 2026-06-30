"""
模具状态解析服务：根据在途业务单据计算模具应处状态。

Author: RiverEdge
Date: 2026-06-29
"""

from __future__ import annotations

from apps.kuaizhizao.constants.mold_status import (
    MANUAL_LOCK_STATUSES,
    MOLD_STATUS_IDLE,
    MOLD_STATUS_IN_USE,
    MOLD_STATUS_MAINTENANCE,
    MOLD_STATUS_PENDING_ACTIVATION,
    MOLD_STATUS_REPAIR,
    MOLD_STATUS_TRIAL,
    OPEN_MAINTENANCE_STATUSES,
    OPEN_REPAIR_STATUSES,
    OPEN_TRIAL_STATUSES,
    OUTSTANDING_BORROW_STATUS,
)
from apps.kuaizhizao.models.mold import Mold
from apps.kuaizhizao.models.mold_ops import (
    MoldBorrow,
    MoldMaintenance,
    MoldRepair,
    MoldTrial,
)
from infra.exceptions.exceptions import NotFoundError


class MoldStatusService:
    """根据业务单据优先级解析并回写模具状态。"""

    @staticmethod
    async def resolve(tenant_id: int, mold_id: int, *, persist: bool = True) -> str:
        mold = await Mold.filter(
            tenant_id=tenant_id,
            id=mold_id,
            deleted_at__isnull=True,
        ).first()
        if not mold:
            raise NotFoundError(f"模具不存在: {mold_id}")

        if mold.status in MANUAL_LOCK_STATUSES:
            return mold.status

        if mold.status == MOLD_STATUS_PENDING_ACTIVATION:
            return mold.status

        resolved = MOLD_STATUS_IDLE

        open_maintenance = await MoldMaintenance.filter(
            tenant_id=tenant_id,
            mold_id=mold_id,
            status__in=list(OPEN_MAINTENANCE_STATUSES),
            deleted_at__isnull=True,
        ).exists()
        if open_maintenance:
            resolved = MOLD_STATUS_MAINTENANCE
        else:
            open_repair = await MoldRepair.filter(
                tenant_id=tenant_id,
                mold_id=mold_id,
                status__in=list(OPEN_REPAIR_STATUSES),
                deleted_at__isnull=True,
            ).exists()
            if open_repair:
                resolved = MOLD_STATUS_REPAIR
            else:
                open_trial = await MoldTrial.filter(
                    tenant_id=tenant_id,
                    mold_id=mold_id,
                    status__in=list(OPEN_TRIAL_STATUSES),
                    deleted_at__isnull=True,
                ).exists()
                if open_trial:
                    resolved = MOLD_STATUS_TRIAL
                else:
                    outstanding_borrow = await MoldBorrow.filter(
                        tenant_id=tenant_id,
                        mold_id=mold_id,
                        status=OUTSTANDING_BORROW_STATUS,
                        deleted_at__isnull=True,
                    ).exists()
                    if outstanding_borrow:
                        resolved = MOLD_STATUS_IN_USE

        if persist and mold.status != resolved:
            mold.status = resolved
            await mold.save(update_fields=["status", "updated_at"])

        return resolved
