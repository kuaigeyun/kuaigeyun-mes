"""检测入站 API（device token，无需用户登录）。"""

from fastapi import APIRouter

from apps.kuaivision.schemas.vision import IngestBatchPayload, IngestBatchResponse, IngestPayload, IngestResponse
from apps.kuaivision.services.ingest_service import IngestService

router = APIRouter(prefix="/ingest", tags=["App - KuaiVision - Ingest"])


@router.post("/{device_token}", response_model=IngestResponse)
async def ingest_one(device_token: str, payload: IngestPayload):
    return await IngestService.ingest(device_token, payload)


@router.post("/{device_token}/batch", response_model=IngestBatchResponse)
async def ingest_batch(device_token: str, payload: IngestBatchPayload):
    return await IngestService.ingest_batch(device_token, payload)
