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
from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from core.services.authorization.permission_policy_service import PermissionPolicyService
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, BusinessLogicError, ValidationError

from apps.kuaizhizao.services.quotation_service import QuotationService
from apps.kuaizhizao.schemas.quotation import (
    QuotationCreate,
    QuotationUpdate,
    QuotationResponse,
    QuotationListResponse,
    QuotationReviewAction,
    QuotationRevisionBody,
)
from apps.kuaizhizao.schemas.sales_order import SalesOrderResponse

quotation_service = QuotationService()

# 报价单列表可排序字段白名单（防止注入）
QUOTATION_SORTABLE_FIELDS = frozenset({
    "quotation_code",
    "quotation_series_code",
    "customer_name",
    "quotation_date",
    "valid_until",
    "delivery_date",
    "total_quantity",
    "total_amount",
    "version_no",
    "status",
    "review_status",
    "salesman_name",
    "created_at",
    "updated_at",
})

router = APIRouter(
    prefix="/quotations",
    tags=["App - Kuaige Zhizao - Quotation Management"],
    dependencies=[Depends(require_kuaizhizao_module_access("quotation"))],
)


async def _mask_quotation_payload(
    *,
    tenant_id: int,
    user_id: int,
    payload: dict,
) -> dict:
    return await PermissionPolicyService.apply_field_masks_to_dict(
        tenant_id=tenant_id,
        user_id=user_id,
        resource="kuaizhizao:quotation",
        payload=payload,
    )


