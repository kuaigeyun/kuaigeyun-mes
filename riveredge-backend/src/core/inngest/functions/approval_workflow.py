"""
审批流程 Inngest 工作流函数

处理审批流程的工作流执行，包括审批提交、审批操作、节点流转等。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from datetime import datetime
from loguru import logger

from core.inngest.client import inngest_client
from core.models.approval_instance import ApprovalInstance
from core.models.approval_process import ApprovalProcess
from core.services.approval_instance_service import ApprovalInstanceService
from infra.exceptions.exceptions import NotFoundError, ValidationError


@inngest_client.create_function(
    fn_id="approval-workflow",
    name="审批流程工作流",
    trigger=TriggerEvent(event="approval/submit"),
    retries=3,
)
async def approval_workflow_function(event: Event) -> Dict[str, Any]:
    """
    审批流程工作流函数
    
    监听 approval/submit 事件，启动审批流程工作流。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    approval_id = data.get("approval_id")
    process_id = data.get("process_id")
    inngest_run_id = getattr(event, "id", None)
    
    if not tenant_id or not approval_id or not process_id:
        return {
            "success": False,
            "error": "缺少必要参数：tenant_id、approval_id 或 process_id"
        }
    
    try:
        # 获取审批实例和流程
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(
            tenant_id, approval_id
        )
        
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=process_id,
            deleted_at__isnull=True
        ).first()
        
        if not process:
            return {
                "success": False,
                "error": f"审批流程不存在: {process_id}"
            }
        
        # 更新审批实例的 Inngest run_id
        if inngest_run_id:
            approval_instance.inngest_run_id = str(inngest_run_id)
            await approval_instance.save()
        
        # 解析流程节点配置
        nodes = process.nodes or {}
        config = process.config or {}
        
        # 获取起始节点
        start_node = _get_start_node(nodes)
        if not start_node:
            return {
                "success": False,
                "error": "审批流程没有起始节点"
            }
        
        # 设置当前节点和审批人
        approval_instance.current_node = start_node.get("id")
        approval_instance.current_approver_id = _get_node_approver(start_node, approval_instance)
        await approval_instance.save()
        
        logger.info(f"审批流程工作流启动: {approval_id}, 当前节点: {start_node.get('id')}")
        
        return {
            "success": True,
            "approval_id": approval_id,
            "current_node": start_node.get("id"),
            "current_approver_id": approval_instance.current_approver_id
        }
    except NotFoundError as e:
        logger.error(f"审批流程工作流失败: {approval_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"审批流程工作流失败: {approval_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@inngest_client.create_function(
    fn_id="approval-action-workflow",
    name="审批操作工作流",
    trigger=TriggerEvent(event="approval/action"),
    retries=3,
)
async def approval_action_workflow_function(event: Event) -> Dict[str, Any]:
    """
    审批操作工作流函数
    
    监听 approval/action 事件，处理审批操作（同意、拒绝、取消、转交）。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    approval_id = data.get("approval_id")
    action = data.get("action")
    user_id = data.get("user_id")
    comment = data.get("comment")
    transfer_to_user_id = data.get("transfer_to_user_id")
    
    if not tenant_id or not approval_id or not action:
        return {
            "success": False,
            "error": "缺少必要参数：tenant_id、approval_id 或 action"
        }
    
    try:
        # 获取审批实例
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(
            tenant_id, approval_id
        )
        
        # 获取审批流程
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=str(approval_instance.process.uuid),
            deleted_at__isnull=True
        ).first()
        
        if not process:
            return {
                "success": False,
                "error": "审批流程不存在"
            }
        
        # 处理审批操作
        # 注意：审批操作的基本状态更新（approve/reject/cancel）已经在服务层完成
        # 这里主要处理节点流转逻辑
        
        if action == "approve":
            # 如果状态已经是 approved，说明服务层已经完成审批
            # 需要判断是否有下一个节点，如果有则进入下一个节点
            if approval_instance.status == "approved":
                # 判断是否有下一个节点
                next_node = _get_next_node(process.nodes, approval_instance.current_node)
                
                if next_node:
                    # 进入下一个节点
                    approval_instance.current_node = next_node.get("id")
                    approval_instance.current_approver_id = _get_node_approver(next_node, approval_instance)
                    approval_instance.status = "pending"  # 保持待审批状态
                    approval_instance.completed_at = None  # 清除完成时间
                # 如果没有下一个节点，保持 approved 状态（服务层已设置）
        
        elif action == "reject":
            # 拒绝操作已经在服务层更新状态，这里确保节点清空
            if approval_instance.status == "rejected":
                approval_instance.current_node = None
                approval_instance.current_approver_id = None
        
        elif action == "cancel":
            # 取消操作已经在服务层更新状态，这里确保节点清空
            if approval_instance.status == "cancelled":
                approval_instance.current_node = None
                approval_instance.current_approver_id = None
        
        elif action == "transfer":
            if not transfer_to_user_id:
                return {
                    "success": False,
                    "error": "转交操作必须指定目标用户"
                }
            approval_instance.current_approver_id = transfer_to_user_id
        
        await approval_instance.save()
        
        logger.info(f"审批操作工作流完成: {approval_id}, 操作: {action}, 状态: {approval_instance.status}")
        
        return {
            "success": True,
            "approval_id": approval_id,
            "action": action,
            "status": approval_instance.status,
            "current_node": approval_instance.current_node,
            "current_approver_id": approval_instance.current_approver_id
        }
    except NotFoundError as e:
        logger.error(f"审批操作工作流失败: {approval_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"审批操作工作流失败: {approval_id}, 错误: {e}")
        return {
            "success": False,
            "error": str(e)
        }


def _get_start_node(nodes: Dict[str, Any]) -> Dict[str, Any]:
    """
    获取起始节点
    
    Args:
        nodes: 流程节点配置
        
    Returns:
        Dict[str, Any]: 起始节点配置
    """
    if not nodes:
        return None
    
    # 查找类型为 "start" 的节点
    node_list = nodes.get("nodes", [])
    for node in node_list:
        if node.get("type") == "start" or node.get("data", {}).get("type") == "start":
            return node
    
    # 如果没有找到起始节点，返回第一个节点
    if node_list:
        return node_list[0]
    
    return None


def _get_next_node(nodes: Dict[str, Any], current_node_id: str) -> Dict[str, Any]:
    """
    获取下一个节点
    
    Args:
        nodes: 流程节点配置
        current_node_id: 当前节点ID
        
    Returns:
        Dict[str, Any]: 下一个节点配置，如果没有则返回 None
    """
    if not nodes or not current_node_id:
        return None
    
    # 查找当前节点的出边
    edges = nodes.get("edges", [])
    node_list = nodes.get("nodes", [])
    
    # 找到从当前节点出发的边
    for edge in edges:
        if edge.get("source") == current_node_id:
            next_node_id = edge.get("target")
            # 查找目标节点
            for node in node_list:
                if node.get("id") == next_node_id:
                    # 跳过结束节点
                    if node.get("type") == "end" or node.get("data", {}).get("type") == "end":
                        return None
                    return node
    
    return None


def _get_node_approver(node: Dict[str, Any], approval_instance: ApprovalInstance) -> int:
    """
    获取节点的审批人
    
    Args:
        node: 节点配置
        approval_instance: 审批实例
        
    Returns:
        int: 审批人ID
    """
    # 从节点配置中获取审批人
    node_data = node.get("data", {})
    approver_id = node_data.get("approver_id")
    
    if approver_id:
        return approver_id
    
    # 如果没有配置审批人，使用提交人（临时方案）
    # 实际应该根据节点配置的审批规则（角色、部门等）来确定审批人
    return approval_instance.submitter_id

