"""
样品试用单管理 API 路由模块

客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status as http_status, Body
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel, Field
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.sample_trial_service import SampleTrialService
from apps.kuaizhizao.schemas.sample_trial import (
    SampleTrialCreate,
    SampleTrialUpdate,
    SampleTrialResponse,
    SampleTrialListResponse,
    SampleTrialWithItemsResponse,
)

sample_trial_service = SampleTrialService()
router = APIRouter(prefix="/sample-trials", tags=["Kuaige Zhizao - Sample Trial"])


class CreateSampleOutboundRequest(BaseModel):
    """创建样品出库请求"""
    warehouse_id: int = Field(..., description="出库仓库ID")
    warehouse_name: str = Field(..., max_length=100, description="出库仓库名称")


@router.post("", response_model=SampleTrialResponse, summary="创建样品试用单")
async def create_sample_trial(
    trial_data: SampleTrialCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建样品试用单，试用单编码自动生成"""
    try:
        return await sample_trial_service.create_sample_trial(
            tenant_id=tenant_id,
            trial_data=trial_data,
            created_by=current_user.id,
        )
    except Exception as e:
        logger.error("创建样品试用单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建样品试用单失败",
        )


@router.get("", response_model=List[SampleTrialListResponse], summary="获取样品试用单列表")
async def list_sample_trials(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取样品试用单列表"""
    return await sample_trial_service.list_sample_trials(
        tenant_id=tenant_id,
        skip=skip,
        limit=limit,
        status=status,
        customer_id=customer_id,
    )


@router.get("/{trial_id}", response_model=SampleTrialWithItemsResponse, summary="获取样品试用单详情")
async def get_sample_trial(
    trial_id: int = Path(..., description="试用单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取样品试用单详情（含明细）"""
    try:
        return await sample_trial_service.get_sample_trial_by_id(
            tenant_id=tenant_id,
            trial_id=trial_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{trial_id}", response_model=SampleTrialResponse, summary="更新样品试用单")
async def update_sample_trial(
    trial_id: int = Path(..., description="试用单ID"),
    trial_data: SampleTrialUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新样品试用单，仅草稿状态可更新"""
    try:
        return await sample_trial_service.update_sample_trial(
            tenant_id=tenant_id,
            trial_id=trial_id,
            trial_data=trial_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{trial_id}", summary="删除样品试用单")
async def delete_sample_trial(
    trial_id: int = Path(..., description="试用单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除样品试用单，仅草稿状态可删除"""
    try:
        await sample_trial_service.delete_sample_trial(
            tenant_id=tenant_id,
            trial_id=trial_id,
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{trial_id}/convert-to-order", summary="转为销售订单")
async def convert_to_sales_order(
    trial_id: int = Path(..., description="试用单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """将样品试用单转为销售订单"""
    try:
        sales_order, trial_updated = await sample_trial_service.convert_to_sales_order(
            tenant_id=tenant_id,
            trial_id=trial_id,
            created_by=current_user.id,
        )
        return {"success": True, "sales_order": sales_order, "sample_trial": trial_updated}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{trial_id}/create-outbound", summary="创建样品出库")
async def create_sample_outbound(
    trial_id: int = Path(..., description="试用单ID"),
    body: CreateSampleOutboundRequest = Body(...),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """根据样品试用单创建样品出库（其他出库，原因：样品）"""
    try:
        outbound = await sample_trial_service.create_sample_outbound(
            tenant_id=tenant_id,
            trial_id=trial_id,
            warehouse_id=body.warehouse_id,
            warehouse_name=body.warehouse_name,
            created_by=current_user.id,
        )
        return {"success": True, "outbound": outbound}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{trial_id}/print", summary="打印样品试用单")
async def print_sample_trial(
    trial_id: int = Path(..., description="试用单ID"),
    template_code: Optional[str] = Query(None),
    template_uuid: Optional[str] = Query(None),
    output_format: str = Query("html"),
    response_format: str = Query("json"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印样品试用单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="sample_trial",
        document_id=trial_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format,
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)
