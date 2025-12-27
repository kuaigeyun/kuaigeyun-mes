"""
凭证 API 模块

提供凭证的 RESTful API 接口，支持多组织隔离。
按照中国财务规范：借贷记账法、凭证审核、过账。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated
from datetime import datetime

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaiacc.services.voucher_service import VoucherService, VoucherEntryService
from apps.kuaiacc.schemas.voucher_schemas import (
    VoucherCreate, VoucherUpdate, VoucherResponse,
    VoucherEntryCreate, VoucherEntryResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/vouchers", tags=["Vouchers"])


@router.post("", response_model=VoucherResponse, summary="创建凭证")
async def create_voucher(
    data: VoucherCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建凭证
    
    - **voucher_no**: 凭证编号（必填，组织内唯一，格式：记-001、收-001、付-001、转-001）
    - **voucher_date**: 凭证日期（必填）
    - **voucher_type**: 凭证类型（必填：记账凭证、收款凭证、付款凭证、转账凭证）
    - **total_debit**: 借方合计（必填，必须等于贷方合计）
    - **total_credit**: 贷方合计（必填，必须等于借方合计）
    """
    try:
        return await VoucherService.create_voucher(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[VoucherResponse], summary="获取凭证列表")
async def list_vouchers(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    voucher_type: Optional[str] = Query(None, description="凭证类型（过滤）"),
    status: Optional[str] = Query(None, description="状态（过滤）"),
    start_date: Optional[datetime] = Query(None, description="开始日期（过滤）"),
    end_date: Optional[datetime] = Query(None, description="结束日期（过滤）")
):
    """
    获取凭证列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **voucher_type**: 凭证类型（可选，用于过滤）
    - **status**: 状态（可选，用于过滤）
    - **start_date**: 开始日期（可选，用于过滤）
    - **end_date**: 结束日期（可选，用于过滤）
    """
    return await VoucherService.list_vouchers(
        tenant_id, skip, limit, voucher_type, status, start_date, end_date
    )


@router.get("/{voucher_uuid}", response_model=VoucherResponse, summary="获取凭证详情")
async def get_voucher(
    voucher_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取凭证详情
    
    - **voucher_uuid**: 凭证UUID
    """
    try:
        return await VoucherService.get_voucher_by_uuid(tenant_id, voucher_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{voucher_uuid}", response_model=VoucherResponse, summary="更新凭证")
async def update_voucher(
    voucher_uuid: str,
    data: VoucherUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新凭证（已过账的凭证不能修改）
    
    - **voucher_uuid**: 凭证UUID
    """
    try:
        return await VoucherService.update_voucher(tenant_id, voucher_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{voucher_uuid}/review", response_model=VoucherResponse, summary="审核凭证")
async def review_voucher(
    voucher_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    审核凭证（只有草稿状态的凭证才能审核，必须借贷平衡）
    
    - **voucher_uuid**: 凭证UUID
    """
    try:
        return await VoucherService.review_voucher(tenant_id, voucher_uuid, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{voucher_uuid}/post", response_model=VoucherResponse, summary="过账凭证")
async def post_voucher(
    voucher_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    过账凭证（只有已审核状态的凭证才能过账）
    
    - **voucher_uuid**: 凭证UUID
    """
    try:
        return await VoucherService.post_voucher(tenant_id, voucher_uuid, current_user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{voucher_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除凭证")
async def delete_voucher(
    voucher_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除凭证（软删除，已过账的凭证不能删除）
    
    - **voucher_uuid**: 凭证UUID
    """
    try:
        await VoucherService.delete_voucher(tenant_id, voucher_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# 凭证分录相关接口
@router.post("/entries", response_model=VoucherEntryResponse, summary="创建凭证分录")
async def create_voucher_entry(
    data: VoucherEntryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建凭证分录
    
    - **voucher_id**: 凭证ID（必填）
    - **entry_no**: 分录序号（必填）
    - **subject_id**: 科目ID（必填）
    - **debit_amount**: 借方金额
    - **credit_amount**: 贷方金额
    """
    try:
        return await VoucherEntryService.create_voucher_entry(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{voucher_id}/entries", response_model=List[VoucherEntryResponse], summary="获取凭证分录列表")
async def list_voucher_entries(
    voucher_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    获取凭证分录列表
    
    - **voucher_id**: 凭证ID
    """
    return await VoucherEntryService.list_voucher_entries(tenant_id, voucher_id)


@router.delete("/entries/{entry_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除凭证分录")
async def delete_voucher_entry(
    entry_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除凭证分录（软删除）
    
    - **entry_uuid**: 分录UUID
    """
    try:
        await VoucherEntryService.delete_voucher_entry(tenant_id, entry_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

