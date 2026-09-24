"""月度考勤 API。"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from fastapi.responses import StreamingResponse

from apps.kuaioa.schemas.attendance import (
    AttendanceBatchMark,
    AttendanceDayUpdate,
    AttendanceSheetCreate,
    AttendanceSheetUpdate,
)
from apps.kuaioa.services.attendance_service import AttendanceService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError
from infra.models.user import User

router = APIRouter(prefix="/attendance", tags=["App - Kuaioa - Attendance"])
service = AttendanceService()


@router.get("/sheets", summary="List attendance sheets")
async def list_sheets(
    keyword: Optional[str] = Query(None),
    year_month: Optional[str] = Query(None),
    workshop_name: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth=Depends(require_permission_codes("kuaioa:attendance:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    rows = await service.list_sheets(
        tenant_id,
        keyword=keyword,
        year_month=year_month,
        workshop_name=workshop_name,
        status=status_filter,
    )
    return {"data": rows, "total": len(rows), "success": True}


@router.get("/sheets/{sheet_id}", summary="Get attendance sheet")
async def get_sheet(
    sheet_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:attendance:read")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.get_sheet(tenant_id, sheet_id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})


@router.post("/sheets", status_code=status.HTTP_201_CREATED, summary="Create attendance sheet")
async def create_sheet(
    data: AttendanceSheetCreate,
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:create")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.create_sheet(tenant_id, data, current_user.id)
        return {"data": row, "success": True}
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.put("/sheets/{sheet_id}", summary="Update attendance sheet header")
async def update_sheet(
    data: AttendanceSheetUpdate,
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_sheet(tenant_id, sheet_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.delete("/sheets/{sheet_id}", summary="Delete attendance sheet")
async def delete_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:delete")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        await service.delete_sheet(tenant_id, sheet_id, current_user.id)
        return {"success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.post("/sheets/{sheet_id}/refresh-roster", summary="Refresh employee roster cells")
async def refresh_roster(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.refresh_roster(tenant_id, sheet_id, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.put("/sheets/{sheet_id}/days/{day_id}", summary="Update attendance day cell")
async def update_day(
    data: AttendanceDayUpdate,
    sheet_id: int = Path(..., ge=1),
    day_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.update_day(tenant_id, sheet_id, day_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.post("/sheets/{sheet_id}/batch-mark", summary="Batch mark rest or night")
async def batch_mark(
    data: AttendanceBatchMark,
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.batch_mark(tenant_id, sheet_id, data, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.post("/sheets/{sheet_id}/submit", summary="Submit attendance sheet")
async def submit_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:submit")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.submit_sheet(tenant_id, sheet_id, current_user)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.post("/sheets/{sheet_id}/reopen", summary="Reopen submitted attendance sheet")
async def reopen_sheet(
    sheet_id: int = Path(..., ge=1),
    current_user: User = Depends(get_current_user),
    _auth=Depends(require_permission_codes("kuaioa:attendance:update")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        row = await service.reopen_sheet(tenant_id, sheet_id, current_user.id)
        return {"data": row, "success": True}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"message": str(e)})


@router.get("/sheets/{sheet_id}/export", summary="Export attendance sheet as Excel")
async def export_sheet(
    sheet_id: int = Path(..., ge=1),
    _auth=Depends(require_permission_codes("kuaioa:attendance:export")),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        sheet = await service._get_sheet_row(tenant_id, sheet_id)
        stream = await service.export_sheet_excel(tenant_id, sheet_id)
        filename = f"attendance_{sheet.year_month}_{sheet.workshop_name}.xlsx"
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"message": str(e)})
