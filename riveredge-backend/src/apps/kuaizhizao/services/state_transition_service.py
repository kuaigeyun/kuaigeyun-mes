"""
状态流转服务模块

提供状态流转管理的业务逻辑，支持状态机模式管理需求状态。
优先从 StateTransitionRule 数据库加载规则，无规则时使用内置默认（demand/work_order 等）。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

from apps.kuaizhizao.models.state_transition import StateTransitionRule, StateTransitionLog
from apps.kuaizhizao.constants import STATE_ALIASES, DocumentStatus
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from tortoise.transactions import in_transaction


def _normalize_state(state: str) -> str:
    """状态归一化：中文/别名 -> 标准枚举值"""
    if not state:
        return state
    s = str(state).strip()
    return STATE_ALIASES.get(s, s)


class StateTransitionService:
    """状态流转服务"""
    
    # 需求状态定义
    DEMAND_STATES = {
        "草稿": {"order": 1, "name": "草稿", "description": "需求草稿状态"},
        "待审核": {"order": 2, "name": "待审核", "description": "需求已提交，等待审核"},
        "已审核": {"order": 3, "name": "已审核", "description": "需求已审核通过"},
        "已驳回": {"order": 4, "name": "已驳回", "description": "需求审核被驳回"},
        "已生效": {"order": 5, "name": "已生效", "description": "需求已生效"},
        "已完成": {"order": 6, "name": "已完成", "description": "需求已完成"},
        "已取消": {"order": 7, "name": "已取消", "description": "需求已取消"},
    }
    
    # 默认状态流转规则（需求）
    DEFAULT_DEMAND_TRANSITIONS = [
        {"from": "草稿", "to": "待审核", "description": "提交审核"},
        {"from": "待审核", "to": "已审核", "description": "审核通过"},
        {"from": "待审核", "to": "已驳回", "description": "审核驳回"},
        {"from": "已驳回", "to": "草稿", "description": "重新编辑"},
        {"from": "已审核", "to": "已生效", "description": "生效"},
        {"from": "已生效", "to": "已完成", "description": "完成"},
        {"from": "草稿", "to": "已取消", "description": "取消"},
        {"from": "待审核", "to": "已取消", "description": "取消"},
    ]
    
    # 工单状态定义
    WORK_ORDER_STATES = {
        "draft": {"order": 1, "name": "草稿", "description": "工单草稿状态"},
        "released": {"order": 2, "name": "已下达", "description": "工单已下达，等待开始生产"},
        "in_progress": {"order": 3, "name": "执行中", "description": "工单正在执行中"},
        "completed": {"order": 4, "name": "已完成", "description": "工单已完成"},
        "cancelled": {"order": 5, "name": "已取消", "description": "工单已取消"},
    }
    
    # 默认状态流转规则（工单）
    DEFAULT_WORK_ORDER_TRANSITIONS = [
        {"from": "draft", "to": "released", "description": "下达工单"},
        {"from": "released", "to": "in_progress", "description": "开始生产"},
        {"from": "in_progress", "to": "completed", "description": "完成工单"},
        {"from": "draft", "to": "cancelled", "description": "取消工单"},
        {"from": "released", "to": "cancelled", "description": "取消工单"},
        {"from": "in_progress", "to": "cancelled", "description": "取消工单"},
    ]

    # 标准审核类单据默认流转（销售订单、采购订单、销售预测等，使用 DocumentStatus）
    DEFAULT_AUDIT_DOCUMENT_TRANSITIONS = [
        {"from": DocumentStatus.DRAFT.value, "to": DocumentStatus.PENDING_REVIEW.value, "description": "提交审核"},
        {"from": DocumentStatus.PENDING_REVIEW.value, "to": DocumentStatus.AUDITED.value, "description": "审核通过"},
        {"from": DocumentStatus.PENDING_REVIEW.value, "to": DocumentStatus.REJECTED.value, "description": "审核驳回"},
        {"from": DocumentStatus.REJECTED.value, "to": DocumentStatus.DRAFT.value, "description": "重新编辑"},
        {"from": DocumentStatus.PENDING_REVIEW.value, "to": DocumentStatus.DRAFT.value, "description": "撤回"},
    ]

    # 按单据类型映射默认流转规则（无 DB 规则时使用）
    DEFAULT_TRANSITIONS_BY_ENTITY: Dict[str, List[Dict[str, str]]] = {
        "demand": DEFAULT_DEMAND_TRANSITIONS,
        "work_order": DEFAULT_WORK_ORDER_TRANSITIONS,
        "sales_order": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "sales_forecast": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "purchase_order": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "purchase_requisition": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
    }
    
    async def can_transition(
        self,
        tenant_id: int,
        entity_type: str,
        from_state: str,
        to_state: str,
        operator_id: Optional[int] = None
    ) -> bool:
        """
        检查是否可以执行状态流转
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            from_state: 源状态
            to_state: 目标状态
            operator_id: 操作人ID（可选，用于权限检查）
            
        Returns:
            bool: 是否可以流转
        """
        # 检查是否有明确的流转规则
        rule = await StateTransitionRule.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            from_state=from_state,
            to_state=to_state,
            is_active=True,
            deleted_at__isnull=True
        ).first()
        
        if rule:
            # 有规则，检查权限（TODO: 实现权限检查）
            return True

        # 无 DB 规则时，使用内置默认（支持更多单据类型）
        transitions = self.DEFAULT_TRANSITIONS_BY_ENTITY.get(entity_type)
        if transitions:
            nf, nt = _normalize_state(from_state), _normalize_state(to_state)
            for t in transitions:
                if _normalize_state(t["from"]) == nf and _normalize_state(t["to"]) == nt:
                    return True

        return False
    
    async def transition_state(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        from_state: str,
        to_state: str,
        operator_id: int,
        operator_name: str,
        transition_reason: Optional[str] = None,
        transition_comment: Optional[str] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None
    ) -> StateTransitionLog:
        """
        执行状态流转
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            from_state: 源状态
            to_state: 目标状态
            operator_id: 操作人ID
            operator_name: 操作人姓名
            transition_reason: 流转原因（可选）
            transition_comment: 流转备注（可选）
            related_entity_type: 关联实体类型（可选）
            related_entity_id: 关联实体ID（可选）
            
        Returns:
            StateTransitionLog: 状态流转日志
            
        Raises:
            BusinessLogicError: 状态流转不允许
        """
        async with in_transaction():
            # 检查是否可以流转
            if not await self.can_transition(tenant_id, entity_type, from_state, to_state, operator_id):
                raise BusinessLogicError(f"不允许从状态 {from_state} 流转到 {to_state}")
            
            # 创建状态流转日志
            log = await StateTransitionLog.create(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                from_state=from_state,
                to_state=to_state,
                transition_reason=transition_reason,
                transition_comment=transition_comment,
                operator_id=operator_id,
                operator_name=operator_name,
                transition_time=datetime.now(),
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
            )
            
            logger.info(f"状态流转: {entity_type}:{entity_id} {from_state} -> {to_state} (操作人: {operator_name})")
            
            return log
    
    async def get_transition_history(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取状态流转历史
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            
        Returns:
            List[Dict]: 状态流转历史列表
        """
        logs = await StateTransitionLog.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by('transition_time').all()
        
        result = []
        for log in logs:
            result.append({
                "id": log.id,
                "uuid": str(log.uuid),
                "from_state": log.from_state,
                "to_state": log.to_state,
                "transition_reason": log.transition_reason,
                "transition_comment": log.transition_comment,
                "operator_id": log.operator_id,
                "operator_name": log.operator_name,
                "transition_time": log.transition_time.isoformat() if log.transition_time else None,
                "related_entity_type": log.related_entity_type,
                "related_entity_id": log.related_entity_id,
            })
        
        return result
    
    async def get_available_transitions(
        self,
        tenant_id: int,
        entity_type: str,
        current_state: str
    ) -> List[Dict[str, Any]]:
        """
        获取可用的状态流转选项
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            current_state: 当前状态
            
        Returns:
            List[Dict]: 可用的状态流转列表
        """
        # 查询所有从当前状态出发的规则
        rules = await StateTransitionRule.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            from_state=current_state,
            is_active=True,
            deleted_at__isnull=True
        ).all()
        
        result = []
        for rule in rules:
            result.append({
                "to_state": rule.to_state,
                "description": rule.description,
                "required_permission": rule.required_permission,
                "required_role": rule.required_role,
            })
        
        # 如果没有规则，使用默认规则（支持更多单据类型）
        if not result:
            transitions = self.DEFAULT_TRANSITIONS_BY_ENTITY.get(entity_type)
            if transitions:
                nc = _normalize_state(current_state)
                for t in transitions:
                    if _normalize_state(t["from"]) == nc:
                        result.append({
                            "to_state": t["to"],
                            "description": t["description"],
                            "required_permission": None,
                            "required_role": None,
                        })

        return result
