"""
统一需求计算管理 API 路由模块

提供统一需求计算相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status
from loguru import logger

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
)

router = APIRouter(prefix="/demand-computations", tags=["统一需求计算管理"])

computation_service = DemandComputationService()


@router.post("", response_model=DemandComputationResponse, summary="创建需求计算")
async def create_computation(
    computation_data: DemandComputationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建需求计算
    
    支持创建MRP或LRP类型的需求计算。
    """
    try:
        return await computation_service.create_computation(
            tenant_id=tenant_id,
            computation_data=computation_data,
            created_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"创建需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="创建需求计算失败")


@router.get("", summary="获取需求计算列表")
async def list_computations(
    demand_id: Optional[int] = Query(None, description="需求ID"),
    demand_code: Optional[str] = Query(None, description="需求编码"),
    computation_code: Optional[str] = Query(None, description="计算编码"),
    computation_type: Optional[str] = Query(None, description="计算类型（MRP/LRP）"),
    computation_status: Optional[str] = Query(None, description="计算状态"),
    business_mode: Optional[str] = Query(None, description="业务模式（MTS/MTO）"),
    start_date: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    end_date: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算列表
    
    支持按需求ID、需求编码、计算编码、计算类型、计算状态、业务模式、时间范围筛选。
    """
    # #region agent log
    try:
        with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write('{"location":"demand_computation.py:list_computations","message":"api_entry","data":{"tenant_id":%s,"tenant_type":"%s"},"timestamp":%d,"sessionId":"debug-session","hypothesisId":"H2"}\n' % (repr(tenant_id), type(tenant_id).__name__, __import__("time").time() * 1000))
    except Exception:
        pass
    # #endregion
    try:
        return await computation_service.list_computations(
            tenant_id=tenant_id,
            demand_id=demand_id,
            demand_code=demand_code,
            computation_code=computation_code,
            computation_type=computation_type,
            computation_status=computation_status,
            business_mode=business_mode,
            start_date=start_date,
            end_date=end_date,
            skip=skip,
            limit=limit
        )
    except Exception as e:
        # #region agent log
        try:
            with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write('{"location":"demand_computation.py:list_computations","message":"api_exception","data":{"exc_type":"%s","exc_msg":"%s"},"timestamp":%d,"sessionId":"debug-session","hypothesisId":"H1,H3,H4,H5"}\n' % (type(e).__name__, str(e).replace('"', "'").replace("\\", "/")[:500], __import__("time").time() * 1000))
        except Exception:
            pass
        # #endregion
        logger.error(f"获取需求计算列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求计算列表失败")


@router.get("/{computation_id}", response_model=DemandComputationResponse, summary="获取需求计算详情")
async def get_computation(
    computation_id: int = Path(..., description="计算ID"),
    include_items: bool = Query(True, description="是否包含明细"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算详情
    
    可以指定是否包含计算结果明细。
    """
    try:
        return await computation_service.get_computation_by_id(
            tenant_id=tenant_id,
            computation_id=computation_id,
            include_items=include_items
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取需求计算详情失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求计算详情失败")


@router.post("/{computation_id}/execute", response_model=DemandComputationResponse, summary="执行需求计算")
async def execute_computation(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行需求计算
    
    执行MRP或LRP计算逻辑，生成计算结果。
    """
    try:
        return await computation_service.execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # #region agent log
        logger.error(f"执行需求计算失败: {e}")
        # 开发阶段在响应中返回异常信息，便于排查（生产环境可改为固定文案）
        err_msg = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)
        # #endregion


@router.post("/{computation_id}/recompute", response_model=DemandComputationResponse, summary="重新计算")
async def recompute_computation(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    对已完成或失败的需求计算重新执行计算。
    会清空原计算结果明细后按原需求重新跑 MRP/LRP。
    """
    try:
        return await computation_service.recompute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"重新计算失败: {e}")
        err_msg = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)


@router.put("/{computation_id}", response_model=DemandComputationResponse, summary="更新需求计算")
async def update_computation(
    computation_id: int = Path(..., description="计算ID"),
    computation_data: DemandComputationUpdate = ...,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新需求计算
    
    可以更新计算状态、汇总结果、错误信息等。
    """
    try:
        return await computation_service.update_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            computation_data=computation_data,
            updated_by=current_user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"更新需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="更新需求计算失败")


@router.post("/{computation_id}/generate-orders", summary="一键生成工单和采购单")
async def generate_orders(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从需求计算结果一键生成工单和采购单
    
    根据计算结果明细中的建议工单数量和采购订单数量，自动生成工单和采购单。
    """
    try:
        result = await computation_service.generate_work_orders_and_purchase_orders(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=current_user.id
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("生成工单和采购单失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成工单和采购单失败: {str(e)}",
        )


@router.get("/history", summary="查询需求计算历史记录")
async def list_computation_history(
    demand_id: Optional[int] = Query(None, description="需求ID"),
    computation_type: Optional[str] = Query(None, description="计算类型（MRP/LRP）"),
    start_date: Optional[str] = Query(None, description="开始日期（YYYY-MM-DD）"),
    end_date: Optional[str] = Query(None, description="结束日期（YYYY-MM-DD）"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(20, ge=1, le=100, description="限制数量"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    查询需求计算历史记录
    
    支持按需求ID、计算类型、时间范围筛选。
    """
    try:
        from datetime import datetime
        from tortoise.expressions import Q
        
        query = DemandComputation.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        if demand_id:
            query = query.filter(demand_id=demand_id)
        if computation_type:
            query = query.filter(computation_type=computation_type)
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(computation_start_time__gte=start_dt)
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            query = query.filter(computation_start_time__lte=end_dt)
        
        total = await query.count()
        computations = await query.offset(skip).limit(limit).order_by('-computation_start_time')
        
        result = []
        for computation in computations:
            items = await DemandComputationItem.filter(
                tenant_id=tenant_id,
                computation_id=computation.id
            ).all()
            result.append(await computation_service._build_computation_response(computation, items))
        
        return {
            "data": [r.model_dump() for r in result],
            "total": total,
            "success": True
        }
    except Exception as e:
        logger.error(f"查询需求计算历史记录失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="查询需求计算历史记录失败")


@router.get("/compare", summary="对比两个需求计算结果")
async def compare_computations(
    computation_id1: int = Query(..., description="第一个计算ID"),
    computation_id2: int = Query(..., description="第二个计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    对比两个需求计算结果
    
    返回两个计算结果的差异分析，包括基本信息和明细项的差异。
    """
    try:
        result = await computation_service.compare_computations(
            tenant_id=tenant_id,
            computation_id1=computation_id1,
            computation_id2=computation_id2
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"对比需求计算结果失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="对比需求计算结果失败")


@router.get("/{computation_id}/material-sources", summary="获取需求计算的物料来源信息")
async def get_material_sources(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算的物料来源信息
    
    返回计算结果中所有物料的来源类型、配置信息和验证结果。
    """
    try:
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        material_sources = []
        for item in items:
            material_sources.append({
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "source_type": item.material_source_type,
                "source_config": item.material_source_config,
                "source_validation_passed": item.source_validation_passed,
                "source_validation_errors": item.source_validation_errors,
            })
        
        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "material_sources": material_sources,
            "total_count": len(material_sources),
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"获取物料来源信息失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取物料来源信息失败")


@router.post("/{computation_id}/validate-material-sources", summary="验证需求计算的物料来源配置")
async def validate_material_sources(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    验证需求计算的物料来源配置
    
    验证计算结果中所有物料的来源配置完整性，返回验证结果。
    """
    try:
        from apps.kuaizhizao.utils.material_source_helper import validate_material_source_config
        from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
        
        computation = await DemandComputation.get_or_none(tenant_id=tenant_id, id=computation_id)
        if not computation:
            raise NotFoundError(f"需求计算不存在: {computation_id}")
        
        items = await DemandComputationItem.filter(
            tenant_id=tenant_id,
            computation_id=computation_id
        ).all()
        
        validation_results = []
        all_passed = True
        
        for item in items:
            if not item.material_source_type:
                continue
            
            validation_passed, errors = await validate_material_source_config(
                tenant_id=tenant_id,
                material_id=item.material_id,
                source_type=item.material_source_type
            )
            
            validation_results.append({
                "material_id": item.material_id,
                "material_code": item.material_code,
                "material_name": item.material_name,
                "source_type": item.material_source_type,
                "validation_passed": validation_passed,
                "errors": errors,
            })
            
            if not validation_passed:
                all_passed = False
        
        return {
            "computation_id": computation_id,
            "computation_code": computation.computation_code,
            "all_passed": all_passed,
            "validation_results": validation_results,
            "total_count": len(validation_results),
            "passed_count": sum(1 for r in validation_results if r["validation_passed"]),
            "failed_count": sum(1 for r in validation_results if not r["validation_passed"]),
        }
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"验证物料来源配置失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="验证物料来源配置失败")
