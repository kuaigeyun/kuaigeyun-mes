"""
销售漏斗 API 模块

提供销售漏斗的 RESTful API 接口，支持多组织隔离。
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, Annotated

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.kuaicrm.services.sales_funnel_service import SalesFunnelService
from infra.exceptions.exceptions import NotFoundError

router = APIRouter(prefix="/funnel", tags=["Sales Funnel"])


@router.get("/view", summary="获取销售漏斗视图")
async def get_funnel_view(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    owner_id: Optional[int] = Query(None, description="负责人（过滤）"),
    customer_id: Optional[int] = Query(None, description="客户ID（过滤）")
):
    """
    获取销售漏斗视图
    
    - **owner_id**: 负责人（可选，用于过滤）
    - **customer_id**: 客户ID（可选，用于过滤）
    
    返回各阶段商机数量、金额、转化率
    """
    return await SalesFunnelService.get_funnel_view(tenant_id, owner_id, customer_id)


@router.get("/stages/{stage}", summary="分析阶段数据")
async def analyze_stage(
    stage: str,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    owner_id: Optional[int] = Query(None, description="负责人（过滤）")
):
    """
    分析阶段数据
    
    - **stage**: 商机阶段（初步接触、需求确认、方案报价、商务谈判、成交）
    - **owner_id**: 负责人（可选，用于过滤）
    
    返回阶段统计信息（数量、金额、平均金额、平均概率）
    """
    return await SalesFunnelService.analyze_stage(tenant_id, stage, owner_id)


@router.get("/conversion", summary="计算转化率")
async def calculate_conversion_rate(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    from_stage: str = Query(..., description="起始阶段"),
    to_stage: str = Query(..., description="目标阶段"),
    owner_id: Optional[int] = Query(None, description="负责人（过滤）")
):
    """
    计算转化率
    
    - **from_stage**: 起始阶段
    - **to_stage**: 目标阶段
    - **owner_id**: 负责人（可选，用于过滤）
    
    返回转化率（0-100）
    """
    rate = await SalesFunnelService.calculate_conversion_rate(tenant_id, from_stage, to_stage, owner_id)
    return {"from_stage": from_stage, "to_stage": to_stage, "conversion_rate": rate}


@router.get("/forecast", summary="销售预测")
async def forecast_sales(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    owner_id: Optional[int] = Query(None, description="负责人（过滤）"),
    forecast_period: str = Query("month", description="预测周期（week, month, quarter, year）")
):
    """
    销售预测
    
    - **owner_id**: 负责人（可选，用于过滤）
    - **forecast_period**: 预测周期（默认：month）
    
    基于商机阶段、成交概率、历史数据预测销售
    """
    return await SalesFunnelService.forecast_sales(tenant_id, owner_id, forecast_period)


@router.get("/bottleneck", summary="分析瓶颈阶段")
async def analyze_bottleneck(
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    owner_id: Optional[int] = Query(None, description="负责人（过滤）")
):
    """
    分析瓶颈阶段
    
    - **owner_id**: 负责人（可选，用于过滤）
    
    识别各阶段停留时间，找出瓶颈阶段
    """
    return await SalesFunnelService.analyze_bottleneck(tenant_id, owner_id)
