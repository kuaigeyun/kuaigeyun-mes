"""
波次拣货 (Wave Picking) API 路由模块

提供波次拣货相关联的合并拣货单、最优动线推荐等接口。
"""

from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError

from apps.kuaizhizao.services.wave_picking_service import WavePickingService
from apps.kuaizhizao.schemas.wave_picking import (
    WavePickingGenerateRequest,
    WavePickingResponse
)

router = APIRouter(prefix="/wave-pickings", tags=["App · Kuaige Zhizao · Wave Picking"])

@router.post("/generate", response_model=WavePickingResponse, summary="Generate consolidated wave picking list")
async def generate_picking_wave(
    request: WavePickingGenerateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant)
) -> WavePickingResponse:
    """
    接收多个领料单ID，将其按物料+库位维度汇总，并按最优动线(仓库+库位名)返回汇总列表。
    """
    try:
        service = WavePickingService()
        result = await service.generate_picking_wave(tenant_id, request.picking_ids)
        return WavePickingResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("生成波次拣货合单失败")
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成波次拣货失败: {str(e)}"
        )
