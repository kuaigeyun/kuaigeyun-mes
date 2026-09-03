"""审批 P2 高级动作：转交、加签、委托、催办。"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from core.models.approval_history import ApprovalHistory
from core.models.approval_instance import ApprovalInstance
from core.models.approval_task import ApprovalTask
from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
from core.services.approval.approval_instance_service import ApprovalInstanceService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime


class ApprovalAdvancedActions:
    @staticmethod
    async def _resolve_user_id(tenant_id: int, user_ref: int | str) -> int:
        if isinstance(user_ref, int) and user_ref > 0:
            u = await User.filter(
                tenant_id=tenant_id, id=user_ref, deleted_at__isnull=True, is_active=True
            ).first()
            if u:
                return u.id
            raise ValidationError(f"用户不存在: {user_ref}")
        uid = str(user_ref).strip()
        u = await User.filter(
            tenant_id=tenant_id, uuid=uid, deleted_at__isnull=True, is_active=True
        ).first()
        if not u:
            raise ValidationError(f"用户不存在: {user_ref}")
        return u.id

    @staticmethod
    async def _get_entity_pending_task(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> tuple[ApprovalInstance, ApprovalTask]:
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            raise ValidationError("当前无进行中的审批实例")

        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            approver_id=operator_id,
            status="pending",
        ).first()
        if not task:
            await ApprovalInstanceService.bootstrap_instance_workflow(tenant_id, instance)
            task = await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                approver_id=operator_id,
                status="pending",
            ).first()
        if not task:
            raise ValidationError("您没有当前节点的待办任务")
        await instance.fetch_related("process")
        return instance, task

    @staticmethod
    async def _node_data(instance: ApprovalInstance) -> Dict[str, Any]:
        graph = normalize_flow_graph((instance.process.nodes or {}) if instance.process else {})
        node = get_node_config(graph, instance.current_node)
        return (node or {}).get("data") or {}

    @staticmethod
    async def _assert_capability(instance: ApprovalInstance, key: str) -> None:
        data = await ApprovalAdvancedActions._node_data(instance)
        flag_map = {
            "transfer": "allowTransfer",
            "add_sign": "allowAddSign",
        }
        flag = flag_map.get(key)
        if flag and not data.get(flag):
            raise ValidationError("当前审批节点未开启该操作")

    @staticmethod
    async def _write_history(
        tenant_id: int,
        instance: ApprovalInstance,
        action: str,
        operator_id: int,
        comment: Optional[str] = None,
        from_approver_id: Optional[int] = None,
        to_approver_id: Optional[int] = None,
    ) -> None:
        await ApprovalHistory.create(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action=action,
            action_by=operator_id,
            action_at=resolve_business_datetime(),
            comment=comment,
            from_node=instance.current_node,
            to_node=instance.current_node,
            from_approver_id=from_approver_id,
            to_approver_id=to_approver_id,
        )

    @staticmethod
    async def transfer(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        transfer_to: int | str,
        comment: Optional[str] = None,
    ) -> ApprovalInstance:
        instance, task = await ApprovalAdvancedActions._get_entity_pending_task(
            tenant_id, entity_type, entity_id, operator_id
        )
        await ApprovalAdvancedActions._assert_capability(instance, "transfer")
        target_id = await ApprovalAdvancedActions._resolve_user_id(tenant_id, transfer_to)
        if target_id == operator_id:
            raise ValidationError("不能转交给自己")

        task.status = "transferred"
        task.action_at = resolve_business_datetime()
        task.comment = comment
        await task.save()

        new_task = await ApprovalTask.create(
            tenant_id=tenant_id,
            approval_instance=instance,
            node_id=task.node_id,
            approver_id=target_id,
            status="pending",
            due_at=task.due_at,
        )
        instance.current_approver_id = target_id
        await instance.save()

        await ApprovalAdvancedActions._write_history(
            tenant_id,
            instance,
            "transfer",
            operator_id,
            comment=comment or "转交",
            from_approver_id=operator_id,
            to_approver_id=target_id,
        )
        logger.info("审批转交 instance={} task={} -> user={}", instance.id, new_task.id, target_id)
        return instance

    @staticmethod
    async def delegate(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        delegate_to: int | str,
        comment: Optional[str] = None,
    ) -> ApprovalInstance:
        instance, task = await ApprovalAdvancedActions._get_entity_pending_task(
            tenant_id, entity_type, entity_id, operator_id
        )
        target_id = await ApprovalAdvancedActions._resolve_user_id(tenant_id, delegate_to)
        if target_id == operator_id:
            raise ValidationError("不能委托给自己")

        task.approver_id = target_id
        task.delegated_from_user_id = operator_id
        task.comment = comment
        await task.save()

        instance.current_approver_id = target_id
        await instance.save()

        await ApprovalAdvancedActions._write_history(
            tenant_id,
            instance,
            "delegate",
            operator_id,
            comment=comment or "委托审批",
            from_approver_id=operator_id,
            to_approver_id=target_id,
        )
        return instance

    @staticmethod
    async def add_sign(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        sign_user_ids: List[int | str],
        sign_type: str = "before",
        comment: Optional[str] = None,
    ) -> ApprovalInstance:
        instance, task = await ApprovalAdvancedActions._get_entity_pending_task(
            tenant_id, entity_type, entity_id, operator_id
        )
        await ApprovalAdvancedActions._assert_capability(instance, "add_sign")
        if sign_type not in ("before", "after"):
            raise ValidationError("加签类型须为 before 或 after")
        if not sign_user_ids:
            raise ValidationError("须指定加签审批人")

        resolved: List[int] = []
        for ref in sign_user_ids:
            resolved.append(await ApprovalAdvancedActions._resolve_user_id(tenant_id, ref))

        if sign_type == "before":
            task.status = "suspended"
            task.comment = comment
            await task.save()
            for uid in resolved:
                await ApprovalTask.create(
                    tenant_id=tenant_id,
                    approval_instance=instance,
                    node_id=task.node_id,
                    approver_id=uid,
                    status="pending",
                    sign_type="before",
                    parent_task_id=task.id,
                    due_at=task.due_at,
                )
        else:
            task.status = "approved"
            task.action_at = resolve_business_datetime()
            task.comment = comment
            await task.save()
            for uid in resolved:
                await ApprovalTask.create(
                    tenant_id=tenant_id,
                    approval_instance=instance,
                    node_id=task.node_id,
                    approver_id=uid,
                    status="pending",
                    sign_type="after",
                    parent_task_id=task.id,
                    due_at=task.due_at,
                )

        await ApprovalAdvancedActions._write_history(
            tenant_id,
            instance,
            "add_sign",
            operator_id,
            comment=comment or f"{'前' if sign_type == 'before' else '后'}加签",
            from_approver_id=operator_id,
        )
        return instance

    @staticmethod
    async def urge(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
        comment: Optional[str] = None,
    ) -> ApprovalInstance:
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            raise ValidationError("当前无进行中的审批，无法催办")

        pending_tasks = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            status="pending",
        ).all()
        if not pending_tasks:
            raise ValidationError("当前无待办审批人")

        await ApprovalAdvancedActions._write_history(
            tenant_id,
            instance,
            "urge",
            operator_id,
            comment=comment or "催办",
        )

        try:
            approver_ids = [t.approver_id for t in pending_tasks]
            ApprovalInstanceService._spawn_background(
                ApprovalInstanceService._send_urge_notification(
                    tenant_id=tenant_id,
                    instance=instance,
                    approver_ids=approver_ids,
                    comment=comment,
                )
            )
        except Exception as exc:
            logger.warning("催办通知发送失败: {}", exc)
        return instance

    @staticmethod
    async def apply_task_due_at(task: ApprovalTask, node: dict) -> None:
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        hours = data.get("timeoutHours")
        if hours is None:
            return
        try:
            h = float(hours)
            if h > 0:
                task.due_at = resolve_business_datetime() + timedelta(hours=h)
                await task.save(update_fields=["due_at", "updated_at"])
        except (TypeError, ValueError):
            pass

    @staticmethod
    async def resume_suspended_after_before_sign(
        tenant_id: int,
        instance: ApprovalInstance,
        node_id: str,
        parent_task_id: int,
    ) -> None:
        """前加签子任务全部完成后，恢复被挂起的原任务。"""
        pending_before = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            node_id=node_id,
            sign_type="before",
            status="pending",
        ).count()
        if pending_before > 0:
            return
        parent = await ApprovalTask.filter(id=parent_task_id, tenant_id=tenant_id).first()
        if parent and parent.status == "suspended":
            parent.status = "pending"
            await parent.save(update_fields=["status", "updated_at"])
