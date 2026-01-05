"""
期初数据导入 API 路由模块

提供期初数据导入的API接口，包括期初库存、在制品、应收应付的导入。

Author: Luigi Lu
Date: 2026-01-15
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status, HTTPException
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import ValidationError

from apps.kuaizhizao.services.initial_data_service import InitialDataService

router = APIRouter(prefix="/initial-data", tags=["Initial Data Import"])

# 初始化服务实例
initial_data_service = InitialDataService()


@router.post("/inventory/import", summary="导入期初库存")
async def import_initial_inventory(
    data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
    snapshot_time: Optional[datetime] = Query(None, description="快照时间点（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导入期初库存
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建期初库存入库单。
    数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
    
    **表头字段（支持中英文）：**
    - 物料编码（必填，支持部门编码，自动映射到主编码）
    - 仓库编码（必填）
    - 期初数量（必填）
    - 期初金额（可选）
    - 批次号（可选）
    - 库位编码（可选）
    
    Args:
        data: 二维数组数据（从 uni_import 组件传递）
        snapshot_time: 快照时间点（可选，用于标记期初数据的时间点）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 导入结果（成功数、失败数、错误列表）
        
    Raises:
        HTTPException: 当数据格式错误或导入失败时抛出
    """
    try:
        result = await initial_data_service.import_initial_inventory(
            tenant_id=tenant_id,
            data=data,
            snapshot_time=snapshot_time,
            created_by=current_user.id
        )
        return result
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入期初库存失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )


@router.post("/wip/import", summary="导入期初在制品")
async def import_initial_wip(
    data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
    snapshot_time: Optional[datetime] = Query(None, description="快照时间点（可选）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    导入期初在制品
    
    接收前端 uni_import 组件传递的二维数组数据，批量创建期初在制品工单。
    数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
    
    **表头字段（支持中英文）：**
    - 工单号（可选，如果不提供则自动生成）
    - 产品编码（必填，支持部门编码，自动映射到主编码）
    - 当前工序（必填）
    - 在制品数量（必填）
    - 已投入数量（可选）
    - 预计完成时间（可选）
    - 车间编码（可选）
    
    Args:
        data: 二维数组数据（从 uni_import 组件传递）
        snapshot_time: 快照时间点（可选，用于标记期初数据的时间点）
        current_user: 当前用户（依赖注入）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        dict: 导入结果（成功数、失败数、错误列表）
        
    Raises:
        HTTPException: 当数据格式错误或导入失败时抛出
    """
    try:
        result = await initial_data_service.import_initial_wip(
            tenant_id=tenant_id,
            data=data,
            snapshot_time=snapshot_time,
            created_by=current_user.id
        )
        return result
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"导入期初在制品失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导入失败: {str(e)}"
        )

