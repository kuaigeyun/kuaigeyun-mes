"""
供应商评估 API 模块

提供供应商评估的 RESTful API 接口，支持多组织隔离。
注意：参数顺序为 路径参数 → Depends参数 → Query参数
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaisrm.services.supplier_evaluation_service import SupplierEvaluationService
from apps.kuaisrm.schemas.supplier_evaluation_schemas import (
    SupplierEvaluationCreate, SupplierEvaluationUpdate, SupplierEvaluationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/supplier-evaluations", tags=["Supplier Evaluations"])


@router.post("", response_model=SupplierEvaluationResponse, status_code=status.HTTP_201_CREATED, summary="创建供应商评估")
async def create_supplier_evaluation(
    data: SupplierEvaluationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    创建供应商评估
    
    - **evaluation_no**: 评估编号（必填，组织内唯一）
    - **supplier_id**: 供应商ID（必填）
    - **evaluation_period**: 评估周期（必填）
    - **evaluation_date**: 评估日期（必填）
    """
    try:
        return await SupplierEvaluationService.create_supplier_evaluation(tenant_id, data)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=List[SupplierEvaluationResponse], summary="获取供应商评估列表")
async def list_supplier_evaluations(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（过滤）"),
    evaluation_period: Optional[str] = Query(None, description="评估周期（过滤）")
):
    """
    获取供应商评估列表
    
    - **skip**: 跳过数量（默认：0）
    - **limit**: 限制数量（默认：100，最大：1000）
    - **supplier_id**: 供应商ID（可选，用于过滤）
    - **evaluation_period**: 评估周期（可选）
    """
    return await SupplierEvaluationService.list_supplier_evaluations(tenant_id, skip, limit, supplier_id, evaluation_period)


@router.get("/{evaluation_uuid}", response_model=SupplierEvaluationResponse, summary="获取供应商评估详情")
async def get_supplier_evaluation(
    evaluation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    根据UUID获取供应商评估详情
    
    - **evaluation_uuid**: 评估UUID
    """
    try:
        return await SupplierEvaluationService.get_supplier_evaluation_by_uuid(tenant_id, evaluation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{evaluation_uuid}", response_model=SupplierEvaluationResponse, summary="更新供应商评估")
async def update_supplier_evaluation(
    evaluation_uuid: str,
    data: SupplierEvaluationUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    更新供应商评估
    
    - **evaluation_uuid**: 评估UUID
    - **data**: 评估更新数据
    """
    try:
        return await SupplierEvaluationService.update_supplier_evaluation(tenant_id, evaluation_uuid, data)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{evaluation_uuid}", status_code=status.HTTP_204_NO_CONTENT, summary="删除供应商评估")
async def delete_supplier_evaluation(
    evaluation_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    删除供应商评估（软删除）
    
    - **evaluation_uuid**: 评估UUID
    """
    try:
        await SupplierEvaluationService.delete_supplier_evaluation(tenant_id, evaluation_uuid)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
