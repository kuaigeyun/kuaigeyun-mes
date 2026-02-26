"""
批号规则与序列号规则 API 模块

提供批号规则、序列号规则的 CRUD 接口。
用于基础数据-批号规则、序列号规则配置页面。

Author: RiverEdge Team
Date: 2026-02-26
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from core.services.business.batch_rule_service import BatchRuleService
from core.services.business.serial_rule_service import SerialRuleService
from apps.master_data.schemas.batch_serial_rule_schemas import (
    BatchRuleCreate, BatchRuleUpdate, BatchRuleResponse, BatchRuleListResponse,
    SerialRuleCreate, SerialRuleUpdate, SerialRuleResponse, SerialRuleListResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/materials", tags=["Batch & Serial Rules"])


# ==================== 批号规则 ====================

@router.post("/batch-rules", response_model=BatchRuleResponse, summary="创建批号规则")
async def create_batch_rule(
    data: BatchRuleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """创建批号规则"""
    try:
        rule = await BatchRuleService.create_rule(tenant_id, data.model_dump())
        return BatchRuleResponse.model_validate(rule)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/batch-rules", response_model=BatchRuleListResponse, summary="获取批号规则列表")
async def list_batch_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """获取批号规则列表"""
    rules, total = await BatchRuleService.list_rules(tenant_id, page, page_size, is_active)
    return BatchRuleListResponse(items=[BatchRuleResponse.model_validate(r) for r in rules], total=total)


@router.get("/batch-rules/{rule_uuid}", response_model=BatchRuleResponse, summary="获取批号规则详情")
async def get_batch_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """获取批号规则详情"""
    rule = await BatchRuleService.get_rule_by_uuid(tenant_id, rule_uuid)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="批号规则不存在")
    return BatchRuleResponse.model_validate(rule)


@router.put("/batch-rules/{rule_uuid}", response_model=BatchRuleResponse, summary="更新批号规则")
async def update_batch_rule(
    rule_uuid: str,
    data: BatchRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """更新批号规则"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        rule = await BatchRuleService.update_rule(tenant_id, rule_uuid, update_data)
        return BatchRuleResponse.model_validate(rule)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="批号规则不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/batch-rules/{rule_uuid}", summary="删除批号规则")
async def delete_batch_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """删除批号规则（软删除）"""
    try:
        await BatchRuleService.delete_rule(tenant_id, rule_uuid)
        return {"message": "删除成功"}
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="批号规则不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==================== 序列号规则 ====================

@router.post("/serial-rules", response_model=SerialRuleResponse, summary="创建序列号规则")
async def create_serial_rule(
    data: SerialRuleCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """创建序列号规则"""
    try:
        rule = await SerialRuleService.create_rule(tenant_id, data.model_dump())
        return SerialRuleResponse.model_validate(rule)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/serial-rules", response_model=SerialRuleListResponse, summary="获取序列号规则列表")
async def list_serial_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    tenant_id: Annotated[int, Depends(get_current_tenant)] = None,
):
    """获取序列号规则列表"""
    rules, total = await SerialRuleService.list_rules(tenant_id, page, page_size, is_active)
    return SerialRuleListResponse(items=[SerialRuleResponse.model_validate(r) for r in rules], total=total)


@router.get("/serial-rules/{rule_uuid}", response_model=SerialRuleResponse, summary="获取序列号规则详情")
async def get_serial_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """获取序列号规则详情"""
    rule = await SerialRuleService.get_rule_by_uuid(tenant_id, rule_uuid)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="序列号规则不存在")
    return SerialRuleResponse.model_validate(rule)


@router.put("/serial-rules/{rule_uuid}", response_model=SerialRuleResponse, summary="更新序列号规则")
async def update_serial_rule(
    rule_uuid: str,
    data: SerialRuleUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """更新序列号规则"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        rule = await SerialRuleService.update_rule(tenant_id, rule_uuid, update_data)
        return SerialRuleResponse.model_validate(rule)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="序列号规则不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/serial-rules/{rule_uuid}", summary="删除序列号规则")
async def delete_serial_rule(
    rule_uuid: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
):
    """删除序列号规则（软删除）"""
    try:
        await SerialRuleService.delete_rule(tenant_id, rule_uuid)
        return {"message": "删除成功"}
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="序列号规则不存在")
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
