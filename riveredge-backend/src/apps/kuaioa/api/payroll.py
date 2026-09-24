"""薪酬 API：生活费预支、奖励、工资结算。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from apps.kuaioa.schemas.payroll import (
    LivingAdvanceCreate,
    LivingAdvanceUpdate,
    PayrollSettlementCreate,
    PayrollSettlementLineUpdate,
    PayrollSettlementUpdate,
    RewardRecordCreate,
    RewardRecordUpdate,
)
from apps.kuaioa.schemas.payroll_import import PayrollLineImportRequest
from apps.kuaioa.services.payroll_service import (
    LivingAdvanceService,
    PayrollSettlementService,
    RewardRecordService,
)
from apps.kuaioa.services.welfare_service import AnnualPayrollStatsService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/payroll", tags=["App - Kuaioa - Payroll"])
living_svc = LivingAdvanceService()
reward_svc = RewardRecordService()
payroll_svc = PayrollSettlementService()
annual_svc = AnnualPayrollStatsService()


def _http(exc: Exception):
    if isinstance(exc, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(exc)})
    if isinstance(exc, BusinessLogicError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(exc)})
    raise exc


# ----- living advances -----


@router.get("/living-advances")
async def list_living_advances(
    keyword: Optional[str] = Query(None),
    year_month: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await living_svc.list_rows(
        tenant_id, keyword=keyword, year_month=year_month, status=status_filter
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/living-advances/{row_id}")
async def get_living_advance(
    row_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await living_svc.get_row(tenant_id, row_id), "success": True}
    except Exception as e:
        _http(e)


@router.post("/living-advances", status_code=status.HTTP_201_CREATED)
async def create_living_advance(
    data: LivingAdvanceCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await living_svc.create_row(tenant_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/living-advances/{row_id}")
async def update_living_advance(
    data: LivingAdvanceUpdate,
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await living_svc.update_row(tenant_id, row_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.delete("/living-advances/{row_id}")
async def delete_living_advance(
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await living_svc.delete_row(tenant_id, row_id, current_user.id)
        return {"success": True}
    except Exception as e:
        _http(e)


# ----- rewards -----


@router.get("/rewards")
async def list_rewards(
    keyword: Optional[str] = Query(None),
    year_month: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:reward:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await reward_svc.list_rows(
        tenant_id, keyword=keyword, year_month=year_month, status=status_filter
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/rewards/{row_id}")
async def get_reward(
    row_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:reward:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await reward_svc.get_row(tenant_id, row_id), "success": True}
    except Exception as e:
        _http(e)


@router.post("/rewards", status_code=status.HTTP_201_CREATED)
async def create_reward(
    data: RewardRecordCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:reward:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await reward_svc.create_row(tenant_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/rewards/{row_id}")
async def update_reward(
    data: RewardRecordUpdate,
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:reward:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await reward_svc.update_row(tenant_id, row_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.delete("/rewards/{row_id}")
async def delete_reward(
    row_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:reward:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await reward_svc.delete_row(tenant_id, row_id, current_user.id)
        return {"success": True}
    except Exception as e:
        _http(e)


# ----- settlements -----


@router.get("/settlements")
async def list_settlements(
    keyword: Optional[str] = Query(None),
    year_month: Optional[str] = Query(None),
    workshop_name: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:payroll:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await payroll_svc.list_settlements(
        tenant_id,
        keyword=keyword,
        year_month=year_month,
        workshop_name=workshop_name,
        status=status_filter,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/settlements/{settlement_id}")
async def get_settlement(
    settlement_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:payroll:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {"data": await payroll_svc.get_settlement(tenant_id, settlement_id), "success": True}
    except Exception as e:
        _http(e)


@router.post("/settlements", status_code=status.HTTP_201_CREATED)
async def create_settlement(
    data: PayrollSettlementCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.create_settlement(tenant_id, data, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/settlements/{settlement_id}")
async def update_settlement(
    data: PayrollSettlementUpdate,
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.update_settlement(
                tenant_id, settlement_id, data, current_user.id
            ),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.delete("/settlements/{settlement_id}")
async def delete_settlement(
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await payroll_svc.delete_settlement(tenant_id, settlement_id, current_user.id)
        return {"success": True}
    except Exception as e:
        _http(e)


@router.post("/settlements/{settlement_id}/rebuild")
async def rebuild_settlement(
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.rebuild_lines(tenant_id, settlement_id, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.put("/settlements/{settlement_id}/lines/{line_id}")
async def update_settlement_line(
    data: PayrollSettlementLineUpdate,
    settlement_id: int = Path(..., ge=1),
    line_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.update_line(
                tenant_id, settlement_id, line_id, data, current_user.id
            ),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.post("/settlements/{settlement_id}/confirm")
async def confirm_settlement(
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.confirm(tenant_id, settlement_id, current_user),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.post("/settlements/{settlement_id}/reopen")
async def reopen_settlement(
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.reopen(tenant_id, settlement_id, current_user.id),
            "success": True,
        }
    except Exception as e:
        _http(e)


@router.get("/living-payout")
async def living_payout_report(
    year_month: str = Query(..., min_length=7, max_length=7),
    workshop_name: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:living-advance:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await payroll_svc.list_living_payout(
            tenant_id, year_month, workshop_name=workshop_name
        )
        return {"data": rows, "total": len(rows), "success": True}
    except Exception as e:
        _http(e)


@router.get("/annual-stats")
async def annual_payroll_stats(
    year: int = Query(..., ge=2000, le=2100),
    workshop_name: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    _auth=Depends(require_permission_codes("kuaioa:payroll:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        rows = await annual_svc.list_annual_stats(
            tenant_id, year, workshop_name=workshop_name, keyword=keyword
        )
        return {"data": rows, "total": len(rows), "success": True}
    except Exception as e:
        _http(e)


@router.get("/personal-stats")
async def personal_payroll_stats(
    employee_id: int = Query(..., ge=1),
    year: int = Query(..., ge=2000, le=2100),
    _auth=Depends(require_permission_codes("kuaioa:payroll:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await payroll_svc.list_personal_stats(tenant_id, employee_id, year)
        return {"data": row, "success": True}
    except Exception as e:
        _http(e)


@router.post("/settlements/{settlement_id}/import-lines")
async def import_settlement_lines(
    data: PayrollLineImportRequest,
    settlement_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:payroll:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return {
            "data": await payroll_svc.import_lines(
                tenant_id, settlement_id, data, current_user.id
            ),
            "success": True,
        }
    except Exception as e:
        _http(e)