@router.post("", response_model=QuotationResponse, summary="Create quotation")
async def create_quotation(
    quotation_data: QuotationCreate,
    auto_submit: bool = Query(
        True,
        description="创建后是否自动提交；false 时保持草稿",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建报价单，报价单编码自动生成"""
    try:
        return await quotation_service.create_quotation(
            tenant_id=tenant_id,
            quotation_data=quotation_data,
            created_by=current_user.id,
            auto_submit=auto_submit,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("创建报价单失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="创建报价单失败",
        )


@router.get("", response_model=QuotationListResponse, summary="List quotations")
async def list_quotations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    lifecycle_stage: Optional[str] = Query(None, description="生命周期阶段（与列表展示一致，如 已报价、客户确认）"),
    salesman_id: Optional[int] = Query(None, description="销售员 ID"),
    customer_id: Optional[int] = Query(None, description="客户 ID"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    keyword: Optional[str] = Query(None, description="关键词搜索（编号、系列、客户、销售员）"),
    quotation_code: Optional[str] = Query(None, description="报价单编号（模糊）"),
    customer_name: Optional[str] = Query(None, description="客户名称（模糊）"),
    quotation_series_code: Optional[str] = Query(None, description="报价系列编码（精确）"),
    order_by: Optional[str] = Query(None, description="排序字段，如 quotation_date、-updated_at（前缀-表示降序）"),
    list_scope: Optional[str] = Query(
        None,
        description="数据范围：all 全部 / mine 我的 / department 我的部门",
    ),
    pullable_only: Optional[bool] = Query(
        None,
        description="仅可上拉建单：未关联有效销售订单且非已转订单状态",
    ),
    pull_target: Optional[str] = Query(
        None,
        description="上拉目标：sales_order/sales_contract；与 pullable_only 组合使用",
    ),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取报价单列表，支持按状态、生命周期、日期、关键词筛选与排序"""
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in QUOTATION_SORTABLE_FIELDS:
            safe_order_by = order_by

    try:
        result = await quotation_service.list_quotations(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            status=status,
            lifecycle_stage=lifecycle_stage,
            salesman_id=salesman_id,
            customer_id=customer_id,
            start_date=start_date,
            end_date=end_date,
            keyword=keyword,
            quotation_code=quotation_code,
            customer_name=customer_name,
            quotation_series_code=quotation_series_code,
            order_by=safe_order_by,
            list_scope=list_scope,
            pullable_only=pullable_only,
            pull_target=pull_target,
            current_user=current_user,
        )
        payloads = [row.model_dump() for row in result.data]
        masked_payloads = await PermissionPolicyService.apply_field_masks_to_list(
            tenant_id=tenant_id,
            user_id=current_user.id,
            resource="kuaizhizao:quotation",
            payloads=payloads,
        )
        masked_rows = [QuotationResponse(**masked) for masked in masked_payloads]
        return QuotationListResponse(
            data=masked_rows,
            total=result.total,
            success=result.success,
        )
    except Exception as e:
        logger.error("获取报价单列表失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取报价单列表失败",
        )


@router.get("/{quotation_id}", response_model=QuotationResponse, summary="Get quotation")
async def get_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    include_items: bool = Query(True, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取报价单详情"""
    try:
        result = await quotation_service.get_quotation_by_id(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            include_items=include_items,
            current_user=current_user,
        )
        masked = await _mask_quotation_payload(
            tenant_id=tenant_id,
            user_id=current_user.id,
            payload=result.model_dump(),
        )
        return QuotationResponse(**masked)
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error("获取报价单详情失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="获取报价单详情失败",
        )


@router.post(
    "/{quotation_id}/revision",
    response_model=QuotationResponse,
    summary="New revision (copy latest as draft)",
)
async def create_quotation_revision(
    quotation_id: int = Path(..., description="报价单ID（系列内任一行，系统解析最新版）"),
    body: QuotationRevisionBody = Body(default_factory=QuotationRevisionBody),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """从系列当前最新版复制为新的草稿版本；旧版标记为非最新。"""
    try:
        payload = body.model_dump(exclude_unset=True) if body else {}
        return await quotation_service.create_quotation_revision(
            tenant_id=tenant_id,
            source_quotation_id=quotation_id,
            created_by=current_user.id,
            revision_data=body if payload else None,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("另存报价新版本失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="另存报价新版本失败",
        )


@router.put("/{quotation_id}", response_model=QuotationResponse, summary="Update quotation")
async def update_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    quotation_data: QuotationUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """更新报价单，仅草稿状态可更新"""
    try:
        result = await quotation_service.update_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            quotation_data=quotation_data,
            updated_by=current_user.id,
            current_user=current_user,
        )
        masked = await _mask_quotation_payload(
            tenant_id=tenant_id,
            user_id=current_user.id,
            payload=result.model_dump(),
        )
        return QuotationResponse(**masked)
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


@router.post("/{quotation_id}/withdraw", response_model=QuotationResponse, summary="Withdraw submitted quotation")
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


@router.post("/{quotation_id}/submit", response_model=QuotationResponse, summary="Submit quotation")
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


@router.post("/{quotation_id}/approve", response_model=QuotationResponse, summary="Approve quotation")
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


@router.post("/{quotation_id}/reject", response_model=QuotationResponse, summary="Reject quotation")
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


@router.post("/{quotation_id}/revoke-review", response_model=QuotationResponse, summary="Withdraw review (back to pending)")
async def revoke_review_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已发送且已通过 → 人工审回到待审核，自动审回到草稿。"""
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


@router.post("/{quotation_id}/confirm-customer", response_model=QuotationResponse, summary="Customer confirm (accepted)")
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


@router.post(
    "/{quotation_id}/cancel-customer-confirm",
    response_model=QuotationResponse,
    summary="Cancel customer confirm (back to sent)",
)
async def cancel_customer_confirm_quotation(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """已接受 → 已发送（审核状态不变，可撤回审核或删除）。"""
    try:
        return await quotation_service.cancel_customer_confirm_quotation(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("报价单客户取消确认失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="报价单客户取消确认失败",
        )


@router.post("/{quotation_id}/reopen", response_model=QuotationResponse, summary="Reopen after rejection")
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


@router.post("/{quotation_id}/revoke-push", response_model=QuotationResponse, summary="Reverse push")
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


@router.get("/{quotation_id}/print", summary="Print quotation")
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
    import base64
    from apps.kuaizhizao.services.print_service import DocumentPrintService
    from fastapi.responses import HTMLResponse, JSONResponse, Response

    try:
        result = await DocumentPrintService().print_document(
            tenant_id=tenant_id,
            document_type="quotation",
            document_id=quotation_id,
            template_code=template_code,
            template_uuid=template_uuid,
            output_format=output_format,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 仅在明确请求二进制响应时返回原始 PDF；
    # response_format=json 时必须返回 base64 JSON，供前端解析预览。
    if (
        (output_format or "html").lower() == "pdf"
        and (response_format or "json").lower() in {"pdf", "binary", "raw"}
        and result.get("mime_type") == "application/pdf"
    ):
        raw = base64.b64decode(result.get("content") or "")
        return Response(
            content=raw,
            media_type="application/pdf",
            headers={"Content-Disposition": f'inline; filename="quotation-{quotation_id}.pdf"'},
        )
    if response_format == "html":
        return HTMLResponse(content=result.get("content", ""), status_code=200)
    return JSONResponse(content=result, status_code=200)


@router.get("/{quotation_id}/print-variables", summary="Quotation print variables")
async def get_quotation_print_variables(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """与 `_format_quotation_data` 一致。"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        variables = await DocumentPrintService().get_document_variables_for_print(
            tenant_id, "quotation", quotation_id
        )
        return {"success": True, "variables": variables}
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{quotation_id}/record-print", summary="Record quotation printed timestamp")
async def record_quotation_print(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """与服务端打印路径中的 `_maybe_stamp_quotation_formal` 行为一致。"""
    from apps.kuaizhizao.services.print_service import DocumentPrintService

    try:
        await DocumentPrintService()._maybe_stamp_quotation_formal(tenant_id, "quotation", quotation_id)
        return {"success": True}
    except Exception as e:
        logger.error("记录报价单打印失败: %s", e)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="记录打印失败",
        )


@router.delete("/{quotation_id}", status_code=http_status.HTTP_204_NO_CONTENT, summary="Delete quotation")
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
            current_user=current_user,
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


@router.get(
    "/{quotation_id}/push-to-sales-order/preview",
    summary="Preview push quotation to sales order",
)
async def preview_push_quotation_to_sales_order(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await quotation_service.preview_push_quotation_to_sales_order(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/{quotation_id}/push-to-sales-contract/preview",
    summary="Preview push quotation to sales contract",
)
async def preview_push_quotation_to_sales_contract(
    quotation_id: int = Path(..., description="报价单ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        return await quotation_service.preview_push_quotation_to_sales_contract(
            tenant_id=tenant_id,
            quotation_id=quotation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=http_status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/{quotation_id}/convert-to-order",
    summary="Convert to sales order",
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
