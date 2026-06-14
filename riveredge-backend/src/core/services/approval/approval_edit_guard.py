"""审核中改单守卫：当前审批人 + 节点开关 + 变更留痕。"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from core.config.audit_editable_fields import editable_fields_for_entity, is_field_editable
from core.models.approval_history import ApprovalHistory
from core.models.approval_instance import ApprovalInstance
from core.models.approval_task import ApprovalTask
from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
from core.services.approval.approval_instance_service import ApprovalInstanceService
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


class ApprovalEditGuard:
    @staticmethod
    async def get_pending_edit_context(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> Optional[Dict[str, Any]]:
        """若当前用户可在审核中改单，返回上下文；否则 None。"""
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            return None

        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            approver_id=operator_id,
            status="pending",
        ).first()
        if not task:
            return None

        await instance.fetch_related("process")
        process = instance.process
        if not process:
            return None

        graph = normalize_flow_graph(process.nodes or {})
        node = get_node_config(graph, instance.current_node or task.node_id)
        if not node or node.get("type") != "approval":
            return None

        data = node.get("data") or {}
        if not data.get("allowEditDuringApproval"):
            return None

        node_editable = data.get("editableFields")
        if node_editable is None:
            spec = editable_fields_for_entity(entity_type)
            node_editable = spec if isinstance(spec, list) else ["*"]

        return {
            "approval_instance_id": instance.id,
            "instance_uuid": str(instance.uuid),
            "node_id": node.get("id"),
            "node_label": data.get("label") or node.get("id"),
            "editable_fields": node_editable,
            "refresh_context_on_edit": bool(data.get("refreshContextOnEdit", True)),
        }

    @staticmethod
    async def assert_approver_can_edit(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> Dict[str, Any]:
        ctx = await ApprovalEditGuard.get_pending_edit_context(
            tenant_id, entity_type, entity_id, operator_id
        )
        if not ctx:
            raise BusinessLogicError("单据审核中，当前节点未允许您修改单据，或您不是当前审批人")
        return ctx

    @staticmethod
    def assert_fields_allowed(
        entity_type: str,
        field_changes: List[Dict[str, Any]],
        edit_context: Dict[str, Any],
    ) -> None:
        node_editable = edit_context.get("editable_fields")
        for fc in field_changes:
            field = fc.get("field")
            if not field:
                continue
            if not is_field_editable(entity_type, str(field), node_editable):
                label = fc.get("label") or field
                raise ValidationError(f"字段「{label}」不允许在审核中修改")

    @staticmethod
    async def record_document_edit(
        tenant_id: int,
        edit_context: Dict[str, Any],
        operator_id: int,
        field_changes: List[Dict[str, Any]],
        comment: Optional[str] = None,
    ) -> None:
        if not field_changes:
            return
        await ApprovalHistory.create(
            tenant_id=tenant_id,
            approval_instance_id=edit_context["approval_instance_id"],
            action="document_edit",
            action_by=operator_id,
            action_at=datetime.now(),
            comment=comment or "审核中修改单据",
            from_node=edit_context.get("node_id"),
            to_node=edit_context.get("node_id"),
            change_payload={
                "node_id": edit_context.get("node_id"),
                "node_label": edit_context.get("node_label"),
                "field_changes": field_changes,
            },
        )

    @staticmethod
    async def refresh_instance_context_if_needed(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        edit_context: Dict[str, Any],
    ) -> None:
        if not edit_context.get("refresh_context_on_edit"):
            return
        from core.services.approval.audit_context_builder import build_audit_context

        instance = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            id=edit_context["approval_instance_id"],
            deleted_at__isnull=True,
        ).first()
        if not instance:
            return
        snapshot = await build_audit_context(tenant_id, entity_type, entity_id)
        data = dict(instance.data or {})
        data.update(snapshot)
        instance.data = data
        await instance.save(update_fields=["data", "updated_at"])
