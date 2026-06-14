"""
统一需求计算管理 API 路由模块

提供统一需求计算相关的API接口。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Path, Body, HTTPException, status
from loguru import logger
from tortoise.expressions import Q

from core.api.deps import get_current_user, get_current_tenant
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from apps.kuaizhizao.services.demand_change_event_service import DemandChangeEventService
from apps.kuaizhizao.services.demand_replanning_orchestrator_service import DemandReplanningOrchestratorService
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.schemas.demand_computation import (
    DemandComputationCreate,
    DemandComputationUpdate,
    DemandComputationResponse,
    ExecuteComputationRequest,
)
from apps.kuaizhizao.schemas.demand_replanning import (
    DemandChangeEventCreateRequest,
    DemandReplanTaskExecuteRequest,
)

router = APIRouter(prefix="/demand-computations", tags=["App · Kuaige Zhizao · Unified Demand Computation"])

computation_service = DemandComputationService()
change_event_service = DemandChangeEventService()
replan_orchestrator = DemandReplanningOrchestratorService()


@router.post("", response_model=DemandComputationResponse, summary="Create demand computation")
async def create_computation(
    computation_data: DemandComputationCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    创建需求计算
    
    创建统一需求计算（类型恒为 MRP；MTS/MTO 由关联需求的 business_mode 决定）。
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


@router.get("/statistics", summary="Demand computation statistics (KPI cards)")
async def get_demand_computation_statistics(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    返回需求计算各维度数量，用于列表页指标卡片。
    """
    base = DemandComputation.filter(tenant_id=tenant_id)
    try:
        total_count = await base.count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics total_count: {e}")
        total_count = 0
    try:
        mts_count = await base.filter(business_mode="MTS").count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics mts_count: {e}")
        mts_count = 0
    try:
        mto_count = await base.filter(business_mode="MTO").count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics mto_count: {e}")
        mto_count = 0
    try:
        pending_count = await base.filter(computation_status__in=["进行中", "pending", "running"]).count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics pending_count: {e}")
        pending_count = 0
    try:
        completed_count = await base.filter(computation_status__in=["完成", "completed", "success"]).count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics completed_count: {e}")
        completed_count = 0

    try:
        # 统计含有缺料或交期风险的计算数
        risk_count = await base.filter(
            Q(computation_summary__contains={"shortage_count": 0}, _negated=True) | 
            Q(computation_summary__contains={"risk_count": 0}, _negated=True)
        ).count()
    except Exception as e:
        logger.warning(f"demand-computation-statistics risk_count: {e}")
        risk_count = 0

    return {
        "total_count": total_count,
        "mts_count": mts_count,
        "mto_count": mto_count,
        "mrp_count": mts_count,
        "lrp_count": mto_count,
        "pending_count": pending_count,
        "completed_count": completed_count,
        "risk_count": risk_count,
    }


