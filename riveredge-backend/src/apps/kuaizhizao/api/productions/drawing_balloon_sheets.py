"""图纸气泡标注 API"""

from typing import Optional

from fastapi import APIRouter, Body, Depends, File, Query, UploadFile
from loguru import logger

from apps.kuaizhizao.schemas.drawing_balloon_sheet import (
    DrawingBalloonConfirmLinesRequest,
    DrawingBalloonSheetCreate,
    DrawingBalloonSheetListResponse,
    DrawingBalloonSheetResponse,
    DrawingBalloonSheetUpdate,
)
from apps.kuaizhizao.schemas.fai_balloon_ocr import FaiBalloonOcrResult
from apps.kuaizhizao.services.drawing_balloon_sheet_service import (
    DrawingBalloonSheetService,
    assert_drawing_balloon_pro_access,
)
from apps.kuaizhizao.services.fai_balloon_ocr_service import FaiBalloonOcrService
from core.api.deps import get_current_tenant, get_current_user
from core.api.deps.access import require_permission_codes
from infra.exceptions.exceptions import ValidationError
from infra.models.user import User

router = APIRouter(tags=["App - Kuaige Zhizao - Drawing Balloon Sheets"])

sheet_service = DrawingBalloonSheetService()

_READ = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:read")
)
_CREATE = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:create")
)
_UPDATE = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:update")
)
_DELETE = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:delete")
)
_EXPORT = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:export")
)
_EXECUTE = Depends(
    require_permission_codes("kuaizhizao:quality-management-drawing-balloon-sheets:execute")
)


@router.post(
    "/drawing-balloon-sheets",
    response_model=DrawingBalloonSheetResponse,
    summary="Create drawing balloon sheet",
)
async def create_drawing_balloon_sheet(
    payload: DrawingBalloonSheetCreate,
    _auth=_CREATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetResponse:
    return await sheet_service.create_sheet(tenant_id=tenant_id, payload=payload, user=current_user)


@router.get(
    "/drawing-balloon-sheets",
    response_model=DrawingBalloonSheetListResponse,
    summary="List drawing balloon sheets",
)
async def list_drawing_balloon_sheets(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    confirmed_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _auth=_READ,
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetListResponse:
    return await sheet_service.list_sheets(
        tenant_id,
        keyword=keyword,
        status=status,
        confirmed_only=confirmed_only,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/drawing-balloon-sheets/by-fai-order/{fai_order_id}",
    response_model=Optional[DrawingBalloonSheetResponse],
    summary="Find sheet linked to FAI order",
)
async def get_drawing_balloon_sheet_by_fai(
    fai_order_id: int,
    _auth=_READ,
    tenant_id: int = Depends(get_current_tenant),
) -> Optional[DrawingBalloonSheetResponse]:
    return await sheet_service.get_by_linked_fai_order(tenant_id, fai_order_id)


@router.get(
    "/drawing-balloon-sheets/{sheet_id}",
    response_model=DrawingBalloonSheetResponse,
    summary="Get drawing balloon sheet",
)
async def get_drawing_balloon_sheet(
    sheet_id: int,
    _auth=_READ,
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetResponse:
    return await sheet_service.get_sheet(tenant_id, sheet_id)


@router.put(
    "/drawing-balloon-sheets/{sheet_id}",
    response_model=DrawingBalloonSheetResponse,
    summary="Update drawing balloon sheet",
)
async def update_drawing_balloon_sheet(
    sheet_id: int,
    payload: DrawingBalloonSheetUpdate,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetResponse:
    return await sheet_service.update_sheet(
        tenant_id=tenant_id, sheet_id=sheet_id, payload=payload, user=current_user
    )


@router.delete("/drawing-balloon-sheets/{sheet_id}", summary="Delete drawing balloon sheet")
async def delete_drawing_balloon_sheet(
    sheet_id: int,
    _auth=_DELETE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    await sheet_service.delete_sheet(tenant_id, sheet_id, user=current_user)
    return {"success": True}


@router.put(
    "/drawing-balloon-sheets/{sheet_id}/balloon-candidates",
    response_model=DrawingBalloonSheetResponse,
    summary="Save balloon OCR candidates",
)
async def save_drawing_balloon_candidates(
    sheet_id: int,
    candidates: list = Body(..., embed=True),
    drawing_file_url: Optional[str] = Body(None, embed=True),
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetResponse:
    return await sheet_service.save_balloon_candidates(
        tenant_id,
        sheet_id,
        candidates,
        drawing_file_url=drawing_file_url,
        user=current_user,
    )


@router.post(
    "/drawing-balloon-sheets/{sheet_id}/confirm-lines",
    response_model=DrawingBalloonSheetResponse,
    summary="Confirm balloon candidates into sheet lines",
)
async def confirm_drawing_balloon_lines(
    sheet_id: int,
    payload: DrawingBalloonConfirmLinesRequest,
    _auth=_UPDATE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DrawingBalloonSheetResponse:
    return await sheet_service.confirm_lines(
        tenant_id=tenant_id, sheet_id=sheet_id, payload=payload, user=current_user
    )


@router.post(
    "/drawing-balloon-sheets/{sheet_id}/balloon-ocr",
    response_model=FaiBalloonOcrResult,
    summary="OCR engineering drawing into balloon candidates",
)
async def ocr_drawing_balloon_sheet(
    sheet_id: int,
    file: UploadFile = File(..., description="工程图纸图片 JPG/PNG/WEBP"),
    persist: bool = Query(True, description="是否写回 balloon_candidates"),
    _auth=_EXECUTE,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> FaiBalloonOcrResult:
    await assert_drawing_balloon_pro_access(tenant_id)
    await sheet_service.get_sheet(tenant_id, sheet_id)
    try:
        image_bytes = await file.read()
        result = await FaiBalloonOcrService.extract_from_image(
            tenant_id=tenant_id,
            image_bytes=image_bytes,
            content_type=file.content_type,
        )
    except ValidationError:
        raise
    except Exception as e:
        logger.exception(
            "drawing balloon OCR failed tenant_id={} sheet_id={}", tenant_id, sheet_id
        )
        raise ValidationError(f"气泡 OCR 识别失败: {e}") from e

    if persist and result.candidates:
        await sheet_service.save_balloon_candidates(
            tenant_id,
            sheet_id,
            [c.model_dump(exclude_none=True) for c in result.candidates],
            user=current_user,
        )
    return result
