"""KU-AI 微调训练样本 API。"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel, Field

from apps.kuaiai.services.training_export_service import TrainingExportService
from core.api.deps.access import require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.api.deps.deps import get_current_user
from infra.models.user import User

router = APIRouter(prefix="/training", tags=["App - KU-AI - Training"])


class TrainingSampleCreate(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    source: Optional[str] = Field(default="manual", max_length=30)


@router.get(
    "/samples",
    dependencies=[Depends(require_permission_codes("kuaiai:training:read"))],
)
async def list_training_samples(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, Any]:
    return await TrainingExportService.list_samples(tenant_id=tenant_id, page=page, page_size=page_size)


@router.post(
    "/samples",
    dependencies=[Depends(require_permission_codes("kuaiai:training:create"))],
)
async def create_training_sample(
    body: TrainingSampleCreate,
    tenant_id: int = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return await TrainingExportService.create_sample(
            tenant_id=tenant_id,
            question=body.question,
            answer=body.answer,
            source=body.source or "manual",
            user_id=current_user.id,
        )
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete(
    "/samples/{sample_id}",
    dependencies=[Depends(require_permission_codes("kuaiai:training:delete"))],
)
async def delete_training_sample(
    sample_id: int,
    tenant_id: int = Depends(get_current_tenant),
) -> dict[str, bool]:
    try:
        await TrainingExportService.delete_sample(tenant_id=tenant_id, sample_id=sample_id)
        return {"success": True}
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get(
    "/export.jsonl",
    dependencies=[Depends(require_permission_codes("kuaiai:training:export"))],
)
async def export_training_jsonl(
    tenant_id: int = Depends(get_current_tenant),
) -> Response:
    content = await TrainingExportService.build_jsonl(tenant_id=tenant_id)
    return Response(
        content=content,
        media_type="application/x-ndjson",
        headers={"Content-Disposition": 'attachment; filename="kuaiai-training.jsonl"'},
    )