@router.get("", summary="List demand computations")
async def list_computations(
    demand_id: Optional[int] = Query(None, description="需求ID"),
    demand_code: Optional[str] = Query(None, description="需求编码"),
    computation_code: Optional[str] = Query(None, description="计算编码"),
    computation_type: Optional[str] = Query(
        None,
        description="兼容筛选：MRP≈MTS、LRP≈MTO（新数据 computation_type 均为 MRP）",
    ),
    computation_status: Optional[str] = Query(None, description="计算状态"),
    business_mode: Optional[str] = Query(None, description="业务模式（MTS/MTO/ATO）"),
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
        logger.error(f"获取需求计算列表失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取需求计算列表失败")


@router.get("/{computation_id:int}", response_model=DemandComputationResponse, summary="Get demand computation")
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


@router.post("/{computation_id:int}/execute/preview", summary="Preview computation run")
async def preview_execute_computation(
    computation_id: int = Path(..., description="计算ID"),
    body: Optional[ExecuteComputationRequest] = Body(None, description="可选临时覆盖参数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    预览执行计算结果，不持久化。
    用于二次确认前展示预计生成的计算明细。
    """
    try:
        computation_params_override = body.computation_params if body else None
        return await computation_service.preview_execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            computation_params_override=computation_params_override
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"执行计算预览失败: {e}")
        err_msg = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)


@router.post("/{computation_id:int}/execute", response_model=DemandComputationResponse, summary="Run demand computation")
async def execute_computation(
    computation_id: int = Path(..., description="计算ID"),
    body: Optional[ExecuteComputationRequest] = Body(None, description="可选临时覆盖参数"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    执行需求计算
    
    执行MRP或LRP计算逻辑，生成计算结果。
    可选传入 computation_params 临时覆盖参数，仅本次执行生效。
    """
    try:
        computation_params_override = body.computation_params if body else None
        return await computation_service.execute_computation(
            tenant_id=tenant_id,
            computation_id=computation_id,
            computation_params_override=computation_params_override
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"执行需求计算失败: {e}")
        # 开发阶段在响应中返回异常信息，便于排查（生产环境可改为固定文案）
        err_msg = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)


@router.post("/{computation_id:int}/recompute", response_model=DemandComputationResponse, summary="Recompute")
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
            operator_id=current_user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"重新计算失败: {e}")
        err_msg = f"{type(e).__name__}: {str(e)}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=err_msg)


@router.post("/change-events", summary="Create demand change event and analyze impact")
async def create_change_event(
    body: DemandChangeEventCreateRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """创建需求变更事件，自动执行影响分析并可选创建重算任务。"""
    try:
        return await change_event_service.create_event(
            tenant_id=tenant_id,
            event_type=body.event_type,
            source_type=body.source_type,
            source_id=body.source_id,
            source_code=body.source_code,
            source_name=body.source_name,
            changed_fields=body.changed_fields,
            payload=body.payload,
            effective_at=body.effective_at,
            trigger_reason=body.trigger_reason,
            requested_by=current_user.id,
            correlation_id=body.correlation_id,
            auto_create_task=body.auto_create_task,
        )
    except Exception as e:
        logger.exception("创建需求变更事件失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/change-events/pending", summary="List pending demand change events")
async def list_pending_change_events(
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await change_event_service.list_pending_events(tenant_id=tenant_id, limit=limit)


@router.get("/change-events/{event_id}/impact", summary="Get change impact details")
async def get_change_impact(
    event_id: int = Path(..., description="事件ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await change_event_service.get_event_impact(tenant_id=tenant_id, event_id=event_id)


@router.post("/replan-tasks/{task_id}/execute", summary="Execute replan task")
async def execute_replan_task(
    task_id: int = Path(..., description="重算任务ID"),
    body: Optional[DemandReplanTaskExecuteRequest] = Body(None),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    try:
        req = body or DemandReplanTaskExecuteRequest()
        return await replan_orchestrator.execute_task(
            tenant_id=tenant_id,
            task_id=task_id,
            operator_id=current_user.id,
            force=req.force,
            approval_comment=req.approval_comment,
        )
    except (NotFoundError, BusinessLogicError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("执行重算任务失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/replan-dashboard", summary="Demand replan dashboard")
async def get_replan_dashboard(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await change_event_service.get_dashboard(tenant_id=tenant_id)


@router.get("/replan-tasks", summary="List replan tasks")
async def list_replan_tasks(
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    return await change_event_service.list_replan_tasks(tenant_id=tenant_id, limit=limit)


@router.get("/{computation_id:int}/recalc-history", summary="Demand computation recalc history")
async def get_computation_recalc_history(
    computation_id: int = Path(..., description="计算ID"),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取需求计算重算历史列表。"""
    try:
        return await computation_service.list_computation_recalc_history(
            tenant_id=tenant_id, computation_id=computation_id, limit=limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{computation_id:int}/snapshots", summary="List demand computation snapshots")
async def get_computation_snapshots(
    computation_id: int = Path(..., description="计算ID"),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取需求计算快照列表。"""
    try:
        return await computation_service.list_computation_snapshots(
            tenant_id=tenant_id, computation_id=computation_id, limit=limit
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/{computation_id:int}/snapshots/{snapshot_id:int}",
    summary="Get demand computation snapshot",
)
async def get_computation_snapshot_one(
    computation_id: int = Path(..., description="计算ID"),
    snapshot_id: int = Path(..., description="快照ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取指定快照详情（用于重算历史按需查看）。"""
    try:
        return await computation_service.get_computation_snapshot_by_id(
            tenant_id=tenant_id, computation_id=computation_id, snapshot_id=snapshot_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{computation_id:int}/dynamic-monitor", summary="Demand computation change monitor")
async def get_dynamic_monitor(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算的动态变动监控。
    包括上游需求变更感应与下游执行进度追踪。
    """
    try:
        return await computation_service.get_computation_dynamic_monitor(
            tenant_id=tenant_id,
            computation_id=computation_id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("获取动态变动监控失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{computation_id:int}/push-records", summary="Demand computation push records")
async def get_push_records(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取需求计算的下推记录。
    返回从该需求计算下推出去的单据列表，包含目标单据是否仍存在的标识（已删除的单据 target_exists=False）。
    """
    try:
        return await computation_service.get_push_records(
            tenant_id=tenant_id,
            computation_id=computation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.exception("获取下推记录失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="获取下推记录失败")


@router.delete("/{computation_id:int}", summary="Delete demand computation")
async def delete_computation(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除需求计算

    仅当需求计算尚未下推工单/采购单/生产计划/采购申请等下游单据时允许删除。
    删除后会同步清除关联需求的计算状态，需求可重新下推计算。
    """
    try:
        await computation_service.delete_computation(
            tenant_id=tenant_id,
            computation_id=computation_id
        )
        return {"success": True, "message": "删除成功"}
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"删除需求计算失败: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除需求计算失败")


@router.put("/{computation_id:int}", response_model=DemandComputationResponse, summary="Update demand computation")
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


@router.post("/{computation_id:int}/generate-orders", summary="Generate work orders and POs (one click)")
async def generate_orders(
    computation_id: int = Path(..., description="计算ID"),
    generate_mode: str = Query("all", description="生成粒度：all=全部，work_order_only=仅工单，purchase_only=仅采购，outsource_only=仅委外工单"),
    allow_draft: bool = Query(False, description="兼容：True 时等价于 push_mode=draft"),
    push_mode: Optional[str] = Query(None, description="下推模式：draft=草稿，confirm=正式；缺省读组织配置"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    从需求计算结果一键生成工单和采购单
    
    generate_mode: all=全部，work_order_only=仅工单，purchase_only=仅采购
    allow_draft: 验证失败时是否仍生成草稿单
    """
    # #region agent log
    try:
        with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
            _f.write(__import__("json").dumps({"location": "demand_computations.py:generate_orders", "message": "api_entry", "data": {"computation_id": computation_id, "generate_mode": generate_mode}, "hypothesisId": "D"}) + "\n")
    except Exception:
        pass
    # #endregion
    try:
        result = await computation_service.generate_work_orders_and_purchase_orders(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=current_user.id,
            generate_mode=generate_mode,
            allow_draft=allow_draft,
            push_mode=push_mode,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        # #region agent log
        try:
            with open(r"f:\dev\riveredge\.cursor\debug.log", "a", encoding="utf-8") as _f:
                _f.write(__import__("json").dumps({"location": "demand_computations.py:generate_orders", "message": "api_exception", "data": {"error": str(e), "type": type(e).__name__}, "hypothesisId": "C"}) + "\n")
        except Exception:
            pass
        # #endregion
        logger.exception("生成工单和采购单失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成工单和采购单失败: {str(e)}",
        )


@router.get("/{computation_id:int}/push-options", summary="Get push capabilities and config")
async def get_push_options(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取需求计算的下推能力与一键下推默认配置，供前端弹窗预填"""
    try:
        return await computation_service.get_push_options(
            tenant_id=tenant_id,
            computation_id=computation_id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("获取下推能力失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{computation_id:int}/push-preview", summary="Preview push targets")
async def get_push_preview(
    computation_id: int = Path(..., description="计算ID"),
    production: Optional[str] = Query(None, description="生产路径：plan|work_order"),
    purchase: Optional[str] = Query(None, description="采购路径：requisition|purchase_order"),
    outsource_only: bool = Query(False, description="仅委外工单预览"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取下推预览（不实际执行），用于下推前展示将生成的单据数量"""
    try:
        push_config = {}
        if production:
            push_config["production"] = production
        if purchase:
            push_config["purchase"] = purchase
        if outsource_only:
            push_config["outsource_only"] = True
        return await computation_service.get_push_preview(
            tenant_id=tenant_id,
            computation_id=computation_id,
            push_config=push_config if push_config else None,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("获取下推预览失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{computation_id:int}/push-all", summary="Push all (one click)")
async def push_all(
    computation_id: int = Path(..., description="计算ID"),
    body: Optional[Dict[str, Any]] = Body(default=None, description="配置：production, purchase, include_outsource"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """一键下推：按配置执行生产计划/工单、采购申请/采购单、委外工单"""
    try:
        b = body or {}
        return await computation_service.push_all(
            tenant_id=tenant_id,
            computation_id=computation_id,
            created_by=current_user.id,
            production=b.get("production"),
            purchase=b.get("purchase"),
            include_outsource=b.get("include_outsource", True),
            push_mode=b.get("push_mode"),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("一键下推失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{computation_id:int}/push-to-purchase-requisition", summary="Push to purchase requisition")
async def push_to_purchase_requisition(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """从需求计算下推到采购申请（仅采购件）"""
    try:
        from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
        service = DocumentPushPullService()
        result = await service.push_document(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            target_type="purchase_requisition",
            push_params=None,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("下推到采购申请失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推到采购申请失败")


@router.post("/{computation_id:int}/push-to-production-plan", summary="Push to production plan")
async def push_to_production_plan(
    computation_id: int = Path(..., description="计算ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """从需求计算下推到生产计划"""
    try:
        from apps.kuaizhizao.services.document_push_pull_service import DocumentPushPullService
        service = DocumentPushPullService()
        result = await service.push_document(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
            target_type="production_plan",
            push_params=None,
            created_by=current_user.id,
        )
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except BusinessLogicError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("下推到生产计划失败")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="下推到生产计划失败")


@router.get("/history", summary="List demand computation history")
async def list_computation_history(
    demand_id: Optional[int] = Query(None, description="需求ID"),
    computation_type: Optional[str] = Query(
        None,
        description="兼容筛选：MRP≈MTS、LRP≈MTO（新数据 computation_type 均为 MRP）",
    ),
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
            if computation_type == "LRP":
                query = query.filter(business_mode="MTO")
            elif computation_type == "MRP":
                query = query.filter(business_mode="MTS")
            else:
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


@router.get("/compare", summary="Compare two demand computations")
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


@router.get("/{computation_id:int}/material-sources", summary="Demand computation material sources")
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


@router.post("/{computation_id:int}/validate-material-sources", summary="Validate demand computation material sources")
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
