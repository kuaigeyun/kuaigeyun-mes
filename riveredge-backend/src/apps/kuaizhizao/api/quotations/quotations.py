"""
报价单管理 API 路由模块

提供报价单相关的API接口。

Author: RiverEdge Team
Date: 2026-02-19
"""

from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Body, Depends, Query, Path, HTTPException, status as http_status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError

from apps.kuaizhizao.services.quotation_service import QuotationService
from apps.kuaizhizao.schemas.quotation import (
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationListResponse,
    QuotationReviewAction,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderResponse

quotation_service = QuotationService()
router = APIRouter(prefix="/quotations", tags=["Kuaige Zhizao - Quotation Management"])


@router.post("", response_model=QuotationResponse, summary="创建报价单")
async def create_quotation(
    quotation_data: QuotationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建报价单，报价单编码自动生成"""
    try:
        return await quotation_service.create_quotation(
            tenant_id=tenant_id,
            quotation_data=quotation_data,
            created_by=current_user.id,
        )
    except Exception as e:
        logger.error("创建报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建报价单失败",
        )


@router.get("", response_model=QuotationListResponse, summary="获取报价单列表")
async def list_quotations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    keyword: Optional[str] = Query(None, description="关键词搜索（编码、客户）"),
    quotation_code: Optional[str] = Query(None, description="报价单编号（模糊）"),
    customer_name: Optional[str] = Query(None, description="客户名称（模糊）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取报价单列表，支持按状态、日期、关键词筛选"""
    try:
        return await quotation_service.list_quotations(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            start_date=start_date,
            end_date=end_date,
            keyword=keyword,
            quotation_code=quotation_code,
            customer_name=customer_name,
            current_user=current_user,
        )
    except Exception as e:
        logger.error("获取报价单列表失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取报价单列表失败",
        )


@router.get("/{quotation_id}", response_model=QuotationResponse, summary="获取报价单详情")
async def get_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    include_items: bool = Query(True, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取报价单详情"""
    try:
        return await quotation_service.get_quotation_by_id(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            include_items=include_items,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("获取报价单详情失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取报价单详情失败",
        )


@router.put("/{quotation_id}", response_model=QuotationResponse, summary="更新报价单")
async def update_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    quotation_data: QuotationUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新报价单，仅草稿状态可更新"""
    try:
        return await quotation_service.update_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            quotation_data=quotation_data,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("更新报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新报价单失败",
        )


@router.post("/{quotation_id}/withdraw", response_model=QuotationResponse, summary="撤回已提交的报价单")
async def withdraw_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且待审核的报价单撤回到草稿，可再编辑或删除。"""
    try:
        return await quotation_service.withdraw_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            withdrawn_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("撤回报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="撤回报价单失败",
        )


@router.post("/{quotation_id}/submit", response_model=QuotationResponse, summary="提交报价单")
async def submit_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """草稿提交为已发送；蓝图无需审核时自动审核通过，否则进入待审核。"""
    try:
        return await quotation_service.submit_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            submitted_by=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("提交报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="提交报价单失败",
        )


@router.post("/{quotation_id}/approve", response_model=QuotationResponse, summary="审核通过报价单")
async def approve_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    body: QuotationReviewAction = Body(default_factory=QuotationReviewAction),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且待审核 → 审核通过（保持已发送）。"""
    try:
        return await quotation_service.approve_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单审核通过失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单审核通过失败",
        )


@router.post("/{quotation_id}/reject", response_model=QuotationResponse, summary="驳回报价单")
async def reject_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    body: QuotationReviewAction = Body(default_factory=QuotationReviewAction),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且待审核 → 已拒绝。"""
    try:
        return await quotation_service.reject_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
            review_remarks=body.review_remarks,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单驳回失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单驳回失败",
        )


@router.post("/{quotation_id}/revoke-review", response_model=QuotationResponse, summary="撤回审核（回到待审核）")
async def revoke_review_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且已通过 → 回到待审核。"""
    try:
        return await quotation_service.revoke_review_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单撤回审核失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单撤回审核失败",
        )


@router.post("/{quotation_id}/confirm-customer", response_model=QuotationResponse, summary="客户确认（标记已接受）")
async def confirm_customer_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且审核通过 → 已接受（发送/客户认可）。"""
    try:
        return await quotation_service.confirm_customer_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单客户确认失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单客户确认失败",
        )


@router.post("/{quotation_id}/reopen", response_model=QuotationResponse, summary="驳回后重新编辑")
async def reopen_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已拒绝 → 草稿，可修改后再次提交。"""
    try:
        return await quotation_service.reopen_quotation_after_reject(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单重新打开失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单重新打开失败",
        )


@router.post("/{quotation_id}/revoke-push", response_model=QuotationResponse, summary="撤回下推")
async def revoke_push_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已转订单但下游销售订单已不存在时，解除关联回到已接受。"""
    try:
        return await quotation_service.revoke_push_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单撤回下推失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单撤回下推失败",
        )


@router.get("/{quotation_id}/print", summary="打印报价单")
async def print_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    template_code: Optional[str] = Query(None, description="打印模板代码"),
    template_uuid: Optional[str] = Query(None, description="打印模板UUID"),
    output_format: str = Query("html", description="输出格式"),
    response_format: str = Query("json", description="响应格式"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """打印报价单"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse
    result = await DocumentPrintService().print_document(
        tenant_id=tenant_id,
        document_type="quotation",
        document_id=quotation_id,
        template_code=template_code,
        template_uuid=template_uuid,
        output_format=output_format,
    )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.delete("/{quotation_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="删除报价单")
async def delete_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """删除报价单（软删除）。未转销售订单前可删；已转订单或已关联销售订单的不可删。"""
    try:
        await quotation_service.delete_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("删除报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="删除报价单失败",
        )


class ConvertToOrderResponse(QuotationResponse):
    """转订单响应：包含新创建的销售订单"""
    sales_order: Optional[SalesOrderResponse] = None


@router.post(
    "/{quotation_id}/convert-to-order",
    summary="转为销售订单",
)
async def convert_to_sales_order(
    quotation_id: int = Path(..., description="报价单ID"),
    selected_item_ids: Optional[List[int]] = Body(default=None, embed=True, description="可选：仅转换指定报价明细ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    将报价单转为销售订单

    创建销售订单及明细，更新报价单状态为「已转订单」，建立单据关联。
    返回新创建的销售订单及更新后的报价单。
    """
    try:
        sales_order, quotation = await quotation_service.convert_to_sales_order(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            created_by=current_user.id,
            selected_item_ids=selected_item_ids,
        )
        return {
            "sales_order": sales_order,
            "quotation": quotation,
        }
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单转销售订单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单转销售订单失败",
        )
