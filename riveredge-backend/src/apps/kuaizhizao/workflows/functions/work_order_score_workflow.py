"""
工单综合打分定时/事件重算工作流
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from loguru import logger

from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
from core.tasks.dispatcher import TaskEvent, dispatch_event
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id


async def run_work_order_score_scheduler() -> Dict[str, Any]:
    now = datetime.now()
    try:
        await dispatch_event(
            TaskEvent(name="work-order/score-recalc-all", data={"timestamp": now.isoformat()})
        )
        logger.info(f"已发送工单打分重算事件: {now.isoformat()}")
        return {"success": True, "timestamp": now.isoformat()}
    except Exception as e:
        logger.error(f"工单打分调度器执行失败: {e}")
        return {"success": False, "error": str(e)}


@workflow_client.create_function(
    fn_id="work-order-score-recalc-worker",
    name="工单综合打分批量重算",
    trigger=TriggerEvent(event="work-order/score-recalc-all"),
    retries=2,
)
@with_tenant_isolation
async def work_order_score_recalc_worker(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    service = WorkOrderScoreService()
    result = await service.batch_refresh(
        tenant_id=tenant_id,
        work_order_ids=None,
        scenarios=["scheduling", "picking"],
        include_kitting=False,
    )
    logger.info(f"租户 {tenant_id} 工单打分批量重算完成: {result}")
    return {"tenant_id": tenant_id, **result}


@workflow_client.create_function(
    fn_id="work-order-score-recalc-one",
    name="工单综合打分单条重算",
    trigger=TriggerEvent(event="work-order/score-recalc-one"),
    retries=2,
)
@with_tenant_isolation
async def work_order_score_recalc_one(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    work_order_id = data.get("work_order_id")
    scenarios: Optional[List[str]] = data.get("scenarios")
    if not work_order_id:
        return {"success": False, "error": "work_order_id required"}
    service = WorkOrderScoreService()
    scores = await service.refresh_work_order(
        tenant_id=tenant_id,
        work_order_id=int(work_order_id),
        scenarios=scenarios,
        include_kitting=bool(data.get("include_kitting", True)),
    )
    return {
        "success": True,
        "tenant_id": tenant_id,
        "work_order_id": work_order_id,
        "refreshed": len(scores),
    }


async def dispatch_work_order_score_recalc(
    work_order_id: int,
    scenarios: Optional[List[str]] = None,
    include_kitting: bool = True,
) -> None:
    """事件驱动：单工单打分重算（失败不阻断主流程）。"""
    try:
        await dispatch_event(
            TaskEvent(
                name="work-order/score-recalc-one",
                data={
                    "work_order_id": work_order_id,
                    "scenarios": scenarios,
                    "include_kitting": include_kitting,
                },
            )
        )
    except Exception as e:
        logger.warning(f"投递工单 {work_order_id} 打分重算事件失败: {e}")
