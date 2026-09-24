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
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat

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
        {"from": DocumentStatus.AUDITED.value, "to": DocumentStatus.PENDING_REVIEW.value, "description": "撤回审核"},
        {"from": DocumentStatus.PARTIAL_CONVERTED.value, "to": DocumentStatus.PENDING_REVIEW.value, "description": "撤回审核"},
        {"from": DocumentStatus.FULL_CONVERTED.value, "to": DocumentStatus.PENDING_REVIEW.value, "description": "撤回审核"},
    ]

    # 需求计算状态流转（进行中→完成/失败，失败可重算）
    DEFAULT_DEMAND_COMPUTATION_TRANSITIONS = [
        {"from": "进行中", "to": "完成", "description": "计算完成"},
        {"from": "进行中", "to": "失败", "description": "计算失败"},
        {"from": "失败", "to": "进行中", "description": "重新计算"},
    ]

    # 按单据类型映射默认流转规则（无 DB 规则时使用）
    DEFAULT_TRANSITIONS_BY_ENTITY: Dict[str, List[Dict[str, str]]] = {
        "demand": DEFAULT_DEMAND_TRANSITIONS,
        "work_order": DEFAULT_WORK_ORDER_TRANSITIONS,
        "sales_order": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "sales_forecast": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "purchase_order": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "purchase_requisition": DEFAULT_AUDIT_DOCUMENT_TRANSITIONS,
        "demand_computation": DEFAULT_DEMAND_COMPUTATION_TRANSITIONS,
    }
    
    async def _ensure_rule_authorization(
        self,
        tenant_id: int,
        operator_id: Optional[int],
        required_permission: Optional[str],
        required_role: Optional[str],
    ) -> None:
        """DB 规则必须配置 required_permission 或 required_role；皆空则拒绝（禁止兼容放行）。"""
        perm = (required_permission or "").strip()
        role_req = (required_role or "").strip()
        if not perm and not role_req:
            raise BusinessLogicError(
                "状态流转规则未配置 required_permission / required_role，拒绝执行"
            )

        if operator_id is None:
            missing = []
            if perm:
                missing.append(f"权限 {perm}")
            if role_req:
                missing.append(f"角色 {role_req}")
            raise BusinessLogicError(f"状态流转需要操作人且缺少{'、'.join(missing)}")

        from core.services.authorization.user_permission_service import UserPermissionService

        if perm:
            has_perm = await UserPermissionService.has_permission(
                user_id=operator_id,
                tenant_id=tenant_id,
                permission_code=perm,
            )
            if not has_perm:
                raise BusinessLogicError(f"状态流转缺少权限: {perm}")

        if role_req:
            roles = await UserPermissionService.get_user_roles(
                user_id=operator_id,
                tenant_id=tenant_id,
            )
            role_req_norm = role_req.strip().lower()
            matched = any(
                (r.code or "").strip().lower() == role_req_norm
                or (r.name or "").strip().lower() == role_req_norm
                for r in roles
            )
            if not matched:
                # 管理员旁路与权限体系一致
                from infra.models.user import User

                user = await User.get_or_none(id=operator_id)
                if not (
                    user
                    and await UserPermissionService.is_admin_bypass(user, tenant_id)
                ):
                    raise BusinessLogicError(f"状态流转缺少角色: {role_req}")

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

        Raises:
            BusinessLogicError: 命中规则但操作者缺少 required_permission / required_role
        """
        # 检查是否有明确的流转规则（StateTransitionRule 无 deleted_at 软删除字段）
        rule = await StateTransitionRule.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            from_state=from_state,
            to_state=to_state,
            is_active=True,
        ).first()
        
        if rule:
            await self._ensure_rule_authorization(
                tenant_id=tenant_id,
                operator_id=operator_id,
                required_permission=getattr(rule, "required_permission", None),
                required_role=getattr(rule, "required_role", None),
            )
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
                transition_time=resolve_business_datetime(),
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
            )
            
            logger.info(f"状态流转: {entity_type}:{entity_id} {from_state} -> {to_state} (操作人: {operator_name})")
            
            return log

    # 工单 to_state → document_action_policy capability
    _WORK_ORDER_STATE_CAPABILITY = {
        "released": "release",
        "cancelled": "cancel",
    }
    _WORK_ORDER_ALLOWED_STATES = frozenset(WORK_ORDER_STATES.keys())
    _DEMAND_ALLOWED_STATES = frozenset(DEMAND_STATES.keys())

    async def apply_entity_transition(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        to_state: str,
        operator_id: int,
        operator_name: str,
        transition_reason: Optional[str] = None,
        transition_comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        领域入口：校验白名单 + can_transition + capability，同事务写日志并更新实体状态。
        禁止路由层直接 filter.update(status)。
        """
        to_state_norm = _normalize_state(str(to_state or "").strip())
        async with in_transaction():
            # IDEM-01：同实体同目标态、同操作人、3 秒内已成功流转则幂等返回
            from datetime import timedelta

            recent_since = resolve_business_datetime() - timedelta(seconds=3)
            recent = await StateTransitionLog.filter(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                to_state__in=[to_state, to_state_norm],
                operator_id=operator_id,
                transition_time__gte=recent_since,
            ).order_by("-id").first()
            if recent is not None:
                return {
                    "idempotent": True,
                    "deduplicated": True,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "from_state": recent.from_state,
                    "to_state": recent.to_state,
                    "log_id": recent.id,
                    "message": "已去重，未重复执行",
                }

            if entity_type == "demand":
                from apps.kuaizhizao.models.demand import Demand

                if to_state_norm not in self._DEMAND_ALLOWED_STATES and to_state not in self._DEMAND_ALLOWED_STATES:
                    # 需求状态可能是中文键
                    if to_state not in self.DEMAND_STATES and to_state_norm not in self.DEMAND_STATES:
                        raise ValidationError(f"目标状态不在白名单: {to_state}")
                entity = await Demand.get_or_none(
                    tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
                )
                if not entity:
                    raise NotFoundError(f"需求不存在: {entity_id}")
                from_state = entity.status
                target = to_state if to_state in self.DEMAND_STATES else to_state_norm
                if not await self.can_transition(
                    tenant_id, entity_type, from_state, target, operator_id
                ):
                    raise BusinessLogicError(f"不允许从状态 {from_state} 流转到 {target}")
                log = await StateTransitionLog.create(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    from_state=from_state,
                    to_state=target,
                    transition_reason=transition_reason,
                    transition_comment=transition_comment,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    transition_time=resolve_business_datetime(),
                )
                entity.status = target
                await entity.save(update_fields=["status", "updated_at"])
            elif entity_type == "work_order":
                from apps.kuaizhizao.models.work_order import WorkOrder
                from apps.kuaizhizao.services.document_action_policy.work_order import (
                    assert_work_order_capability,
                )

                if to_state_norm not in self._WORK_ORDER_ALLOWED_STATES:
                    raise ValidationError(f"目标状态不在白名单: {to_state}")
                entity = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
                )
                if not entity:
                    raise NotFoundError(f"工单不存在: {entity_id}")
                from_state = entity.status
                if not await self.can_transition(
                    tenant_id, entity_type, from_state, to_state_norm, operator_id
                ):
                    raise BusinessLogicError(
                        f"不允许从状态 {from_state} 流转到 {to_state_norm}"
                    )
                cap = self._WORK_ORDER_STATE_CAPABILITY.get(to_state_norm)
                if cap:
                    assert_work_order_capability(entity, cap)
                log = await StateTransitionLog.create(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id,
                    from_state=from_state,
                    to_state=to_state_norm,
                    transition_reason=transition_reason,
                    transition_comment=transition_comment,
                    operator_id=operator_id,
                    operator_name=operator_name,
                    transition_time=resolve_business_datetime(),
                )
                entity.status = to_state_norm
                now = resolve_business_datetime()
                update_fields = ["status", "updated_at"]
                if to_state_norm == "in_progress" and not entity.actual_start_date:
                    entity.actual_start_date = now
                    update_fields.append("actual_start_date")
                elif to_state_norm == "completed" and not entity.actual_end_date:
                    entity.actual_end_date = now
                    update_fields.append("actual_end_date")
                await entity.save(update_fields=update_fields)
                target = to_state_norm
            else:
                raise ValidationError(f"不支持的实体类型: {entity_type}")

            logger.info(
                f"状态流转已应用: {entity_type}:{entity_id} {from_state} -> {target} "
                f"(操作人: {operator_name})"
            )
            return {
                "success": True,
                "transition_log_id": log.id,
                "from_state": from_state,
                "to_state": target,
                "transition_time": to_api_isoformat(log.transition_time)
                if log.transition_time
                else None,
            }
    
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
                "transition_time": to_api_isoformat(log.transition_time) if log.transition_time else None,
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
        # 查询所有从当前状态出发的规则（StateTransitionRule 无 deleted_at 软删除字段）
        rules = await StateTransitionRule.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            from_state=current_state,
            is_active=True,
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
