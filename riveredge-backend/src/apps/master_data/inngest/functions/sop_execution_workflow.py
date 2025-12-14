"""
SOP 执行流程 Inngest 工作流函数

处理 SOP 执行流程的工作流执行，包括流程启动、节点流转、表单填写等。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger

from core.inngest.client import inngest_client
from apps.master_data.models.process import SOP, SOPExecution
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="sop-execution-workflow",
    name="SOP执行流程工作流",
    trigger=TriggerEvent(event="sop/start"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def sop_execution_workflow_function(event: Event) -> Dict[str, Any]:
    """
    SOP 执行流程工作流函数
    
    监听 sop/start 事件，启动 SOP 执行流程工作流。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    execution_id = data.get("execution_id")
    inngest_run_id = getattr(event, "id", None)
    
    if not execution_id:
        return {
            "success": False,
            "error": "缺少必要参数：execution_id"
        }
    
    try:
        # 获取执行实例
        execution = await SOPExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_id,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            return {
                "success": False,
                "error": f"SOP执行实例不存在: {execution_id}"
            }
        
        # 获取 SOP
        sop = await execution.sop
        if not sop:
            return {
                "success": False,
                "error": "关联的SOP不存在"
            }
        
        # 更新执行实例的 Inngest run_id
        if inngest_run_id:
            execution.inngest_run_id = str(inngest_run_id)
            await execution.save()
        
        # 解析流程配置
        flow_config = sop.flow_config or {}
        nodes = flow_config.get("nodes", [])
        edges = flow_config.get("edges", [])
        
        # 获取起始节点
        start_node = _get_start_node(nodes)
        if not start_node:
            return {
                "success": False,
                "error": "SOP流程没有起始节点"
            }
        
        # 设置当前节点和状态
        execution.current_node_id = start_node.get("id")
        execution.status = "running"
        await execution.save()
        
        logger.info(f"SOP执行流程工作流启动: {execution_id}, 当前节点: {start_node.get('id')}")
        
        return {
            "success": True,
            "execution_id": execution_id,
            "current_node_id": start_node.get("id"),
            "status": execution.status
        }
    except NotFoundError as e:
        logger.error(f"SOP执行流程工作流失败: {execution_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"SOP执行流程工作流失败: {execution_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="sop-node-complete-workflow",
    name="SOP节点完成工作流",
    trigger=TriggerEvent(event="sop/node/complete"),
    retries=3,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def sop_node_complete_workflow_function(event: Event) -> Dict[str, Any]:
    """
    SOP 节点完成工作流函数
    
    监听 sop/node/complete 事件，处理节点完成后的流转逻辑。
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    execution_id = data.get("execution_id")
    node_id = data.get("node_id")
    form_data = data.get("form_data", {})
    
    if not execution_id or not node_id:
        return {
            "success": False,
            "error": "缺少必要参数：execution_id 或 node_id"
        }
    
    try:
        # 获取执行实例
        execution = await SOPExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_id,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            return {
                "success": False,
                "error": f"SOP执行实例不存在: {execution_id}"
            }
        
        # 获取 SOP
        sop = await execution.sop
        if not sop:
            return {
                "success": False,
                "error": "关联的SOP不存在"
            }
        
        # 保存节点数据
        node_data = execution.node_data or {}
        node_data[node_id] = {
            "form_data": form_data,
            "completed_at": datetime.now().isoformat(),
        }
        execution.node_data = node_data
        await execution.save()
        
        # 解析流程配置
        flow_config = sop.flow_config or {}
        nodes = flow_config.get("nodes", [])
        edges = flow_config.get("edges", [])
        
        # 获取下一个节点
        next_node = _get_next_node(nodes, edges, node_id)
        
        if next_node:
            # 进入下一个节点
            execution.current_node_id = next_node.get("id")
            execution.status = "running"
            await execution.save()
            
            logger.info(f"SOP节点完成，进入下一个节点: {execution_id}, 当前节点: {next_node.get('id')}")
            
            return {
                "success": True,
                "execution_id": execution_id,
                "current_node_id": next_node.get("id"),
                "status": execution.status,
                "has_next": True
            }
        else:
            # 没有下一个节点，流程完成
            execution.current_node_id = None
            execution.status = "completed"
            execution.completed_at = datetime.now()
            await execution.save()
            
            logger.info(f"SOP执行流程完成: {execution_id}")
            
            return {
                "success": True,
                "execution_id": execution_id,
                "status": execution.status,
                "has_next": False
            }
    except NotFoundError as e:
        logger.error(f"SOP节点完成工作流失败: {execution_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"SOP节点完成工作流失败: {execution_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def _get_start_node(nodes: list) -> Optional[Dict[str, Any]]:
    """
    获取起始节点
    
    Args:
        nodes: 流程节点列表
        
    Returns:
        Optional[Dict[str, Any]]: 起始节点配置，如果没有则返回 None
    """
    if not nodes:
        return None
    
    # 查找类型为 "start" 的节点
    for node in nodes:
        node_type = node.get("type")
        node_data = node.get("data", {})
        if node_type == "start" or node_data.get("type") == "start":
            return node
    
    # 如果没有找到起始节点，返回第一个节点
    if nodes:
        return nodes[0]
    
    return None


def _get_next_node(nodes: list, edges: list, current_node_id: str) -> Optional[Dict[str, Any]]:
    """
    获取下一个节点
    
    Args:
        nodes: 流程节点列表
        edges: 流程边列表
        current_node_id: 当前节点ID
        
    Returns:
        Optional[Dict[str, Any]]: 下一个节点配置，如果没有则返回 None
    """
    if not nodes or not edges or not current_node_id:
        return None
    
    # 查找从当前节点出发的边
    for edge in edges:
        if edge.get("source") == current_node_id:
            next_node_id = edge.get("target")
            # 查找目标节点
            for node in nodes:
                node_id = node.get("id")
                if node_id == next_node_id:
                    # 跳过结束节点（结束节点不需要执行）
                    node_type = node.get("type")
                    node_data = node.get("data", {})
                    if node_type == "end" or node_data.get("type") == "end":
                        return None
                    return node
    
    return None

