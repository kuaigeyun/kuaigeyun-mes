"""
报价单 API 模块

提供报价单的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.quotation_service import QuotationService
from apps.kuaicrm.schemas.quotation_schemas import (
    QuotationCreate, QuotationUpdate, QuotationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/quotations", tags=["Quotations"])


@router.post("", response_model=QuotationResponse, response_model_by_alias=True, summary="创建报价单")
async def create_quotation(
    data: QuotationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建报价单
    
    - **quotation_no**: 报价单编号（必填，组织内唯一）
    - **quotation_date**: 报价日期（必填）
    - **customer_id**: 客户ID（必填，关联master-data）
    - **opportunity_id**: 关联商机ID（可选）
    - **lead_id**: 关联线索ID（可选）
    - **status**: 报价单状态（默认：草稿）
    - **total_amount**: 报价金额（必填）
    - **valid_until**: 有效期至（可选）
    - **description**: 描述（可选）
    - **terms**: 条款说明（可选）
    """
    try:
        return await QuotationService.create_quotation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[QuotationResponse], response_model_by_alias=True, summary="获取报价单列表")
async def list_quotations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    status: Optional[str] = Query(None, description="报价单状态（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取报价单列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **status**: 报价单状态（可选，用于过滤）
    - **customer_id**: 客户ID（可选）
    """
    return await QuotationService.list_quotations(tenant_id, skip, limit, status, customer_id)


@router.get("/{quotation_uuid}", response_model=QuotationResponse, response_model_by_alias=True, summary="获取报价单详情")
async def get_quotation(
    quotation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取报价单详情
    
    - **quotation_uuid**: 报价单UUID
    """
    try:
        return await QuotationService.get_quotation_by_uuid(tenant_id, quotation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{quotation_uuid}", response_model=QuotationResponse, response_model_by_alias=True, summary="更新报价单")
async def update_quotation(
    quotation_uuid: str,
    data: QuotationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新报价单
    
    支持 camelCase 和 snake_case 两种字段命名方式。
    
    - **quotation_uuid**: 报价单UUID
    - **quotationDate** / **quotation_date**: 报价日期（可选）
    - **customerId** / **customer_id**: 客户ID（可选）
    - **opportunityId** / **opportunity_id**: 关联商机ID（可选）
    - **leadId** / **lead_id**: 关联线索ID（可选）
    - **status**: 报价单状态（可选）
    - **totalAmount** / **total_amount**: 报价金额（可选）
    - **validUntil** / **valid_until**: 有效期至（可选）
    - **description**: 描述（可选）
    - **terms**: 条款说明（可选）
    """
    try:
        return await QuotationService.update_quotation(tenant_id, quotation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{quotation_uuid}", summary="删除报价单")
async def delete_quotation(
    quotation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除报价单（软删除）
    
    - **quotation_uuid**: 报价单UUID
    """
    try:
        await QuotationService.delete_quotation(tenant_id, quotation_uuid)
        return {"message": "报价单删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{quotation_uuid}/convert-to-order", summary="将报价单转化为销售订单")
async def convert_quotation_to_order(
    quotation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    order_data: Optional[dict] = None
):
    """
    将报价单转化为销售订单
    
    - **quotation_uuid**: 报价单UUID
    - **order_data**: 订单数据（可选，用于覆盖报价单数据）
    """
    try:
        result = await QuotationService.convert_to_order(tenant_id, quotation_uuid, order_data)
        return {
            "message": "报价单已转化为销售订单",
            "quotation": result["quotation"],
            "order": result["order"]
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

