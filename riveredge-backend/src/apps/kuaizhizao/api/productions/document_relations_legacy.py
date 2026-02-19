"""
单据关联、打印、耗时统计 API 路由模块（Legacy）

提供单据关联关系、打印、耗时统计等API接口。
从 productions.py 提取以保持路径兼容。
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Path
from fastapi.responses import HTMLResponse, JSONResponse

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User

from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
from apps.kuaizhizao.services.print_service import DocumentPrintService
from apps.kuaizhizao.services.document_timing_service import DocumentTimingService
from apps.kuaizhizao.schemas.document_relation import (
    GetDocumentRelationsResponse,
    DocumentTraceResponse,
)
from apps.kuaizhizao.schemas.document_node_timing import DocumentTimingSummaryResponse

router = APIRouter(tags=["Kuaige Zhizao - Document Relations (Legacy)"])

document_timing_service = DocumentTimingService()


# ============ 单据关联管理 API ============


@router.get("/documents/{document_type}/{document_id}/relations", response_model=GetDocumentRelationsResponse, summary="获取单据关联关系")
async def get_document_relations(
    document_type: str = Path(..., description="单据类型（如：work_order, sales_forecast等）"),
    document_id: int = Path(..., description="单据ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> GetDocumentRelationsResponse:
    """
    获取单据的关联关系（上游和下游单据）

    支持的单据类型：
    - **sales_forecast**: 销售预测
    - **sales_order**: 销售订单
    - **mrp_result**: MRP运算结果
    - **lrp_result**: LRP运算结果
    - **work_order**: 工单
    - **production_picking**: 生产领料单
    - **reporting_record**: 报工记录
    - **finished_goods_receipt**: 成品入库单
    - **sales_delivery**: 销售出库单
    - **purchase_order**: 采购订单
    - **purchase_receipt**: 采购入库单
    - **payable**: 应付单
    - **receivable**: 应收单

    - **document_type**: 单据类型
    - **document_id**: 单据ID

    返回：
    - upstream_documents: 上游单据列表（来源单据）
    - downstream_documents: 下游单据列表（生成单据）
    """
    result = await DocumentRelationService().get_document_relations(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id
    )
    return GetDocumentRelationsResponse(**result)


@router.get("/documents/{document_type}/{document_id}/trace", response_model=DocumentTraceResponse, summary="追溯单据关联链")
async def trace_document_chain(
    document_type: str = Path(..., description="单据类型"),
    document_id: int = Path(..., description="单据ID"),
    direction: str = Query("both", description="追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DocumentTraceResponse:
    """
    追溯单据关联链（完整追溯）

    支持所有单据类型的完整关联链追溯，包括多层级关联关系。

    - **document_type**: 单据类型（支持所有单据类型，参见关联关系API）
    - **document_id**: 单据ID
    - **direction**: 追溯方向
      - **upstream**: 向上追溯（查找来源单据）
      - **downstream**: 向下追溯（查找生成单据）
      - **both**: 双向追溯（默认）

    返回完整的关联链，支持多层级追溯，自动避免循环引用。
    """
    result = await DocumentRelationService().trace_document_chain(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
        direction=direction
    )
    return DocumentTraceResponse(**result)


# ============ 单据打印 API ============


@router.get("/documents/{document_type}/{document_id}/print", summary="打印单据")
async def print_document(
    document_type: str = Path(..., description="单据类型（如：work_order, production_picking等）"),
    document_id: int = Path(..., description="单据ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码（可选）"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID（可选，优先于 template_code）"),
    output_format: str = Query("html", description="输出格式（html/pdf）"),
    response_format: str = Query("json", description="响应格式：json（API调用）或 html（window.open 直接打开）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    打印单据

    - **document_type**: 单据类型（如：work_order, production_picking 等）
    - **document_id**: 单据ID
    - **template_code**: 打印模板代码（可选）
    - **template_uuid**: 打印模板UUID（可选，优先于 template_code）
    - **output_format**: 输出格式（html/pdf，默认：html）
    - **response_format**: json（默认，API 调用）或 html（window.open 直接打开）

    返回 JSON { success, content, message } 或直接返回 HTML
    """
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


# ============ 单据节点耗时统计 API ============


@router.get("/documents/timing", response_model=List[DocumentTimingSummaryResponse], summary="获取单据耗时统计列表")
async def list_documents_timing(
    document_type: Optional[str] = Query(None, description="单据类型（如：work_order/purchase_order/sales_order）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[DocumentTimingSummaryResponse]:
    """
    获取单据耗时统计列表

    返回有耗时记录的单据列表，支持按单据类型筛选。

    - **document_type**: 单据类型（可选）
    - **skip**: 跳过数量
    - **limit**: 限制数量
    """
    return await document_timing_service.list_documents_with_timing(
        tenant_id=tenant_id,
        document_type=document_type,
        skip=skip,
        limit=limit,
    )


@router.get("/documents/{document_type}/{document_id}/timing", response_model=DocumentTimingSummaryResponse, summary="获取单据耗时统计")
async def get_document_timing(
    document_type: str = Path(..., description="单据类型（如：work_order/purchase_order/sales_order）"),
    document_id: int = Path(..., description="单据ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> DocumentTimingSummaryResponse:
    """
    获取单据的耗时统计

    返回单据在各个节点的耗时信息，包括总耗时和各个节点的详细耗时。

    - **document_type**: 单据类型
    - **document_id**: 单据ID
    """
    return await document_timing_service.get_document_timing(
        tenant_id=tenant_id,
        document_type=document_type,
        document_id=document_id,
    )


@router.get("/documents/efficiency", summary="获取单据执行效率分析")
async def get_document_efficiency(
    document_type: Optional[str] = Query(None, description="单据类型（如：work_order/purchase_order/sales_order）"),
    date_start: Optional[str] = Query(None, description="开始日期（ISO格式）"),
    date_end: Optional[str] = Query(None, description="结束日期（ISO格式）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> dict:
    """
    获取单据执行效率分析

    返回单据执行效率分析结果，包括平均耗时、瓶颈节点、优化建议等。

    - **document_type**: 单据类型（可选）
    - **date_start**: 开始日期（可选）
    - **date_end**: 结束日期（可选）
    """
    date_start_dt = None
    date_end_dt = None

    if date_start:
        try:
            date_start_dt = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
        except ValueError:
            pass

    if date_end:
        try:
            date_end_dt = datetime.fromisoformat(date_end.replace('Z', '+00:00'))
        except ValueError:
            pass

    return await document_timing_service.get_document_efficiency(
        tenant_id=tenant_id,
        document_type=document_type,
        date_start=date_start_dt,
        date_end=date_end_dt,
    )
