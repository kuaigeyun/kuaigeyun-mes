"""
审批实例管理服务模块

提供审批实例的 CRUD 操作和审批操作功能。
统一入口：start_approval、get_approval_status、execute_approval 供业务单据调用。

审核生命周期（提交→建任务→通过/驳回→业务写回）均在 API 请求内同步完成，不依赖 Taskiq Worker。
Worker 仅用于消息通知等可选后台任务（asyncio.create_task）。
"""

import asyncio
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from loguru import logger

from core.models.approval_history import ApprovalHistory

from tortoise.exceptions import IntegrityError

from core.models.approval_instance import ApprovalInstance
from core.utils.search_utils import apply_keyword_icontains
from core.models.approval_process import ApprovalProcess
from core.models.approval_task import ApprovalTask
from core.models.department import Department
from core.models.role import Role
from core.models.user_role import UserRole
from core.schemas.approval_instance import ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceAction
from core.services.messaging.message_service import MessageService
from core.schemas.message_template import SendMessageRequest
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalInstanceService:
    """
    审批实例管理服务类
    
    提供审批实例的 CRUD 操作和审批操作功能。
    """

    @staticmethod
    def _format_dt_for_api(value: Optional[datetime]) -> Optional[str]:
        """唯一出口：to_api_isoformat（与 BaseSchema / SiteTimezoneJSONResponse 同口径）。"""
        return to_api_isoformat(value)

    @staticmethod
    def _normalize_execution_action(action: Optional[str]) -> str:
        raw = str(action or "").strip().lower()
        if raw in {"approve", "approved"}:
            return "approve"
        if raw in {"reject", "rejected"}:
            return "reject"
        if raw in {"cancel", "cancelled", "canceled"}:
            return "withdraw"
        if raw in {"transfer", "transferred"}:
            return "transfer"
        if raw in {"withdraw", "withdrawn"}:
            return "withdraw"
        if raw in {"submit", "submitted"}:
            return "submit"
        if raw in {"document_edit", "edit_during_approval"}:
            return "document_edit"
        if raw in {"add_sign", "addsign"}:
            return "add_sign"
        if raw in {"delegate", "delegated"}:
            return "delegate"
        if raw in {"urge", "urged", "remind"}:
            return "urge"
        if raw in {"timeout_escalate", "timeout"}:
            return "timeout_escalate"
        return raw or "unknown"

    @staticmethod
    def _execution_action_label(action: Optional[str]) -> str:
        key = ApprovalInstanceService._normalize_execution_action(action)
        labels = {
            "approve": "审核通过",
            "reject": "驳回",
            "cancel": "已取消",
            "withdraw": "撤回",
            "transfer": "转交",
            "submit": "提交",
            "document_edit": "审核中修改",
            "add_sign": "加签",
            "delegate": "委托",
            "urge": "催办",
            "timeout_escalate": "超时升级",
            "unknown": "未知操作",
        }
        return labels.get(key, labels["unknown"])
    
    @staticmethod
    async def create_approval_instance(
        tenant_id: int,
        user_id: int,
        data: ApprovalInstanceCreate
    ) -> ApprovalInstance:
        """
        创建审批实例（提交审批）
        
        Args:
            tenant_id: 组织ID
            user_id: 提交人ID
            data: 审批实例创建数据
            
        Returns:
            ApprovalInstance: 创建的审批实例对象
            
        Raises:
            ValidationError: 当流程不存在时抛出
        """
        # 获取审批流程
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=str(data.process_uuid),
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not process:
            raise NotFoundError("审批流程不存在或未启用")
        
        try:
            approval_instance = ApprovalInstance(
                tenant_id=tenant_id,
                process=process,
                title=data.title,
                content=data.content,
                data=data.data,
                status="pending",
                submitter_id=user_id,
                submitted_at=resolve_business_datetime(),
                process_version=getattr(process, "published_version", None) or 1,
            )
            await approval_instance.save()

            # 同步推进到首个待办节点并创建任务（不依赖 Taskiq Worker）
            await ApprovalInstanceService.bootstrap_instance_workflow(
                tenant_id, approval_instance
            )

            await ApprovalInstanceService._create_approval_history(
                tenant_id=tenant_id,
                approval_instance_id=approval_instance.id,
                action="submit",
                action_by=user_id,
                from_node="start",
                to_node=approval_instance.current_node,
            )

            # 异步发送消息通知（不阻塞审核主链路）
            asyncio.create_task(
                ApprovalInstanceService._send_approval_submitted_notification(
                    tenant_id=tenant_id,
                    approval_instance=approval_instance,
                    process=process
                )
            )

            return approval_instance
        except IntegrityError:
            raise ValidationError("创建审批实例失败")

    @staticmethod
    async def bootstrap_instance_workflow(
        tenant_id: int,
        approval_instance: ApprovalInstance,
    ) -> bool:
        """
        从起始节点同步推进实例到首个待办节点并创建 ApprovalTask。

        创建审批实例时必须调用；Worker 未运行时也能产生待办任务。
        已存在 pending 任务时补齐缺失审批人任务（多指定用户/角色）。
        """
        if approval_instance.status != "pending":
            return False

        process = approval_instance.process
        if not process:
            await approval_instance.fetch_related("process")
            process = approval_instance.process
        if not process:
            raise NotFoundError("审批流程不存在")

        pending_count = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=approval_instance.id,
            status="pending",
        ).count()

        nodes = ApprovalInstanceService._normalize_process_graph(process.nodes)
        node_list = nodes.get("nodes") or []

        current_node_id = approval_instance.current_node
        if current_node_id:
            current_node = next(
                (
                    n for n in node_list
                    if isinstance(n, dict) and n.get("id") == current_node_id
                ),
                None,
            )
            if current_node:
                node_type = current_node.get("type") or (current_node.get("data") or {}).get("type")
                if node_type not in ("start", "end", None):
                    if pending_count > 0:
                        await ApprovalInstanceService._sync_node_approver_tasks(
                            tenant_id, approval_instance, current_node
                        )
                        return True
                    await ApprovalInstanceService._create_node_tasks(
                        tenant_id, approval_instance, current_node
                    )
                    return True

        if pending_count > 0:
            return False

        start_node = ApprovalInstanceService._get_start_node(nodes)
        if not start_node:
            raise ValidationError("审批流程没有起始节点")

        start_id = start_node.get("id")
        next_node = ApprovalInstanceService._get_next_node(
            nodes, start_id, instance=approval_instance
        )
        if not next_node:
            approval_instance.status = "approved"
            approval_instance.completed_at = resolve_business_datetime()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
            await approval_instance.save()
            await ApprovalInstanceService._handle_approval_completion(
                tenant_id, approval_instance
            )
            return True

        next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
        if next_type == "end":
            approval_instance.status = "approved"
            approval_instance.completed_at = resolve_business_datetime()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
            await approval_instance.save()
            await ApprovalInstanceService._handle_approval_completion(
                tenant_id, approval_instance
            )
            return True

        approval_instance.current_node = next_node.get("id")
        await approval_instance.save()
        await ApprovalInstanceService._create_node_tasks(
            tenant_id, approval_instance, next_node
        )
        logger.info(
            "审批实例已同步启动: {} 当前节点: {}",
            approval_instance.uuid,
            approval_instance.current_node,
        )
        return True

    # ========== 统一入口：供业务单据调用 ==========

    @staticmethod
    async def start_approval(
        tenant_id: int,
        user_id: int,
        process_code: str,
        entity_type: str,
        entity_id: int,
        entity_uuid: str,
        title: str,
        content: Optional[str] = None,
    ) -> Optional[ApprovalInstance]:
        """
        按 process_code 启动审批流程（统一入口）

        若流程不存在则返回 None，调用方走简单审核；若流程存在则创建实例并返回。

        Args:
            tenant_id: 租户ID
            user_id: 提交人ID
            process_code: 流程代码（如 demand_approval、purchase_order_approval、sales_order_approval）
            entity_type: 实体类型
            entity_id: 实体ID
            entity_uuid: 实体UUID
            title: 审批标题
            content: 审批内容（可选）

        Returns:
            ApprovalInstance 或 None（流程不存在时）
        """
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=process_code,
            is_active=True,
            deleted_at__isnull=True,
        ).first()

        if not process:
            return None

        data = ApprovalInstanceCreate(
            process_uuid=str(process.uuid),
            title=title,
            content=content or "",
            data={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "entity_uuid": entity_uuid,
            },
        )
        from core.services.approval.audit_context_builder import build_audit_context

        ctx = await build_audit_context(tenant_id, entity_type, entity_id)
        if ctx:
            data.data.update(ctx)
        return await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id, user_id=user_id, data=data
        )

    @staticmethod
    async def start_approval_for_node(
        tenant_id: int,
        user_id: int,
        node_key: str,
        entity_type: str,
        entity_id: int,
        entity_uuid: str,
        title: str,
        content: Optional[str] = None,
    ) -> Optional[ApprovalInstance]:
        """
        按 manifest node_key 解析审核绑定并启动审批（统一入口，避免业务层硬编码 process_code）。
        """
        from core.services.approval.audit_binding_service import AuditBindingService

        process = await AuditBindingService.resolve_process_for_node(tenant_id, node_key)
        if not process:
            return None
        return await ApprovalInstanceService.start_approval(
            tenant_id=tenant_id,
            user_id=user_id,
            process_code=process.code,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_uuid=entity_uuid,
            title=title,
            content=content,
        )

    @staticmethod
    async def _user_display_map(tenant_id: int, user_ids: List[int]) -> Dict[int, str]:
        ids = [i for i in dict.fromkeys(user_ids) if i]
        if not ids:
            return {}
        rows = await User.filter(
            tenant_id=tenant_id,
            id__in=ids,
            deleted_at__isnull=True,
        ).values("id", "full_name", "username")
        out: Dict[int, str] = {}
        for row in rows:
            uid = int(row["id"])
            name = (row.get("full_name") or row.get("username") or str(uid)).strip()
            out[uid] = name
        return out

    @staticmethod
    def _normalize_process_graph(raw: Any) -> Dict[str, Any]:
        if isinstance(raw, dict):
            nodes = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
            edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
            return {"nodes": nodes, "edges": edges}
        return {"nodes": [], "edges": []}

    @staticmethod
    async def _resolve_process_for_entity_display(
        tenant_id: int,
        entity_type: str,
        instance: Optional[ApprovalInstance],
    ) -> Optional[ApprovalProcess]:
        if instance and instance.process_id:
            proc = instance.process
            if proc and proc.deleted_at is None:
                return proc
        from core.config.audit_registry import entry_by_entity_type
        from core.models.audit_document_binding import AuditDocumentBinding

        entry = entry_by_entity_type(entity_type)
        if not entry:
            return None
        binding = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            node_key=entry.node_key,
            deleted_at__isnull=True,
        ).prefetch_related("process").first()
        if binding and binding.process and binding.process.deleted_at is None:
            return binding.process
        return await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=entry.node_key,
            deleted_at__isnull=True,
        ).first()

    @staticmethod
    async def _build_nodes_overview(
        tenant_id: int,
        process: ApprovalProcess,
        instance: Optional[ApprovalInstance],
        tasks: List[ApprovalTask],
        history: List[ApprovalHistory],
    ) -> List[Dict[str, Any]]:
        graph = ApprovalInstanceService._normalize_process_graph(process.nodes)
        overview: List[Dict[str, Any]] = []
        user_ids: List[int] = []

        if instance:
            user_ids.append(instance.submitter_id)
        for t in tasks:
            user_ids.append(t.approver_id)
        for h in history:
            user_ids.append(h.action_by)

        for node in graph.get("nodes") or []:
            if not isinstance(node, dict):
                continue
            node_type = str(node.get("type") or "")
            if node_type in {"start", "end"}:
                continue
            node_id = str(node.get("id") or "")
            if not node_id:
                continue
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            label = str(data.get("label") or node_id)

            node_tasks = [t for t in tasks if t.node_id == node_id]
            node_history = [
                h for h in history
                if h.from_node == node_id or h.to_node == node_id
            ]

            is_current = bool(
                instance
                and instance.status == "pending"
                and instance.current_node == node_id
            )
            if any(t.status == "rejected" for t in node_tasks):
                node_status = "rejected"
            elif any(t.status == "approved" for t in node_tasks):
                node_status = "approved"
            elif is_current:
                node_status = "pending"
            elif instance and instance.status == "approved":
                node_status = "approved"
            elif instance and instance.status in {"rejected", "cancelled"}:
                node_status = "skipped"
            else:
                node_status = "waiting"

            eligible: List[Dict[str, Any]] = []
            if instance and node_type == "approval":
                try:
                    approver_ids = await ApprovalInstanceService._resolve_node_approvers(
                        node, instance
                    )
                    user_ids.extend(approver_ids)
                    names = await ApprovalInstanceService._user_display_map(
                        tenant_id, approver_ids
                    )
                    eligible = [
                        {"user_id": uid, "name": names.get(uid, str(uid))}
                        for uid in approver_ids
                    ]
                except Exception as exc:
                    logger.warning("解析节点 {} 可审核人失败: {}", node_id, exc)

            executions: List[Dict[str, Any]] = []
            history_keys: set[tuple[int, int, str]] = set()

            for h in sorted(
                node_history,
                key=lambda x: x.action_at or datetime.min,
                reverse=True,
            ):
                norm_action = ApprovalInstanceService._normalize_execution_action(h.action)
                if norm_action == "document_edit":
                    dedupe_key = (h.approval_instance_id, h.action_by, norm_action, str(h.action_at))
                else:
                    dedupe_key = (h.approval_instance_id, h.action_by, norm_action)
                if dedupe_key in history_keys:
                    continue
                history_keys.add(dedupe_key)
                payload = getattr(h, "change_payload", None) or {}
                executions.append(
                    {
                        "action": h.action,
                        "action_label": ApprovalInstanceService._execution_action_label(h.action),
                        "action_by": h.action_by,
                        "action_at": ApprovalInstanceService._format_dt_for_api(h.action_at),
                        "comment": h.comment,
                        "from_node": h.from_node,
                        "to_node": h.to_node,
                        "field_changes": payload.get("field_changes") if norm_action == "document_edit" else None,
                        "source": "history",
                    }
                )

            for t in node_tasks:
                if not t.action_at:
                    continue
                norm_action = ApprovalInstanceService._normalize_execution_action(t.status)
                inst_id = t.approval_instance_id
                if (inst_id, t.approver_id, norm_action) in history_keys:
                    continue
                user_ids.append(t.approver_id)
                executions.append(
                    {
                        "action_label": ApprovalInstanceService._execution_action_label(t.status),
                        "action_by": t.approver_id,
                        "action_at": ApprovalInstanceService._format_dt_for_api(t.action_at),
                        "comment": t.comment,
                        "source": "task",
                    }
                )

            executions.sort(key=lambda x: x.get("action_at") or "")

            overview.append(
                {
                    "node_id": node_id,
                    "label": label,
                    "node_type": node_type,
                    "is_current": is_current,
                    "status": node_status,
                    "eligible_approvers": eligible,
                    "executions": executions,
                }
            )

        name_map = await ApprovalInstanceService._user_display_map(tenant_id, user_ids)
        for item in overview:
            for ex in item["executions"]:
                uid = ex.get("action_by")
                if uid is not None:
                    ex["action_by_name"] = name_map.get(int(uid), str(uid))
        return overview

    @staticmethod
    async def get_approval_status(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        viewer_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        按 entity_type + entity_id 获取审批状态（统一入口，含流程图与节点概况）。
        """
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(100)

        entity_instances: List[ApprovalInstance] = []
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                entity_instances.append(inst)

        instance = await ApprovalInstanceService._resolve_active_instance(entity_instances)

        process = await ApprovalInstanceService._resolve_process_for_entity_display(
            tenant_id, entity_type, instance
        )

        if not instance and not process:
            return {
                "has_flow": False,
                "has_instance": False,
                "status": None,
                "current_node": None,
                "tasks": [],
                "history": [],
                "process": None,
                "instance": None,
                "nodes_overview": [],
            }

        tasks: List[ApprovalTask] = []
        history: List[ApprovalHistory] = []
        if entity_instances:
            if instance and instance.status == "pending":
                await ApprovalInstanceService.bootstrap_instance_workflow(
                    tenant_id, instance
                )
            instance_ids = [inst.id for inst in entity_instances]
            tasks = await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id__in=instance_ids,
            ).order_by("-created_at").all()
            history = await ApprovalHistory.filter(
                tenant_id=tenant_id,
                approval_instance_id__in=instance_ids,
            ).order_by("action_at").all()

        nodes_overview: List[Dict[str, Any]] = []
        process_payload = None
        if process:
            graph = ApprovalInstanceService._normalize_process_graph(process.nodes)
            nodes_overview = await ApprovalInstanceService._build_nodes_overview(
                tenant_id, process, instance, tasks, history
            )
            process_payload = {
                "uuid": str(process.uuid),
                "name": process.name,
                "code": process.code,
                "nodes": graph,
            }

        instance_payload = None
        if instance:
            submitter_map = await ApprovalInstanceService._user_display_map(
                tenant_id, [instance.submitter_id]
            )
            instance_payload = {
                "uuid": str(instance.uuid),
                "submitter_id": instance.submitter_id,
                "submitter_name": submitter_map.get(instance.submitter_id, str(instance.submitter_id)),
                "submitted_at": ApprovalInstanceService._format_dt_for_api(instance.submitted_at),
                "title": instance.title,
            }

        history_user_map = await ApprovalInstanceService._user_display_map(
            tenant_id, [h.action_by for h in history]
        )

        node_capabilities: Dict[str, bool] = {
            "allow_transfer": False,
            "allow_add_sign": False,
            "allow_edit_during_approval": False,
        }
        editable_fields: List[Any] = []
        can_edit_during_approval = False
        if instance and instance.status == "pending" and process and viewer_id:
            from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
            from core.services.approval.approval_edit_guard import ApprovalEditGuard

            edit_ctx = await ApprovalEditGuard.get_pending_edit_context(
                tenant_id, entity_type, entity_id, viewer_id
            )
            if edit_ctx:
                can_edit_during_approval = True
                editable_fields = edit_ctx.get("editable_fields") or []
            graph = normalize_flow_graph(process.nodes or {})
            node = get_node_config(graph, instance.current_node)
            if node and node.get("type") == "approval":
                nd = node.get("data") or {}
                node_capabilities = {
                    "allow_transfer": bool(nd.get("allowTransfer")),
                    "allow_add_sign": bool(nd.get("allowAddSign")),
                    "allow_edit_during_approval": bool(nd.get("allowEditDuringApproval")),
                }

        return {
            "has_flow": bool(process or instance),
            "has_instance": bool(instance),
            "status": instance.status if instance else None,
            "current_node": instance.current_node if instance else None,
            "current_approver_id": instance.current_approver_id if instance else None,
            "tasks": [
                {
                    "uuid": str(t.uuid),
                    "node_id": t.node_id,
                    "approver_id": t.approver_id,
                    "status": t.status,
                    "action_at": ApprovalInstanceService._format_dt_for_api(t.action_at),
                    "comment": t.comment,
                }
                for t in tasks
            ],
            "history": [
                {
                    "action": h.action,
                    "action_label": ApprovalInstanceService._execution_action_label(h.action),
                    "action_by": h.action_by,
                    "action_by_name": history_user_map.get(h.action_by, str(h.action_by)),
                    "action_at": ApprovalInstanceService._format_dt_for_api(h.action_at),
                    "comment": h.comment,
                    "from_node": h.from_node,
                    "to_node": h.to_node,
                    "change_payload": getattr(h, "change_payload", None),
                    "field_changes": (
                        (getattr(h, "change_payload", None) or {}).get("field_changes")
                        if h.action == "document_edit"
                        else None
                    ),
                }
                for h in history
            ],
            "process": process_payload,
            "instance": instance_payload,
            "nodes_overview": nodes_overview,
            "node_capabilities": node_capabilities,
            "can_edit_during_approval": can_edit_during_approval,
            "editable_fields": editable_fields,
        }

    @staticmethod
    async def execute_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        approved: bool,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        按 entity 执行审批（统一入口）

        查找该 entity 的待办任务，调用 perform_task_action。

        Returns:
            {"success": bool, "flow_completed": bool, "flow_rejected": bool, "instance": ApprovalInstance}
        """
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(100)

        instance = None
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                instance = inst
                break

        if not instance:
            raise NotFoundError(f"实体 {entity_type}:{entity_id} 未找到待审批的流程实例")

        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            approver_id=approver_id,
            status="pending",
        ).first()

        if not task:
            await ApprovalInstanceService.bootstrap_instance_workflow(
                tenant_id, instance
            )
            task = await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                approver_id=approver_id,
                status="pending",
            ).first()

        if not task:
            raise ValidationError("您没有该审批任务或任务已处理")

        action = ApprovalInstanceAction(
            action="approve" if approved else "reject",
            comment=comment,
        )
        updated = await ApprovalInstanceService.perform_task_action(
            tenant_id=tenant_id,
            task_uuid=str(task.uuid),
            user_id=approver_id,
            action_data=action,
        )

        return {
            "success": True,
            "flow_completed": updated.status in ("approved", "rejected"),
            "flow_rejected": updated.status == "rejected",
            "instance": updated,
        }

    @staticmethod
    async def cancel_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> bool:
        """
        取消/撤回审批流程（统一入口）
        若存在待审批的实例则取消，返回 True；否则返回 False。
        """
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            return False

        withdraw_node = instance.current_node
        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action="withdraw",
            action_by=operator_id,
            from_node=withdraw_node,
            to_node="start",
        )

        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            status="pending",
        ).update(status="cancelled")

        instance.status = "cancelled"
        instance.completed_at = resolve_business_datetime()
        instance.current_node = None
        instance.current_approver_id = None
        await instance.save()
        logger.info(f"审批流程已取消: {entity_type}:{entity_id}")
        return True

    @staticmethod
    async def _list_instances_by_entity(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        *,
        limit: int = 100,
    ) -> List[ApprovalInstance]:
        """同一业务单据的全部审批实例（新→旧）。"""
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(limit)

        matched: List[ApprovalInstance] = []
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                matched.append(inst)
        return matched

    @staticmethod
    async def _resolve_active_instance(
        entity_instances: List[ApprovalInstance],
    ) -> Optional[ApprovalInstance]:
        """优先返回 pending 实例，否则返回最近一条。"""
        for inst in entity_instances:
            if inst.status == "pending":
                return inst
        return entity_instances[0] if entity_instances else None

    @staticmethod
    async def get_instance_by_entity(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> Optional[ApprovalInstance]:
        """按 entity 查找审批实例（最近一条 pending，否则最近一条）。"""
        entity_instances = await ApprovalInstanceService._list_instances_by_entity(
            tenant_id, entity_type, entity_id
        )
        return await ApprovalInstanceService._resolve_active_instance(entity_instances)

    @staticmethod
    async def get_approval_instance_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ApprovalInstance:
        """
        根据UUID获取审批实例
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            
        Returns:
            ApprovalInstance: 审批实例对象
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).prefetch_related("process").first()
        
        if not approval_instance:
            raise NotFoundError("审批实例不存在")
        
        return approval_instance
    
    @staticmethod
    async def list_approval_instances(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        submitter_id: Optional[int] = None,
        current_approver_id: Optional[int] = None,
        keyword: Optional[str] = None,
    ) -> List[ApprovalInstance]:
        """
        获取审批实例列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            status: 审批状态筛选
            submitter_id: 提交人ID筛选
            current_approver_id: 当前审批人ID筛选
            
        Returns:
            List[ApprovalInstance]: 审批实例列表
        """
        query = ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        if submitter_id:
            query = query.filter(submitter_id=submitter_id)
        
        if current_approver_id:
            query = query.filter(current_approver_id=current_approver_id)

        query = apply_keyword_icontains(query, keyword, ["title", "content", "current_node"])
        
        return await query.prefetch_related("process").order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_approval_instance(
        tenant_id: int,
        uuid: str,
        data: ApprovalInstanceUpdate
    ) -> ApprovalInstance:
        """
        更新审批实例
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            data: 审批实例更新数据
            
        Returns:
            ApprovalInstance: 更新后的审批实例对象
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(approval_instance, key, value)
        
        await approval_instance.save()
        return approval_instance
    
    @staticmethod
    async def delete_approval_instance(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除审批实例（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        approval_instance.deleted_at = resolve_business_datetime()
        await approval_instance.save()
    
    @staticmethod
    async def perform_task_action(
        tenant_id: int,
        task_uuid: str,
        user_id: int,
        action_data: ApprovalInstanceAction
    ) -> ApprovalInstance:
        """
        执行审批任务操作（同意、拒绝、转交）
        
        Args:
            tenant_id: 组织ID
            task_uuid: 审批任务UUID
            user_id: 操作人ID
            action_data: 审批操作数据
            
        Returns:
            ApprovalInstance: 更新后的审批实例对象
        """
        # 获取任务
        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            uuid=task_uuid,
            approver_id=user_id,
            status="pending"
        ).prefetch_related("approval_instance__process").first()
        
        if not task:
            raise NotFoundError("任务不存在或已处理")

        if task.status == "suspended":
            raise ValidationError("当前任务已挂起，等待加签人审批")
            
        instance = task.approval_instance
        if instance.status != "pending":
            raise ValidationError("审批流程已结束")

        if action_data.action not in ("approve", "reject"):
            raise ValidationError(f"任务操作不支持: {action_data.action}")
            
        # 更新任务状态
        task.status = "approved" if action_data.action == "approve" else "rejected"
        task.action_at = resolve_business_datetime()
        task.comment = action_data.comment
        await task.save()

        from core.services.approval.approval_advanced_actions import ApprovalAdvancedActions

        if task.sign_type == "before" and action_data.action == "approve" and task.parent_task_id:
            await ApprovalAdvancedActions.resume_suspended_after_before_sign(
                tenant_id, instance, task.node_id, task.parent_task_id
            )
            return instance

        # 审核/驳回的执行记录以 ApprovalTask 为准，不再双写 ApprovalHistory（避免节点记录重复）
        
        # 检查节点是否完成
        node_completed, instance_status = await ApprovalInstanceService._check_node_completion(
            instance, action_data.action
        )
        
        if node_completed:
            if instance_status == "rejected":
                # 全盘拒绝
                instance.status = "rejected"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                
                # 取消该节点其他待办任务
                await ApprovalTask.filter(
                    approval_instance_id=instance.id,
                    node_id=instance.current_node,
                    status="pending"
                ).update(status="cancelled")
            else:
                # 节点通过，寻找下一个节点
                next_node = ApprovalInstanceService._get_next_node(
                    instance.process.nodes, instance.current_node, instance=instance
                )
                if not next_node:
                    instance.status = "approved"
                    instance.completed_at = resolve_business_datetime()
                    instance.current_node = None
                    instance.current_approver_id = None
                    await instance.save()
                else:
                    next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
                    if next_type == "end":
                        instance.status = "approved"
                        instance.completed_at = resolve_business_datetime()
                        instance.current_node = None
                        instance.current_approver_id = None
                        await instance.save()
                    else:
                        instance.current_node = next_node.get("id")
                        await instance.save()
                        await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)
            
            # 触发业务回调
            if instance.status in ["approved", "rejected"]:
                await ApprovalInstanceService._handle_approval_completion(tenant_id, instance)

        return instance

    @staticmethod
    async def _create_node_tasks(tenant_id: int, instance: ApprovalInstance, node: dict) -> List[ApprovalTask]:
        """
        为节点创建审批任务。start/end 不建任务；condition 不建任务，按条件选边后递归下一节点；cc 不建任务，发通知并推进到下一节点再递归。
        """
        node_type = node.get("type") or (node.get("data") or {}).get("type")
        node_id = node.get("id")

        if node_type == "start" or node_type == "end":
            return []

        if node_type == "condition":
            # 条件节点：不创建任务，按 instance.data 与节点 conditions 选一条出边，推进到下一节点再递归
            nodes_config = (instance.process.nodes or {}) if instance.process else {}
            next_node = ApprovalInstanceService._get_next_node(
                nodes_config, node_id, instance=instance
            )
            if not next_node:
                instance.status = "approved"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
            if next_type == "end":
                instance.status = "approved"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            instance.current_node = next_node.get("id")
            await instance.save()
            return await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)

        if node_type == "cc":
            # 抄送节点：不创建审批任务，可选通知抄送人，然后推进到下一节点
            try:
                approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
                if approvers:
                    asyncio.create_task(
                        ApprovalInstanceService._send_cc_notification(
                            tenant_id=tenant_id,
                            instance=instance,
                            node=node,
                            approver_ids=approvers,
                        )
                    )
            except Exception as e:
                logger.warning("抄送通知发送失败: %s", e)
            next_node = ApprovalInstanceService._get_next_node(
                instance.process.nodes, node_id, instance=instance
            )
            if not next_node:
                instance.status = "approved"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
            if next_type == "end":
                instance.status = "approved"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            instance.current_node = next_node.get("id")
            await instance.save()
            return await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)

        approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
        tasks = await ApprovalInstanceService._sync_node_approver_tasks(
            tenant_id, instance, node, approvers
        )

        if approvers:
            instance.current_approver_id = approvers[0]
            await instance.save()

        return tasks

    @staticmethod
    async def _sync_node_approver_tasks(
        tenant_id: int,
        instance: ApprovalInstance,
        node: dict,
        approvers: List[int] | None = None,
    ) -> List[ApprovalTask]:
        """为节点补齐缺失的 pending 审批任务（多指定用户/角色场景）。"""
        node_id = node.get("id")
        if not node_id:
            return []
        expected = approvers
        if expected is None:
            expected = await ApprovalInstanceService._resolve_node_approvers(node, instance)
        if not expected:
            return []

        existing = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            node_id=node_id,
            status="pending",
        ).all()
        existing_ids = {int(t.approver_id) for t in existing if t.approver_id is not None}
        tasks = list(existing)
        from core.services.approval.approval_advanced_actions import ApprovalAdvancedActions

        for approver_id in expected:
            if int(approver_id) in existing_ids:
                continue
            task = await ApprovalTask.create(
                tenant_id=tenant_id,
                approval_instance=instance,
                node_id=node_id,
                approver_id=int(approver_id),
                status="pending",
            )
            await ApprovalAdvancedActions.apply_task_due_at(task, node)
            tasks.append(task)
        return tasks

    @staticmethod
    def _identifier_looks_like_uuid(value: Union[str, int]) -> bool:
        s = str(value).strip()
        return len(s) >= 32 and "-" in s

    @staticmethod
    async def _resolve_approver_ids_from_identifiers(
        tenant_id: int,
        identifiers: List[Union[str, int]],
        by_uuid: bool | None = None,
    ) -> List[int]:
        """
        将审批人标识（UUID 或 user id）解析为 User.id 列表。
        by_uuid=None 时对每个标识分别判定 UUID / 数值 id。
        """
        if not identifiers:
            return []
        ids: List[int] = []
        for x in identifiers:
            if x is None:
                continue
            use_uuid = (
                ApprovalInstanceService._identifier_looks_like_uuid(x)
                if by_uuid is None
                else by_uuid
            )
            if use_uuid:
                try:
                    u = await User.filter(
                        tenant_id=tenant_id,
                        uuid=str(x).strip(),
                        deleted_at__isnull=True,
                        is_active=True,
                    ).first()
                    if u:
                        ids.append(u.id)
                except Exception:
                    pass
            else:
                try:
                    uid = int(x)
                    if uid > 0:
                        ids.append(uid)
                except (TypeError, ValueError):
                    pass
        return list(dict.fromkeys(ids))  # 去重保持顺序

    @staticmethod
    async def _filter_active_user_ids(tenant_id: int, user_ids: List[int]) -> List[int]:
        if not user_ids:
            return []
        active_ids = await User.filter(
            tenant_id=tenant_id,
            id__in=user_ids,
            deleted_at__isnull=True,
            is_active=True,
        ).values_list("id", flat=True)
        return list(dict.fromkeys(int(uid) for uid in active_ids if uid is not None))

    @staticmethod
    async def _resolve_managers_for_department_uuids(
        tenant_id: int,
        department_uuids: List[str],
    ) -> List[int]:
        uuids = [str(x).strip() for x in department_uuids if str(x).strip()]
        if not uuids:
            return []
        depts = await Department.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        manager_ids = list(
            dict.fromkeys(
                int(d.manager_id)
                for d in depts
                if getattr(d, "manager_id", None) and int(d.manager_id) > 0
            )
        )
        return await ApprovalInstanceService._filter_active_user_ids(tenant_id, manager_ids)

    @staticmethod
    async def _resolve_submitter_department_manager_ids(
        tenant_id: int,
        submitter_id: int,
        *,
        walk_parent: bool = True,
    ) -> List[int]:
        """发起人所属部门负责人；无负责人时可沿父部门向上查找。"""
        submitter = await User.filter(
            id=submitter_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        dept_id = getattr(submitter, "department_id", None) if submitter else None
        visited: set[int] = set()
        while dept_id and int(dept_id) not in visited:
            visited.add(int(dept_id))
            dept = await Department.filter(
                id=int(dept_id),
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                is_active=True,
            ).first()
            if not dept:
                break
            if getattr(dept, "manager_id", None) and int(dept.manager_id) > 0:
                active = await ApprovalInstanceService._filter_active_user_ids(
                    tenant_id, [int(dept.manager_id)]
                )
                if active:
                    return active
            if not walk_parent:
                break
            dept_id = getattr(dept, "parent_id", None)
        return []

    @staticmethod
    async def _resolve_node_approvers(node: dict, instance: ApprovalInstance) -> List[int]:
        """
        解析节点审批人。兼容前端 camelCase（approverType, approverIds）与后端 snake_case。
        支持：user（指定用户）、role（角色）、department（部门负责人）、manager（直属上级，用部门负责人）。
        """
        node_data = node.get("data", {})
        approver_type = (
            node_data.get("approverType")
            or node_data.get("approver_type")
            or "user"
        )
        approver_ids_raw = (
            node_data.get("approverIds")
            or node_data.get("approver_ids")
            or node_data.get("approvers")
            or node_data.get("roles")
            or node_data.get("departments")
            or node_data.get("user_ids")
            or []
        )
        if not approver_ids_raw and "approver_id" in node_data:
            approver_ids_raw = [node_data["approver_id"]]

        tenant_id = instance.tenant_id
        submitter_id = instance.submitter_id

        if approver_type == "user":
            ids = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                tenant_id, approver_ids_raw or [], by_uuid=None
            )
            if ids:
                return ids
            return [submitter_id]

        if approver_type == "role":
            # approverIds 存角色 UUID，解析该角色下所有用户
            try:
                role_uuids = [str(x).strip() for x in approver_ids_raw if x]
                if not role_uuids:
                    return [submitter_id]
                roles = await Role.filter(
                    tenant_id=tenant_id,
                    uuid__in=role_uuids,
                    deleted_at__isnull=True,
                    is_active=True,
                ).all()
                if not roles:
                    logger.warning("审批节点配置的角色未找到，回退到提交人")
                    return [submitter_id]
                role_ids = [r.id for r in roles]
                ur = await UserRole.filter(role_id__in=role_ids).values_list("user_id", flat=True)
                user_ids = list(dict.fromkeys(int(uid) for uid in ur if uid is not None))
                if user_ids:
                    active_ids = await User.filter(
                        tenant_id=tenant_id,
                        id__in=user_ids,
                        deleted_at__isnull=True,
                        is_active=True,
                    ).values_list("id", flat=True)
                    active = list(dict.fromkeys(int(uid) for uid in active_ids if uid is not None))
                    if active:
                        return active
            except Exception as e:
                logger.warning("解析角色审批人失败: %s，回退到提交人", e)
            return [submitter_id]

        if approver_type == "department":
            try:
                department_scope = str(
                    node_data.get("departmentScope")
                    or node_data.get("department_scope")
                    or "submitter"
                ).strip().lower()
                dept_uuids = [str(x).strip() for x in approver_ids_raw if str(x).strip()]
                if department_scope == "specified" and dept_uuids:
                    managers = await ApprovalInstanceService._resolve_managers_for_department_uuids(
                        tenant_id, dept_uuids
                    )
                    if managers:
                        return managers
                    logger.warning(
                        "审批节点指定部门未配置负责人或负责人不可用，回退到提交人"
                    )
                    return [submitter_id]
                managers = await ApprovalInstanceService._resolve_submitter_department_manager_ids(
                    tenant_id, submitter_id, walk_parent=True
                )
                if managers:
                    return managers
            except Exception as e:
                logger.warning("解析部门负责人失败: %s，回退到提交人", e)
            return [submitter_id]

        if approver_type == "manager":
            try:
                managers = await ApprovalInstanceService._resolve_submitter_department_manager_ids(
                    tenant_id, submitter_id, walk_parent=False
                )
                if managers:
                    return managers
            except Exception as e:
                logger.warning("解析直属上级失败: %s，回退到提交人", e)
            return [submitter_id]

        # optional 等未实现类型回退到提交人
        return [submitter_id]

    @staticmethod
    async def _check_node_completion(instance: ApprovalInstance, last_action: str) -> (bool, str):
        """
        检查节点是否完成
        返回: (是否完成, 建议状态)
        """
        node_id = instance.current_node
        process_nodes = instance.process.nodes or {}
        
        # 查找当前节点配置
        current_node_config = None
        for node in process_nodes.get("nodes", []):
            if node.get("id") == node_id:
                current_node_config = node
                break
                
        if not current_node_config:
            return True, "approved"

        data = current_node_config.get("data", {})
        approval_type = data.get("approvalType") or data.get("approval_type") or "OR"  # AND 会签, OR 或签
        
        # 获取该节点所有任务
        tasks = await ApprovalTask.filter(approval_instance=instance, node_id=node_id).all()
        active = [t for t in tasks if t.status not in ("transferred", "suspended", "cancelled")]
        
        if last_action == "reject":
            return True, "rejected" # 只要有一个拒绝，立即节点拒绝
            
        if any(t.status == "pending" for t in active):
            return False, "pending"

        if approval_type == "OR":
            if any(t.status == "approved" for t in active):
                return True, "approved"
        else:
            if active and all(t.status == "approved" for t in active):
                return True, "approved"
                
        return False, "pending"

    @staticmethod
    async def perform_approval_action(
        tenant_id: int,
        uuid: str,
        user_id: int,
        action: ApprovalInstanceAction
    ) -> ApprovalInstance:
        """执行审批操作（兼容旧接口）"""
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        
        # 兼容逻辑：如果系统已生成任务，则转发到任务处理函数
        tasks_count = await ApprovalTask.filter(tenant_id=tenant_id, approval_instance_id=approval_instance.id, status="pending").count()
        if tasks_count > 0:
            task = await ApprovalTask.filter(tenant_id=tenant_id, approval_instance_id=approval_instance.id, approver_id=user_id, status="pending").first()
            if task:
                return await ApprovalInstanceService.perform_task_action(tenant_id, str(task.uuid), user_id, action)
            raise ValidationError("您没有该审批的任务")
            
        # 验证操作权限（仅针对无任务系统的情况）
        if approval_instance.status != "pending":
            raise ValidationError("审批实例已完成，无法操作")
        
        if approval_instance.current_approver_id != user_id:
            raise ValidationError("您不是当前审批人，无法操作")
            
        # 记录操作前的状态用于后续通知和历史
        old_node = approval_instance.current_node
        old_approver_id = approval_instance.current_approver_id
        old_status = approval_instance.status
        old_current_approver_id = approval_instance.current_approver_id
        
        # 获取审批流程
        await approval_instance.fetch_related('process')
        process = approval_instance.process
        
        # 执行操作
        if action.action == "approve":
            next_node = ApprovalInstanceService._get_next_node(
                process.nodes, approval_instance.current_node, instance=approval_instance
            )
            if next_node:
                approval_instance.current_node = next_node.get("id")
                approval_instance.current_approver_id = ApprovalInstanceService._get_node_approver(next_node, approval_instance)
                approval_instance.status = "pending"
            else:
                approval_instance.status = "approved"
                approval_instance.completed_at = resolve_business_datetime()
                approval_instance.current_node = None
                approval_instance.current_approver_id = None
        elif action.action == "reject":
            approval_instance.status = "rejected"
            approval_instance.completed_at = resolve_business_datetime()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "cancel":
            approval_instance.status = "cancelled"
            approval_instance.completed_at = resolve_business_datetime()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "transfer":
            if not action.transfer_to_user_id:
                raise ValidationError("转交操作必须指定目标用户")
            approval_instance.current_approver_id = action.transfer_to_user_id
        
        await approval_instance.save()
        
        # 记录审批历史
        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=approval_instance.id,
            action=action.action,
            action_by=user_id,
            comment=action.comment,
            from_node=old_node,
            to_node=approval_instance.current_node,
            from_approver_id=old_approver_id,
            to_approver_id=approval_instance.current_approver_id
        )
        
        # 如果审批完成（approved/rejected），触发业务回调
        if approval_instance.status in ["approved", "rejected"]:
            await ApprovalInstanceService._handle_approval_completion(
                tenant_id=tenant_id,
                approval_instance=approval_instance
            )
        
        # 异步发送消息通知
        import asyncio
        asyncio.create_task(
            ApprovalInstanceService._send_approval_action_notification(
                tenant_id=tenant_id,
                approval_instance=approval_instance,
                action=action,
                user_id=user_id,
                old_status=old_status,
                old_current_approver_id=old_current_approver_id
            )
        )

        return approval_instance

    @staticmethod
    async def batch_perform_approval_actions(
        tenant_id: int,
        user_id: int,
        *,
        instance_uuids: List[str],
        action: str,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """批量执行审批操作（逐条处理，失败不中断）。"""
        from core.schemas.approval_instance import ApprovalInstanceAction

        successes = 0
        failures: List[Dict[str, Any]] = []
        for uuid in instance_uuids:
            uid = str(uuid or "").strip()
            if not uid:
                failures.append({"uuid": uuid, "error": "UUID 为空"})
                continue
            try:
                await ApprovalInstanceService.perform_approval_action(
                    tenant_id=tenant_id,
                    uuid=uid,
                    user_id=user_id,
                    action=ApprovalInstanceAction(action=action, comment=comment),
                )
                successes += 1
            except Exception as exc:
                failures.append({"uuid": uid, "error": str(exc)})
        return {
            "success_count": successes,
            "failure_count": len(failures),
            "failures": failures,
        }

    @staticmethod
    def _approval_detail_path(instance: ApprovalInstance) -> str:
        return f"/personal/tasks?highlight={instance.id}"

    @staticmethod
    async def _send_internal_to_user(
        *,
        tenant_id: int,
        user_id: int,
        subject: str,
        content: str,
        trigger_action: str,
        instance: ApprovalInstance,
        template_code: Optional[str] = None,
        extra_variables: Optional[Dict[str, Any]] = None,
    ) -> None:
        """审批站内信：recipient 必须为用户 ID（不走邮件）。"""
        variables: Dict[str, Any] = {
            "message_category": "approval",
            "trigger_document": "approval",
            "trigger_action": trigger_action,
            "detail_path": ApprovalInstanceService._approval_detail_path(instance),
            "approval_instance_id": str(instance.id),
            "title": instance.title or "",
        }
        if extra_variables:
            variables.update({k: str(v) for k, v in extra_variables.items()})
        req_kwargs: Dict[str, Any] = dict(
            type="internal",
            recipient=str(user_id),
            subject=subject,
            content=content,
            variables=variables,
        )
        if template_code:
            req_kwargs["template_code"] = template_code
        try:
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(**req_kwargs),
            )
        except NotFoundError:
            # 模板未加载时回落明文站内信，避免审批通知静默失败
            req_kwargs.pop("template_code", None)
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(**req_kwargs),
            )

    @staticmethod
    async def _send_cc_notification(
        tenant_id: int,
        instance: ApprovalInstance,
        node: dict,
        approver_ids: List[int],
    ) -> None:
        """抄送节点：给抄送人发站内信。"""
        try:
            await instance.fetch_related("process")
            process = instance.process
            node_label = (node.get("data") or {}).get("label") or "抄送"
            for uid in approver_ids[:50]:
                u = await User.filter(
                    id=uid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if not u:
                    continue
                await ApprovalInstanceService._send_internal_to_user(
                    tenant_id=tenant_id,
                    user_id=u.id,
                    subject=f"抄送：{instance.title}",
                    content=f"您被抄送审批「{instance.title}」，节点：{node_label}，流程：{process.name}。",
                    trigger_action="cc",
                    instance=instance,
                    extra_variables={"process_name": process.name, "node_label": node_label},
                )
        except Exception as e:
            logger.warning("抄送通知失败: %s", e)

    @staticmethod
    async def _send_urge_notification(
        tenant_id: int,
        instance: ApprovalInstance,
        approver_ids: List[int],
        comment: Optional[str] = None,
    ) -> None:
        """催办/超时：通知待办审批人（站内信）。"""
        try:
            await instance.fetch_related("process")
            process = instance.process
            body = comment or f"请尽快处理审批「{instance.title}」"
            for uid in approver_ids[:50]:
                u = await User.filter(
                    id=uid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if not u:
                    continue
                await ApprovalInstanceService._send_internal_to_user(
                    tenant_id=tenant_id,
                    user_id=u.id,
                    subject=f"催办：{instance.title}",
                    content=f"{body}（流程：{process.name}）",
                    trigger_action="urge",
                    instance=instance,
                    template_code="approval_urge",
                    extra_variables={
                        "process_name": process.name,
                        "comment": body,
                    },
                )
        except Exception as e:
            logger.warning("催办通知失败: %s", e)

    @staticmethod
    async def _send_approval_submitted_notification(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        process: ApprovalProcess
    ) -> None:
        """提交后仅通知当前审批人（待办）；不给提交人刷「已提交」以免打扰。"""
        try:
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if not approval_instance.current_approver_id:
                return
            approver = await User.filter(
                id=approval_instance.current_approver_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            if not approver:
                return
            submitter_name = (
                (submitter.full_name or submitter.username) if submitter else "—"
            )
            await ApprovalInstanceService._send_internal_to_user(
                tenant_id=tenant_id,
                user_id=approver.id,
                subject=f"待审批：{approval_instance.title}",
                content=(
                    f"您有一个待审批的申请：{approval_instance.title}，"
                    f"提交人：{submitter_name}，流程：{process.name}。"
                ),
                trigger_action="pending",
                instance=approval_instance,
                template_code="approval_pending",
                extra_variables={
                    "submitter_name": submitter_name,
                    "process_name": process.name,
                },
            )
        except Exception as e:
            logger.error(f"发送审批提交通知失败: {str(e)}")
    
    @staticmethod
    async def _send_approval_action_notification(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        action: ApprovalInstanceAction,
        user_id: int,
        old_status: str,
        old_current_approver_id: Optional[int]
    ) -> None:
        """
        审批操作通知（站内信，少打扰）：
        - 驳回 → 通知提交人
        - 进入下一审批人 / 转交 → 通知新审批人
        - 通过/取消 → 不额外刷成功信
        """
        try:
            await approval_instance.fetch_related('process')
            process = approval_instance.process
            
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            operator = await User.filter(
                id=user_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            operator_name = (
                (operator.full_name or operator.username) if operator else "系统"
            )
            comment_text = action.comment or ""

            if action.action == "reject" and submitter:
                await ApprovalInstanceService._send_internal_to_user(
                    tenant_id=tenant_id,
                    user_id=submitter.id,
                    subject=f"审批已拒绝：{approval_instance.title}",
                    content=(
                        f"您的审批「{approval_instance.title}」已被{operator_name}拒绝"
                        f"{('，备注：' + comment_text) if comment_text else ''}。"
                        f"流程：{process.name}。"
                    ),
                    trigger_action="rejected",
                    instance=approval_instance,
                    template_code="approval_rejected",
                    extra_variables={
                        "submitter_name": submitter.full_name or submitter.username or "",
                        "approver_name": operator_name,
                        "rejected_at": str(action.created_at or ""),
                        "comment": comment_text or "—",
                        "process_name": process.name,
                    },
                )

            if (
                approval_instance.current_approver_id
                and approval_instance.current_approver_id != old_current_approver_id
                and approval_instance.status == "pending"
            ):
                new_approver = await User.filter(
                    id=approval_instance.current_approver_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                if new_approver:
                    submitter_name = (
                        (submitter.full_name or submitter.username) if submitter else "—"
                    )
                    await ApprovalInstanceService._send_internal_to_user(
                        tenant_id=tenant_id,
                        user_id=new_approver.id,
                        subject=f"待审批：{approval_instance.title}",
                        content=(
                            f"您有一个待审批的申请：{approval_instance.title}，"
                            f"提交人：{submitter_name}，流程：{process.name}。"
                        ),
                        trigger_action="pending",
                        instance=approval_instance,
                        template_code="approval_pending",
                        extra_variables={
                            "submitter_name": submitter_name,
                            "process_name": process.name,
                        },
                    )
        except Exception as e:
            logger.error(f"发送审批操作通知失败: {str(e)}")
    

    @staticmethod
    def _evaluate_conditions(instance: ApprovalInstance, conditions: List[Dict[str, Any]]) -> int:
        """
        按顺序评估条件，返回第一条满足条件的下标；若无满足则返回 0（默认第一条出边）。
        条件项：{ "field": str, "operator": str, "value": any }，instance.data 提供字段值。
        """
        if not conditions:
            return 0
        data = instance.data or {}
        for i, cond in enumerate(conditions):
            if not isinstance(cond, dict):
                continue
            field = cond.get("field")
            operator = cond.get("operator")
            value = cond.get("value")
            if field is None:
                continue
            actual = data.get(field)
            try:
                if operator == "==" or operator == "eq":
                    if actual == value or str(actual) == str(value):
                        return i
                elif operator == "!=" or operator == "ne":
                    if actual != value and str(actual) != str(value):
                        return i
                elif operator in (">", "gt"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual > value:
                                return i
                elif operator in ("<", "lt"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual < value:
                                return i
                elif operator in (">=", "gte"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual >= value:
                                return i
                elif operator in ("<=", "lte"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual <= value:
                                return i
                elif operator == "contains":
                    if value is not None and actual is not None and str(value) in str(actual):
                        return i
            except (TypeError, ValueError):
                continue
        return 0

    @staticmethod
    def _get_start_node(nodes: dict) -> Optional[dict]:
        """
        获取起始节点。支持 ProFlow 格式：nodes = { "nodes": [...], "edges": [...] }。
        """
        if not nodes:
            return None
        node_list = nodes.get("nodes", [])
        if not node_list:
            return None
        for node in node_list:
            if not isinstance(node, dict):
                continue
            if node.get("type") == "start" or node.get("id") == "start":
                return node
        return node_list[0] if node_list else None

    @staticmethod
    def _get_next_node(
        nodes: dict,
        current_node_id: Optional[str],
        instance: Optional[ApprovalInstance] = None,
    ) -> Optional[dict]:
        """
        获取下一个节点。支持 ProFlow 格式；当前节点为 condition 时按 instance.data 与 conditions 选边。
        """
        if not nodes or not current_node_id:
            return None
        node_list = nodes.get("nodes", [])
        edges = nodes.get("edges", []) or []
        out_edges = [e for e in edges if isinstance(e, dict) and e.get("source") == current_node_id]
        if not out_edges:
            return None

        current_node = next((n for n in node_list if isinstance(n, dict) and n.get("id") == current_node_id), None)
        node_type = (current_node or {}).get("type") if isinstance(current_node, dict) else None

        # 条件节点：按条件选一条出边
        if node_type == "condition" and instance and current_node:
            data = current_node.get("data", {})
            conditions = data.get("conditions") or data.get("condition_list") or []
            edge_index = ApprovalInstanceService._evaluate_conditions(instance, conditions)
            if 0 <= edge_index < len(out_edges):
                next_node_id = out_edges[edge_index].get("target")
            else:
                next_node_id = out_edges[0].get("target")
        else:
            next_node_id = out_edges[0].get("target")

        if not next_node_id:
            return None
        next_node = next((n for n in node_list if isinstance(n, dict) and n.get("id") == next_node_id), None)
        return next_node
    
    @staticmethod
    def _get_node_approver(node: dict, approval_instance: ApprovalInstance) -> Optional[int]:
        """
        获取节点审批人
        
        Args:
            node: 节点配置
            approval_instance: 审批实例
            
        Returns:
            Optional[int]: 审批人ID
        """
        if not isinstance(node, dict):
            return None
        
        # 从节点配置中获取审批人
        approver_config = node.get("approver", {})
        if isinstance(approver_config, dict):
            # 支持多种审批人配置方式
            if "user_id" in approver_config:
                return approver_config["user_id"]
            elif "role_id" in approver_config:
                # TODO: 根据角色获取用户
                pass
            elif "department_id" in approver_config:
                # TODO: 根据部门获取用户
                pass
        
        # 如果节点配置中没有审批人，使用提交人作为默认审批人（临时方案）
        return approval_instance.submitter_id
    
    @staticmethod
    async def _create_approval_history(
        tenant_id: int,
        approval_instance_id: int,
        action: str,
        action_by: int,
        comment: Optional[str] = None,
        from_node: Optional[str] = None,
        to_node: Optional[str] = None,
        from_approver_id: Optional[int] = None,
        to_approver_id: Optional[int] = None
    ) -> None:
        """
        创建审批历史记录
        
        Args:
            tenant_id: 组织ID
            approval_instance_id: 审批实例ID
            action: 操作类型
            action_by: 操作人ID
            comment: 审批意见
            from_node: 来源节点
            to_node: 目标节点
            from_approver_id: 原审批人ID
            to_approver_id: 新审批人ID
        """
        try:
            await ApprovalHistory.create(
                tenant_id=tenant_id,
                approval_instance_id=approval_instance_id,
                action=action,
                action_by=action_by,
                action_at=resolve_business_datetime(),
                comment=comment,
                from_node=from_node,
                to_node=to_node,
                from_approver_id=from_approver_id,
                to_approver_id=to_approver_id
            )
        except Exception as e:
            # 记录历史失败不影响审批操作
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"创建审批历史记录失败: {str(e)}")
    
    @staticmethod
    async def _handle_approval_completion(
        tenant_id: int,
        approval_instance: ApprovalInstance
    ) -> None:
        """
        处理审批完成后的业务回调（实体注册表驱动）
        """
        try:
            data = approval_instance.data or {}
            entity_type = data.get("entity_type")
            entity_id = data.get("entity_id")
            entity_uuid = data.get("entity_uuid")

            if not entity_type:
                return

            # 获取最后审批人（从 ApprovalHistory）
            last_history = (
                await ApprovalHistory.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=approval_instance.id,
                )
                .order_by("-action_at")
                .first()
            )
            approver_id = last_history.action_by if last_history else approval_instance.submitter_id

            async def _handle_sales_order() -> None:
                from apps.kuaizhizao.models.sales_order import SalesOrder
                order = await SalesOrder.filter(tenant_id=tenant_id, uuid=entity_uuid, deleted_at__isnull=True).first()
                if not order:
                    return
                from apps.kuaizhizao.services.sales_order_service import SalesOrderService
                service = SalesOrderService()
                if approval_instance.status == "approved":
                    await service.approve_sales_order(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        approved_by=approver_id,
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_sales_order(
                        tenant_id=tenant_id,
                        sales_order_id=order.id,
                        approved_by=approver_id,
                        rejection_reason="审批驳回",
                    )
                logger.info(f"销售订单 {order.id} 审批回调完成: {approval_instance.status}")

            async def _handle_demand() -> None:
                from apps.kuaizhizao.models.demand import Demand
                from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
                if not demand:
                    return
                approver = await User.get_or_none(id=approver_id)
                approver_name = (
                    (approver.full_name or approver.username or f"用户{approver_id}").strip()
                    if approver
                    else f"用户{approver_id}"
                )
                remark = "审批通过" if approval_instance.status == "approved" else "审批驳回"
                await Demand.filter(tenant_id=tenant_id, id=entity_id).update(
                    reviewer_id=approver_id,
                    reviewer_name=approver_name,
                    review_time=resolve_business_datetime(),
                    review_status=ReviewStatus.APPROVED.value if approval_instance.status == "approved" else ReviewStatus.REJECTED.value,
                    review_remarks=remark,
                    status=DemandStatus.AUDITED.value if approval_instance.status == "approved" else DemandStatus.REJECTED.value,
                    updated_by=approver_id,
                )
                logger.info(f"需求 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_purchase_order() -> None:
                from apps.kuaizhizao.models.purchase_order import PurchaseOrder
                from apps.kuaizhizao.constants import ReviewStatus, DocumentStatus
                order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
                if not order:
                    return
                approver = await User.get_or_none(id=approver_id)
                approver_name = (
                    (approver.full_name or approver.username or f"用户{approver_id}").strip()
                    if approver
                    else f"用户{approver_id}"
                )
                remark = "审批通过" if approval_instance.status == "approved" else "审批驳回"
                await PurchaseOrder.filter(tenant_id=tenant_id, id=entity_id).update(
                    reviewer_id=approver_id,
                    reviewer_name=approver_name,
                    review_time=resolve_business_datetime(),
                    review_status=ReviewStatus.APPROVED.value if approval_instance.status == "approved" else ReviewStatus.REJECTED.value,
                    review_remarks=remark,
                    status=DocumentStatus.AUDITED.value if approval_instance.status == "approved" else DocumentStatus.REJECTED.value,
                    updated_by=approver_id,
                )
                logger.info(f"采购订单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_bom_change() -> None:
                from apps.master_data.models.bom_change import BOMChange
                from apps.master_data.services.bom_change_service import BOMChangeService

                change = await BOMChange.filter(
                    tenant_id=tenant_id,
                    id=entity_id,
                    deleted_at__isnull=True,
                ).first()
                if not change:
                    return
                approved = approval_instance.status == "approved"
                await BOMChangeService._apply_approval_decision(
                    tenant_id,
                    str(change.uuid),
                    approver_id,
                    approved,
                    "审批通过" if approved else "审批驳回",
                )
                logger.info(f"BOM 工程变更 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_process_route_change() -> None:
                from apps.master_data.models.process_route_change import ProcessRouteChange
                from apps.master_data.services.process_route_change_service import ProcessRouteChangeService

                change = await ProcessRouteChange.filter(
                    tenant_id=tenant_id,
                    id=entity_id,
                    deleted_at__isnull=True,
                ).first()
                if not change:
                    return
                approved = approval_instance.status == "approved"
                await ProcessRouteChangeService._apply_approval_decision(
                    tenant_id,
                    str(change.uuid),
                    approver_id,
                    approved,
                    "审批通过" if approved else "审批驳回",
                )
                logger.info(f"工艺路线变更 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_quotation() -> None:
                from apps.kuaizhizao.models.quotation import Quotation
                from apps.kuaizhizao.services.quotation_service import QuotationService

                quotation = await Quotation.get_or_none(
                    tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
                )
                if not quotation:
                    return
                service = QuotationService()
                if approval_instance.status == "approved":
                    await service.approve_quotation(
                        tenant_id=tenant_id,
                        quotation_id=quotation.id,
                        operator_id=approver_id,
                        review_remarks="审批通过",
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_quotation(
                        tenant_id=tenant_id,
                        quotation_id=quotation.id,
                        operator_id=approver_id,
                        review_remarks="审批驳回",
                    )
                logger.info(f"报价单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_kuaioa_form_request() -> None:
                from apps.kuaioa.services.form_service import apply_form_request_decision

                approved = approval_instance.status == "approved"
                await apply_form_request_decision(
                    tenant_id, entity_id, approved, approver_id
                )
                logger.info(f"轻办公申请单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_kuaioa_asset_purchase() -> None:
                from apps.kuaioa.services.asset_service import apply_asset_purchase_decision

                approved = approval_instance.status == "approved"
                await apply_asset_purchase_decision(
                    tenant_id, entity_id, approved, approver_id
                )
                logger.info(f"固定资产采买 {entity_id} 审批回调完成: {approval_instance.status}")

            completion_handlers = {
                "sales_order": _handle_sales_order,
                "demand": _handle_demand,
                "purchase_order": _handle_purchase_order,
                "bom_change": _handle_bom_change,
                "process_route_change": _handle_process_route_change,
                "quotation": _handle_quotation,
                "kuaioa_form_request": _handle_kuaioa_form_request,
                "kuaioa_asset_purchase": _handle_kuaioa_asset_purchase,
            }
            handler = completion_handlers.get(entity_type)
            if handler:
                await handler()

        except Exception as e:
            logger.error(f"处理审批完成回调失败: {str(e)}")

