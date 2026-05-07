"""
SOP 执行流程工作流函数。
"""

from datetime import datetime
from typing import Any, Dict, Optional

from loguru import logger

from apps.master_data.models.process import SOPExecution
from core.tasks.event_compat import Event, TriggerEvent
from core.utils.workflow_tenant_isolation import with_tenant_isolation
from core.workflows.client import workflow_client
from infra.domain.tenant_context import get_current_tenant_id
from infra.exceptions.exceptions import NotFoundError


@workflow_client.create_function(
    fn_id="sop-execution-workflow",
    name="SOP执行流程工作流",
    trigger=TriggerEvent(event="sop/start"),
    retries=3,
)
@with_tenant_isolation
async def sop_execution_workflow_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    execution_id = data.get("execution_id")
    inngest_run_id = getattr(event, "id", None)
    if not execution_id:
        return {"success": False, "error": "缺少必要参数：execution_id"}
    try:
        execution = await SOPExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_id,
            deleted_at__isnull=True,
        ).first()
        if not execution:
            return {"success": False, "error": f"SOP执行实例不存在: {execution_id}"}
        sop = await execution.sop
        if not sop:
            return {"success": False, "error": "关联的SOP不存在"}
        if inngest_run_id:
            execution.inngest_run_id = str(inngest_run_id)
            await execution.save()
        flow_config = sop.flow_config or {}
        nodes = flow_config.get("nodes", [])
        start_node = _get_start_node(nodes)
        if not start_node:
            return {"success": False, "error": "SOP流程没有起始节点"}
        execution.current_node_id = start_node.get("id")
        execution.status = "running"
        await execution.save()
        logger.info(f"SOP执行流程工作流启动: {execution_id}, 当前节点: {start_node.get('id')}")
        return {
            "success": True,
            "execution_id": execution_id,
            "current_node_id": start_node.get("id"),
            "status": execution.status,
        }
    except NotFoundError as e:
        logger.error(f"SOP执行流程工作流失败: {execution_id}, 错误: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"SOP执行流程工作流失败: {execution_id}, 错误: {e}")
        return {"success": False, "error": str(e)}


@workflow_client.create_function(
    fn_id="sop-node-complete-workflow",
    name="SOP节点完成工作流",
    trigger=TriggerEvent(event="sop/node/complete"),
    retries=3,
)
@with_tenant_isolation
async def sop_node_complete_workflow_function(event: Event) -> Dict[str, Any]:
    tenant_id = get_current_tenant_id()
    data = event.data or {}
    execution_id = data.get("execution_id")
    node_id = data.get("node_id")
    form_data = data.get("form_data", {})
    if not execution_id or not node_id:
        return {"success": False, "error": "缺少必要参数：execution_id 或 node_id"}
    try:
        execution = await SOPExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_id,
            deleted_at__isnull=True,
        ).first()
        if not execution:
            return {"success": False, "error": f"SOP执行实例不存在: {execution_id}"}
        sop = await execution.sop
        if not sop:
            return {"success": False, "error": "关联的SOP不存在"}
        node_data = execution.node_data or {}
        node_data[node_id] = {"form_data": form_data, "completed_at": datetime.now().isoformat()}
        execution.node_data = node_data
        await execution.save()
        flow_config = sop.flow_config or {}
        nodes = flow_config.get("nodes", [])
        edges = flow_config.get("edges", [])
        next_node = _get_next_node(nodes, edges, node_id)
        if next_node:
            execution.current_node_id = next_node.get("id")
            execution.status = "running"
            await execution.save()
            logger.info(f"SOP节点完成，进入下一个节点: {execution_id}, 当前节点: {next_node.get('id')}")
            return {
                "success": True,
                "execution_id": execution_id,
                "current_node_id": next_node.get("id"),
                "status": execution.status,
                "has_next": True,
            }
        execution.current_node_id = None
        execution.status = "completed"
        execution.completed_at = datetime.now()
        await execution.save()
        logger.info(f"SOP执行流程完成: {execution_id}")
        return {"success": True, "execution_id": execution_id, "status": execution.status, "has_next": False}
    except NotFoundError as e:
        logger.error(f"SOP节点完成工作流失败: {execution_id}, 错误: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        logger.error(f"SOP节点完成工作流失败: {execution_id}, 错误: {e}")
        return {"success": False, "error": str(e)}


def _get_start_node(nodes: list) -> Optional[Dict[str, Any]]:
    if not nodes:
        return None
    for node in nodes:
        node_type = node.get("type")
        node_data = node.get("data", {})
        if node_type == "start" or node_data.get("type") == "start":
            return node
    return nodes[0] if nodes else None


def _get_next_node(nodes: list, edges: list, current_node_id: str) -> Optional[Dict[str, Any]]:
    if not nodes or not edges or not current_node_id:
        return None
    for edge in edges:
        if edge.get("source") == current_node_id:
            next_node_id = edge.get("target")
            for node in nodes:
                if node.get("id") == next_node_id:
                    node_type = node.get("type")
                    node_data = node.get("data", {})
                    if node_type == "end" or node_data.get("type") == "end":
                        return None
                    return node
    return None

