"""
审批实例管理服务模块

提供审批实例的 CRUD 操作和审批操作功能。
统一入口：start_approval、get_approval_status、execute_approval 供业务单据调用。

审核生命周期（提交→建任务→通过/驳回→业务写回）均在 API 请求内同步完成，不依赖 Taskiq Worker。
Worker 仅用于消息通知等可选后台任务（_spawn_background，空 context 以免继承事务连接）。
"""

import asyncio
import contextvars
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from datetime import datetime
from typing import Optional, List, Dict, Any, Union, Set
from uuid import UUID
from loguru import logger

from core.models.approval_history import ApprovalHistory

from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

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
    def _spawn_background(coro):
        """
        在空 contextvars 中创建 Task，避免继承当前 Tortoise 事务连接。

        若在 in_transaction 内 asyncio.create_task 发站内信等 DB 操作，
        子任务会共用同一 asyncpg 连接，触发
        「cannot perform operation: another operation is in progress」。

        Tortoise 的 `_conn_storage` 以可变 `{}` 作 ContextVar default，空 context
        若直接 get 会与其它未 set 的上下文共享同一 dict；此处显式 set 新 storage，
        并复用父上下文里的池客户端（剥掉 TransactionWrapper），避免再建池或撞事务连接。
        """
        from tortoise.connection import connections as tortoise_connections

        parent_storage = tortoise_connections._copy_storage()
        clean_storage: Dict[str, Any] = {}
        for alias, client in parent_storage.items():
            clean_storage[alias] = getattr(client, "_parent", client)

        async def _isolated() -> None:
            tortoise_connections._set_storage(dict(clean_storage))
            try:
                await coro
            except Exception:
                logger.exception("审批后台任务失败")

        def _start():
            tortoise_connections._set_storage(dict(clean_storage))
            return asyncio.create_task(_isolated())

        return contextvars.Context().run(_start)
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
        if raw in {"recall_own", "recallown"}:
            return "recall_own"
        if raw in {"revoke", "revoked", "unapprove"}:
            return "revoke"
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
        if raw in {"condition_route", "condition", "branch"}:
            return "condition_route"
        return raw or "unknown"

    @staticmethod
    def _execution_action_label(action: Optional[str]) -> str:
        key = ApprovalInstanceService._normalize_execution_action(action)
        labels = {
            "approve": "审核通过",
            "reject": "驳回",
            "cancel": "已取消",
            "withdraw": "撤回",
            "recall_own": "撤回本级",
            "revoke": "撤销审核",
            "transfer": "转交",
            "submit": "提交",
            "document_edit": "审核中修改",
            "add_sign": "加签",
            "delegate": "委托",
            "urge": "催办",
            "timeout_escalate": "超时升级",
            "condition_route": "条件分支",
            "unknown": "未知操作",
        }
        return labels.get(key, labels["unknown"])
    
    @staticmethod
    async def create_approval_instance(
        tenant_id: int,
        user_id: int,
        data: ApprovalInstanceCreate,
        *,
        send_notification: bool = True,
    ) -> ApprovalInstance:
        """
        创建审批实例（提交审批）

        Args:
            tenant_id: 组织ID
            user_id: 提交人ID
            data: 审批实例创建数据
            send_notification: 是否在创建后立即异步发待办通知。
                业务若还需继续写库（如改单据状态），应传 False，待主链路结束后再
                `notify_approval_submitted`，避免与主请求并发撞 asyncpg 连接。

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
            from core.services.approval.approval_audit_scope import enrich_instance_data_audit_app

            instance_data = enrich_instance_data_audit_app(
                data.data if isinstance(data.data, dict) else {},
                process_code=process.code,
            )
            approval_instance = ApprovalInstance(
                tenant_id=tenant_id,
                process=process,
                title=data.title,
                content=data.content,
                data=instance_data,
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

            if send_notification:
                ApprovalInstanceService.notify_approval_submitted(
                    tenant_id=tenant_id,
                    approval_instance=approval_instance,
                    process=process,
                )

            return approval_instance
        except IntegrityError:
            raise ValidationError("创建审批实例失败")

    @staticmethod
    def notify_approval_submitted(
        *,
        tenant_id: int,
        approval_instance: ApprovalInstance,
        process: Optional[ApprovalProcess] = None,
    ) -> None:
        """提交审批后的待办通知（后台；须在业务主链路写库完成之后调用）。"""
        ApprovalInstanceService._spawn_background(
            ApprovalInstanceService._send_approval_submitted_notification(
                tenant_id=tenant_id,
                approval_instance=approval_instance,
                process=process,
            )
        )

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

        # 先清掉非当前节点残留 pending，再计数/补齐，避免上一节点待办干扰推进与门禁文案
        if approval_instance.current_node:
            await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=approval_instance.id,
                status="pending",
            ).exclude(node_id=str(approval_instance.current_node)).update(status="cancelled")

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
                        # 或签已通过却仍挂 pending 等同节点任务：按完成规则推进（收敛历史卡住实例）
                        await ApprovalInstanceService._reconcile_current_node_completion(
                            tenant_id, approval_instance
                        )
                        return True
                    await ApprovalInstanceService._create_node_tasks(
                        tenant_id,
                        approval_instance,
                        current_node,
                        on_missing_branch="stop",
                    )
                    return True

        if pending_count > 0:
            return False

        start_node = ApprovalInstanceService._get_start_node(nodes)
        if not start_node:
            raise ValidationError("审批流程没有起始节点")

        start_id = start_node.get("id")
        next_node = ApprovalInstanceService._get_next_node(
            nodes,
            start_id,
            instance=approval_instance,
            on_missing_branch="stop",
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
            tenant_id,
            approval_instance,
            next_node,
            on_missing_branch="stop",
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
        *,
        send_notification: bool = True,
        business_type: Optional[str] = None,
        selected_approver_user_ids: Optional[List[int]] = None,
        selected_approver_by_node: Optional[Dict[str, List[int]]] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[ApprovalInstance]:
        """
        按 process_code 启动审批流程（统一入口）

        若流程不存在则返回 None，调用方走简单审核；若流程存在则创建实例并返回。

        selected_approver_*：发起时勾选人员快照，写入实例 data，节点解析优先使用。
        """
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=process_code,
            is_active=True,
            deleted_at__isnull=True,
        ).first()

        if not process:
            return None

        from core.services.approval.audit_submit_requirements import (
            list_initiator_branch_conditions_in_graph,
        )

        payload: Dict[str, Any] = {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_uuid": entity_uuid,
        }
        if business_type:
            payload["business_type"] = str(business_type).strip()
        if extra_data:
            payload.update(extra_data)

        from core.services.approval.audit_submit_context import get_submit_branch_by_node
        from core.services.approval.audit_submit_selection import merge_branch_selection_into_instance_data

        branch_ctx = get_submit_branch_by_node()
        if branch_ctx:
            payload = merge_branch_selection_into_instance_data(payload, branch_ctx)

        required_branches = list_initiator_branch_conditions_in_graph(process.nodes or {})
        for item in required_branches:
            cond_id = str(item.get("condition_node_id") or "").strip()
            if not cond_id:
                continue
            index_key = ApprovalInstanceService._condition_branch_index_key(cond_id)
            if index_key not in payload:
                label = str(item.get("label") or cond_id)
                raise ValidationError(f"提交审批须选择「{label}」分支")

        snapshot_ids: List[int] = []
        if selected_approver_user_ids:
            snapshot_ids.extend(int(x) for x in selected_approver_user_ids if int(x) > 0)
        by_node: Dict[str, List[int]] = {}
        if selected_approver_by_node:
            for node_id, ids in selected_approver_by_node.items():
                cleaned = [int(x) for x in (ids or []) if int(x) > 0]
                if cleaned:
                    by_node[str(node_id)] = cleaned
                    snapshot_ids.extend(cleaned)
        if snapshot_ids or by_node:
            unique_ids = list(dict.fromkeys(snapshot_ids))
            name_map = await ApprovalInstanceService._user_display_map(tenant_id, unique_ids)
            payload["selected_approver_user_ids"] = unique_ids
            payload["selected_approver_by_node"] = by_node
            payload["selected_approver_snapshot"] = {
                "user_ids": unique_ids,
                "names": {str(uid): name_map.get(uid, str(uid)) for uid in unique_ids},
                "by_node": by_node,
            }

        data = ApprovalInstanceCreate(
            process_uuid=str(process.uuid),
            title=title,
            content=content or "",
            data=payload,
        )
        from core.services.approval.audit_context_builder import build_audit_context

        ctx = await build_audit_context(tenant_id, entity_type, entity_id)
        if ctx:
            data.data.update(ctx)
        return await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id,
            user_id=user_id,
            data=data,
            send_notification=send_notification,
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
        *,
        send_notification: bool = True,
        business_type: Optional[str] = None,
        selected_approver_user_ids: Optional[List[int]] = None,
        selected_approver_by_node: Optional[Dict[str, List[int]]] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[ApprovalInstance]:
        """
        按 manifest node_key 解析审核绑定并启动审批（统一入口，避免业务层硬编码 process_code）。
        若传入 business_type，优先按 entity_type+business_type 解析声明中的 node_key。
        """
        from core.config.audit_registry import entry_by_entity_type_and_business
        from core.services.approval.audit_binding_service import AuditBindingService

        resolved_key = node_key
        if business_type:
            entry = entry_by_entity_type_and_business(entity_type, business_type)
            if entry:
                resolved_key = entry.node_key

        process = await AuditBindingService.resolve_process_for_node(tenant_id, resolved_key)
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
            send_notification=send_notification,
            business_type=business_type,
            selected_approver_user_ids=selected_approver_user_ids,
            selected_approver_by_node=selected_approver_by_node,
            extra_data=extra_data,
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
    def node_display_label(instance: Optional[ApprovalInstance]) -> Optional[str]:
        """当前节点展示名：流程图 data.label（与 nodes_overview 同一读法）。"""
        if instance is None:
            return None
        node_id = str(instance.current_node or "").strip()
        if not node_id:
            return None
        process = getattr(instance, "process", None)
        graph = ApprovalInstanceService._normalize_process_graph(
            getattr(process, "nodes", None) if process is not None else None
        )
        for node in graph.get("nodes") or []:
            if not isinstance(node, dict):
                continue
            if str(node.get("id") or "") != node_id:
                continue
            data = node.get("data") if isinstance(node.get("data"), dict) else {}
            label = str(data.get("label") or "").strip()
            return label or None
        return None

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
    def _graph_node_ids_reachable_from(graph: Dict[str, Any], source_id: Optional[str]) -> Set[str]:
        """从 source 沿边正向可达的全部节点（含 source 自身）。"""
        if not source_id:
            return set()
        edges = graph.get("edges") or []
        source_id = str(source_id)
        seen = {source_id}
        queue = [source_id]
        while queue:
            nid = queue.pop(0)
            for edge in edges:
                if not isinstance(edge, dict) or edge.get("source") != nid:
                    continue
                tgt = str(edge.get("target") or "")
                if tgt and tgt not in seen:
                    seen.add(tgt)
                    queue.append(tgt)
        return seen

    @staticmethod
    def _graph_node_ids_on_some_path_to_target(graph: Dict[str, Any], target_id: Optional[str]) -> Set[str]:
        """从 start 能走到 target 的路径上可能出现的节点（forward ∩ backward）。"""
        if not target_id:
            return set()
        edges = graph.get("edges") or []
        start = ApprovalInstanceService._get_start_node(graph)
        start_id = str(start.get("id") or "") if start else ""
        if not start_id:
            return set()
        target_id = str(target_id)

        def bfs_backward(sink: str) -> Set[str]:
            seen = {sink}
            queue = [sink]
            while queue:
                nid = queue.pop(0)
                for edge in edges:
                    if not isinstance(edge, dict) or edge.get("target") != nid:
                        continue
                    src = str(edge.get("source") or "")
                    if src and src not in seen:
                        seen.add(src)
                        queue.append(src)
            return seen

        return ApprovalInstanceService._graph_node_ids_reachable_from(graph, start_id) & bfs_backward(
            target_id
        )

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
        on_path_to_current: Set[str] = set()
        reachable_from_current: Set[str] = set()
        if instance and instance.status == "pending" and instance.current_node:
            current_id = str(instance.current_node)
            on_path_to_current = ApprovalInstanceService._graph_node_ids_on_some_path_to_target(
                graph, current_id
            )
            # 当前节点之后仍可能走到的节点（含当前）→ 未执行完前不得标「已跳过」
            reachable_from_current = ApprovalInstanceService._graph_node_ids_reachable_from(
                graph, current_id
            )

        if instance and history:
            await ApprovalInstanceService._heal_condition_route_history_actors(
                tenant_id, instance, history
            )

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
            # condition_route 只挂在条件节点（from_node），避免目标审批节点重复冒出「条件分支」
            node_history = [
                h
                for h in history
                if h.from_node == node_id
                or (
                    h.to_node == node_id
                    and ApprovalInstanceService._normalize_execution_action(h.action)
                    != "condition_route"
                )
            ]

            is_current = bool(
                instance
                and instance.status == "pending"
                and instance.current_node == node_id
            )
            # 撤回本级后 current 回退：当前节点之后仍可能重走，不得沿用历史 auto_pass/route 标已跳过/已通过
            is_future_after_current = bool(
                instance
                and instance.status == "pending"
                and reachable_from_current
                and node_id in reachable_from_current
                and not is_current
            )
            # 仍停在本节点时一律 pending（会签部分通过 / 或签后加签等），避免流程图误显示「已通过」但未到结束
            if any(t.status == "rejected" for t in node_tasks):
                node_status = "rejected"
            elif is_current:
                node_status = "pending"
            elif any(t.status == "approved" for t in node_tasks):
                node_status = "approved"
            elif instance and instance.status == "approved":
                node_status = "approved"
            elif instance and instance.status in {"rejected", "cancelled"}:
                node_status = "skipped"
            elif is_future_after_current:
                node_status = "waiting"
            elif any(
                h.from_node == node_id
                and (
                    "空审批人自动通过" in (h.comment or "")
                    or "emptyApproverPolicy=auto_pass" in (h.comment or "").lower()
                )
                for h in node_history
            ):
                node_status = "skipped"
            elif any(
                h.from_node == node_id
                and ApprovalInstanceService._normalize_execution_action(h.action)
                in ("approve", "approved", "condition_route")
                for h in node_history
            ):
                node_status = "approved"
            elif (
                instance
                and instance.status == "pending"
                and on_path_to_current
                and node_id in on_path_to_current
                and node_id not in reachable_from_current
                and not is_current
                and node_type in {"condition", "cc"}
            ):
                # 条件/抄送无任务：已在通向当前节点的路径上且已走过，视为已通过
                node_status = "approved"
            elif (
                instance
                and instance.status == "pending"
                and on_path_to_current
                and node_id in on_path_to_current
                and node_id not in reachable_from_current
                and not is_current
                and node_type == "approval"
                and (node_tasks or node_history)
            ):
                # 审批节点已在当前节点之前（有任务或执行史），不得再标「待到达」
                # （例如仅有提交/撤回史、或待办已推进后被取消，但流程已离开本节点）
                node_status = "approved"
            elif (
                instance
                and instance.status == "pending"
                and on_path_to_current
                and node_id not in on_path_to_current
                and node_id not in reachable_from_current
                and node_type in {"approval", "condition", "cc"}
            ):
                # 仅旁路死支（已走过路径上未选中、且从当前再也走不到）才「已跳过」；
                # 当前之后尚未到达的节点保持 waiting（待到达）
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
                        "action": norm_action,
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
        from core.services.approval.approval_viewer_actions import (
            build_flow_viewer_actions,
            current_node_eligible_user_ids,
            viewer_has_pending_task_on_instance,
        )

        entity_instances = await ApprovalInstanceService._list_instances_by_entity(
            tenant_id,
            entity_type,
            entity_id,
        )
        instance = await ApprovalInstanceService._resolve_active_instance(entity_instances)

        process = await ApprovalInstanceService._resolve_process_for_entity_display(
            tenant_id, entity_type, instance
        )

        from core.config.audit_registry import entry_by_entity_type

        audit_entry = entry_by_entity_type(entity_type)

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
                "viewer_can_revoke": False,
                "viewer_can_withdraw_submit": False,
                "viewer_can_recall_own": False,
                "reject_options": None,
                "audit_resource": audit_entry.resource if audit_entry else None,
            }

        tasks: List[ApprovalTask] = []
        history: List[ApprovalHistory] = []
        if entity_instances:
            if instance and instance.status == "pending" and process:
                # 旧撤回曾清掉 initiator 选边：先用 condition_route 履历回写，避免概况 422 / 弹窗未绑定
                try:
                    graph_for_restore = ApprovalInstanceService._normalize_process_graph(
                        process.nodes
                    )
                    await ApprovalInstanceService._restore_missing_initiator_branches_from_history(
                        tenant_id, instance, graph_for_restore
                    )
                except Exception as exc:
                    logger.warning(
                        "restore initiator branch skipped for {}:{} — {}",
                        entity_type,
                        entity_id,
                        exc,
                    )
            if instance and instance.status == "pending" and instance.current_node:
                # 须在 bootstrap 之前：否则 pending_count 会把上一节点残留算进去
                await ApprovalTask.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=instance.id,
                    status="pending",
                ).exclude(node_id=str(instance.current_node)).update(status="cancelled")
            if instance and instance.status == "pending":
                try:
                    await ApprovalInstanceService.bootstrap_instance_workflow(
                        tenant_id, instance
                    )
                except NotFoundError as exc:
                    logger.warning(
                        "bootstrap_instance_workflow skipped for {}:{} — {}",
                        entity_type,
                        entity_id,
                        exc,
                    )
                except Exception as exc:
                    # 禁止因 bootstrap/补齐待办失败把整单状态接口打成 500：
                    # 前端会当成「未绑定审批流」清空节点图。
                    logger.exception(
                        "bootstrap_instance_workflow failed for {}:{} — {}",
                        entity_type,
                        entity_id,
                        exc,
                    )
            instance_ids = [inst.id for inst in entity_instances]
            if instance and instance.status == "pending" and instance.current_node:
                # bootstrap 可能推进节点，再清一次非当前残留
                await ApprovalTask.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=instance.id,
                    status="pending",
                ).exclude(node_id=str(instance.current_node)).update(status="cancelled")
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
            # 流程图节点态只认「当前活跃实例」：撤回重提后不得把上一轮的条件分支「已通过」混进来
            active_id = int(instance.id) if instance else None
            overview_tasks = [
                t for t in tasks
                if active_id is not None and int(t.approval_instance_id) == active_id
            ]
            overview_history = [
                h for h in history
                if active_id is not None and int(h.approval_instance_id) == active_id
            ]
            if instance and instance.status == "pending" and isinstance(instance.data, dict):
                prior_raw = instance.data.get("reopened_from_instance_id")
                if prior_raw is not None:
                    try:
                        prior_id = int(prior_raw)
                    except (TypeError, ValueError):
                        prior_id = None
                    if prior_id is not None:
                        current_nid = str(instance.current_node or "")
                        overview_tasks.extend(
                            t
                            for t in tasks
                            if int(t.approval_instance_id) == prior_id
                            and str(t.node_id or "") != current_nid
                        )
                        overview_history.extend(
                            h
                            for h in history
                            if int(h.approval_instance_id) == prior_id
                            and str(h.from_node or "") != current_nid
                            and str(h.to_node or "") != current_nid
                        )
            nodes_overview = await ApprovalInstanceService._build_nodes_overview(
                tenant_id, process, instance, overview_tasks, overview_history
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
            "allow_submitter_withdraw": True,
            "allow_approver_recall": False,
        }
        viewer_can_revoke = False
        viewer_can_withdraw_submit = False
        viewer_can_recall_own = False
        editable_fields: List[Any] = []
        can_edit_during_approval = False
        if instance and instance.status == "pending" and process:
            graph_nodes = ApprovalInstanceService._normalize_process_graph(process.nodes)
            node_list = graph_nodes.get("nodes") or []
            current_node_obj = next(
                (
                    n
                    for n in node_list
                    if isinstance(n, dict) and n.get("id") == instance.current_node
                ),
                None,
            )
            if viewer_id and current_node_obj:
                eligible_ids = current_node_eligible_user_ids(nodes_overview)
                if not eligible_ids:
                    try:
                        eligible_ids = await ApprovalInstanceService._resolve_node_approvers(
                            current_node_obj, instance
                        )
                    except Exception:
                        eligible_ids = []
                if eligible_ids:
                    # 当前节点上不在可审名单的残留 pending（非加签）会导致按钮文案仍指向上一节点人
                    expected = {int(x) for x in eligible_ids}
                    # 撤回本级会把操作人写成 current_approver；即便汇报线解析名单不含他，也不得当残留清掉
                    if instance.current_approver_id is not None:
                        expected.add(int(instance.current_approver_id))
                    stale_pending = [
                        t
                        for t in tasks
                        if t.status == "pending"
                        and str(t.node_id or "") == str(instance.current_node or "")
                        and t.approver_id is not None
                        and int(t.approver_id) not in expected
                        and getattr(t, "sign_type", None) not in ("before", "after")
                    ]
                    if stale_pending:
                        await ApprovalTask.filter(
                            id__in=[t.id for t in stale_pending]
                        ).update(status="cancelled")
                        tasks = await ApprovalTask.filter(
                            tenant_id=tenant_id,
                            approval_instance_id__in=[inst.id for inst in entity_instances],
                        ).order_by("-created_at").all()
                if int(viewer_id) in {int(x) for x in eligible_ids}:
                    if not viewer_has_pending_task_on_instance(
                        viewer_id=int(viewer_id),
                        instance=instance,
                        tasks=tasks,
                    ):
                        await ApprovalInstanceService._sync_node_approver_tasks(
                            tenant_id, instance, current_node_obj, approvers=eligible_ids
                        )
                        tasks = await ApprovalTask.filter(
                            tenant_id=tenant_id,
                            approval_instance_id__in=[inst.id for inst in entity_instances],
                        ).order_by("-created_at").all()

        viewer_actions: Dict[str, Any] = {
            "has_my_pending_task": False,
            "approve": False,
            "reject": False,
            "block_reason": None,
        }
        if viewer_id is not None:
            viewer_actions = build_flow_viewer_actions(
                viewer_id=viewer_id,
                instance=instance,
                tasks=tasks,
                nodes_overview=nodes_overview,
            )

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
                from core.services.approval.approval_flow_policy import resolve_submitter_withdraw_policy

                withdraw_policy = resolve_submitter_withdraw_policy(graph)
                node_capabilities = {
                    "allow_transfer": bool(nd.get("allowTransfer")),
                    "allow_add_sign": bool(nd.get("allowAddSign")),
                    "allow_edit_during_approval": bool(nd.get("allowEditDuringApproval")),
                    "allow_submitter_withdraw": bool(withdraw_policy["allowSubmitterWithdraw"]),
                    "allow_approver_recall": bool(nd.get("allowApproverRecall")),
                }

        if process and viewer_id is not None:
            from core.config.audit_registry import entry_by_entity_type
            from core.services.approval.approval_flow_policy import compute_viewer_flow_withdraw_revoke
            from core.services.authorization.user_permission_service import UserPermissionService

            admin_bypass = False
            has_revoke = False
            user = await User.get_or_none(id=int(viewer_id))
            if user:
                admin_bypass = await UserPermissionService.is_admin_bypass(user, tenant_id)
            entry = entry_by_entity_type(entity_type)
            if entry and user:
                revoke_code = f"{entry.resource}:revoke"
                has_revoke = await UserPermissionService.has_permission(
                    int(viewer_id), tenant_id, revoke_code
                )
            withdraw_history = [
                h
                for h in history
                if instance and int(h.approval_instance_id) == int(instance.id)
            ]
            flow_flags = await compute_viewer_flow_withdraw_revoke(
                tenant_id=tenant_id,
                viewer_id=int(viewer_id),
                instance=instance,
                process_nodes=process.nodes if process else {},
                history=withdraw_history,
                admin_bypass=admin_bypass,
                has_revoke_permission=has_revoke or admin_bypass,
            )
            viewer_can_revoke = bool(flow_flags["viewer_can_revoke"])
            viewer_can_withdraw_submit = bool(flow_flags["viewer_can_withdraw_submit"])
            viewer_can_recall_own = bool(flow_flags["viewer_can_recall_own"])

        current_node_decision = None
        if instance and instance.status == "pending" and process:
            from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph

            graph = normalize_flow_graph(process.nodes or {})
            cur = get_node_config(graph, instance.current_node)
            if cur and cur.get("type") == "approval":
                spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, cur)
                if spec and spec.get("field"):
                    current_node_decision = {
                        "field": str(spec.get("field")),
                        "label": str(spec.get("label") or spec.get("field")),
                        "kind": str(spec.get("kind") or "branch_index"),
                        "branches": spec.get("branches") or [],
                        "trueBranchLabel": str(spec.get("trueBranchLabel") or "是"),
                        "falseBranchLabel": str(spec.get("falseBranchLabel") or "否"),
                        "requireExplicit": bool(spec.get("requireExplicit", True)),
                        "defaultValue": spec.get("defaultValue"),
                    }

        reject_options_payload = None
        if (
            instance
            and instance.status == "pending"
            and process
            and viewer_id is not None
            and viewer_actions.get("reject")
        ):
            from core.services.approval.approval_flow_policy import resolve_reject_options_for_instance

            reject_options_payload = await resolve_reject_options_for_instance(
                tenant_id=tenant_id,
                instance=instance,
                process_nodes=process.nodes if process else {},
            )

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
            "has_my_pending_task": bool(viewer_actions.get("has_my_pending_task")),
            "viewer_actions": viewer_actions,
            "viewer_can_revoke": viewer_can_revoke,
            "viewer_can_withdraw_submit": viewer_can_withdraw_submit,
            "viewer_can_recall_own": viewer_can_recall_own,
            "current_node_decision": current_node_decision,
            "reject_options": reject_options_payload,
            "audit_resource": audit_entry.resource if audit_entry else None,
        }

    @staticmethod
    async def batch_flow_viewer_actions_for_entities(
        tenant_id: int,
        entity_type: str,
        entity_ids: list[int],
        viewer_id: Optional[int],
    ) -> Dict[int, Dict[str, Any]]:
        """列表/详情批量填充与 get_approval_status 同源的 viewer_actions（只读，不写待办补齐）。"""
        from core.services.approval.approval_viewer_actions import build_flow_viewer_actions

        out: Dict[int, Dict[str, Any]] = {}
        if viewer_id is None or not entity_ids:
            return out

        id_set = {int(x) for x in entity_ids if x is not None}
        if not id_set:
            return out

        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True,
        ).prefetch_related("process").all()

        instances_by_entity: Dict[int, list] = {}
        for inst in instances:
            data = inst.data or {}
            if data.get("entity_type") != entity_type:
                continue
            try:
                eid = int(data.get("entity_id"))
            except (TypeError, ValueError):
                continue
            if eid not in id_set:
                continue
            instances_by_entity.setdefault(eid, []).append(inst)

        if not instances_by_entity:
            return out

        active_by_entity: Dict[int, ApprovalInstance] = {}
        for eid, entity_instances in instances_by_entity.items():
            active = await ApprovalInstanceService._resolve_active_instance(entity_instances)
            if active is not None and active.status == "pending":
                active_by_entity[eid] = active

        if not active_by_entity:
            return out

        inst_ids = [int(i.id) for i in active_by_entity.values()]
        all_tasks = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id__in=inst_ids,
        ).order_by("-created_at").all()
        tasks_by_inst: Dict[int, list] = {}
        for task in all_tasks:
            tasks_by_inst.setdefault(int(task.approval_instance_id), []).append(task)

        for eid, instance in active_by_entity.items():
            try:
                process = await ApprovalInstanceService._resolve_process_for_entity_display(
                    tenant_id, entity_type, instance
                )
                tasks = tasks_by_inst.get(int(instance.id), [])
                history: list = []
                nodes_overview: list = []
                if process:
                    nodes_overview = await ApprovalInstanceService._build_nodes_overview(
                        tenant_id, process, instance, tasks, history
                    )
                viewer_actions = build_flow_viewer_actions(
                    viewer_id=int(viewer_id),
                    instance=instance,
                    tasks=tasks,
                    nodes_overview=nodes_overview,
                )
                out[eid] = viewer_actions
            except Exception as exc:
                # 列表只读门控：单条缺选边/坏图不得把整页 list 打成 422
                logger.warning(
                    "batch_flow_viewer_actions skipped for {}:{} — {}",
                    entity_type,
                    eid,
                    exc,
                )
        return out

    @staticmethod
    async def batch_flow_withdraw_revoke_flags_for_entities(
        tenant_id: int,
        entity_type: str,
        entity_ids: list[int],
        viewer_id: Optional[int],
    ) -> Dict[int, Dict[str, bool]]:
        """列表批量填充撤回/反审身份门控（与 get_approval_status 同源，只读）。"""
        from core.config.audit_registry import entry_by_entity_type
        from core.services.approval.approval_flow_policy import compute_viewer_flow_withdraw_revoke
        from core.services.authorization.user_permission_service import UserPermissionService

        out: Dict[int, Dict[str, bool]] = {}
        if viewer_id is None or not entity_ids:
            return out

        id_set = {int(x) for x in entity_ids if x is not None}
        if not id_set:
            return out

        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            status__in=["pending", "approved"],
            deleted_at__isnull=True,
        ).prefetch_related("process").all()

        active_by_entity: Dict[int, ApprovalInstance] = {}
        entity_instances_map: Dict[int, list] = {}
        for inst in instances:
            data = inst.data or {}
            if data.get("entity_type") != entity_type:
                continue
            try:
                eid = int(data.get("entity_id"))
            except (TypeError, ValueError):
                continue
            if eid not in id_set:
                continue
            entity_instances_map.setdefault(eid, []).append(inst)

        for eid, entity_instances in entity_instances_map.items():
            active = await ApprovalInstanceService._resolve_active_instance(entity_instances)
            if active is None:
                active = next((i for i in entity_instances if i.status == "approved"), None)
            if active is not None:
                active_by_entity[eid] = active

        if not active_by_entity:
            return out

        inst_ids = [int(i.id) for i in active_by_entity.values()]
        history_rows = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id__in=inst_ids,
        ).order_by("action_at").all()
        history_by_inst: Dict[int, list] = {}
        for h in history_rows:
            history_by_inst.setdefault(int(h.approval_instance_id), []).append(h)

        user = await User.get_or_none(id=int(viewer_id))
        admin_bypass = False
        has_revoke = False
        if user:
            admin_bypass = await UserPermissionService.is_admin_bypass(user, tenant_id)
        entry = entry_by_entity_type(entity_type)
        if entry and user:
            has_revoke = await UserPermissionService.has_permission(
                int(viewer_id), tenant_id, f"{entry.resource}:revoke"
            )

        for eid, instance in active_by_entity.items():
            process = instance.process
            if not process:
                await instance.fetch_related("process")
                process = instance.process
            flags = await compute_viewer_flow_withdraw_revoke(
                tenant_id=tenant_id,
                viewer_id=int(viewer_id),
                instance=instance,
                process_nodes=process.nodes if process else {},
                history=history_by_inst.get(int(instance.id), []),
                admin_bypass=admin_bypass,
                has_revoke_permission=has_revoke or admin_bypass,
            )
            out[eid] = flags
        return out

    @staticmethod
    async def execute_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        approved: bool,
        comment: Optional[str] = None,
        instance_data_patch: Optional[Dict[str, Any]] = None,
        reject_target: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        按 entity 执行审批（统一入口）

        查找该 entity 的待办任务，调用 perform_task_action。

        Returns:
            {"success": bool, "flow_completed": bool, "flow_rejected": bool, "instance": ApprovalInstance}
        """
        # ponytail: limit 500 + warning；entity 列/GIN 索引若并发>500 再上
        _PENDING_SCAN_LIMIT = 500
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(_PENDING_SCAN_LIMIT)

        instance = None
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and ApprovalInstanceService._entity_ids_equal(
                d.get("entity_id"), entity_id
            ):
                instance = inst
                break

        if not instance:
            pending_count = await ApprovalInstance.filter(
                tenant_id=tenant_id,
                status="pending",
                deleted_at__isnull=True,
            ).count()
            if pending_count > _PENDING_SCAN_LIMIT:
                logger.warning(
                    "execute_approval pending scan miss: tenant={} entity={}:{} "
                    "pending_count={} limit={}",
                    tenant_id,
                    entity_type,
                    entity_id,
                    pending_count,
                    _PENDING_SCAN_LIMIT,
                )
            raise NotFoundError(f"实体 {entity_type}:{entity_id} 未找到待审批的流程实例")

        async def _pending_task_for_approver() -> Optional[ApprovalTask]:
            q = ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                approver_id=approver_id,
                status="pending",
            )
            current = str(instance.current_node or "").strip()
            if current:
                q = q.filter(node_id=current)
            return await q.first()

        task = await _pending_task_for_approver()

        if not task:
            # 仅补齐当前节点待办，禁止走 bootstrap+reconcile（会在投票前推进节点）
            await instance.fetch_related("process")
            process = instance.process
            current = str(instance.current_node or "").strip()
            if process and current:
                graph = ApprovalInstanceService._normalize_process_graph(process.nodes)
                current_node = next(
                    (
                        n
                        for n in (graph.get("nodes") or [])
                        if isinstance(n, dict) and str(n.get("id") or "").strip() == current
                    ),
                    None,
                )
                if current_node:
                    node_type = current_node.get("type") or (current_node.get("data") or {}).get("type")
                    if node_type not in ("start", "end", "condition", "cc", None):
                        await ApprovalTask.filter(
                            tenant_id=tenant_id,
                            approval_instance_id=instance.id,
                            status="pending",
                        ).exclude(node_id=current).update(status="cancelled")
                        await ApprovalInstanceService._sync_node_approver_tasks(
                            tenant_id, instance, current_node
                        )
            task = await _pending_task_for_approver()

        if not task:
            raise ValidationError("您没有该审批任务或任务已处理")

        reject_target_norm = None
        if not approved:
            from core.services.approval.audit_reject_context import (
                get_reject_target,
                normalize_reject_target,
            )

            reject_target_norm = normalize_reject_target(reject_target) or get_reject_target()

        action = ApprovalInstanceAction(
            action="approve" if approved else "reject",
            comment=comment,
            instance_data_patch=instance_data_patch,
            reject_target=reject_target_norm,
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
    def _entity_ids_equal(left: Any, right: Any) -> bool:
        try:
            return int(left) == int(right)
        except (TypeError, ValueError):
            return left == right

    @staticmethod
    async def _outbound_entity_decision(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> Optional[str]:
        """
        销售出库 / 生产领料是否已有业务审定结果。
        返回 approved / rejected / None（仍待审或单据不存在）。
        """
        if entity_type == "sales_delivery":
            from apps.kuaizhizao.models.sales_delivery import SalesDelivery

            row = await SalesDelivery.get_or_none(
                tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
            )
            if not row:
                return None
            status = str(row.status or "").strip()
            review = str(row.review_status or "").strip()
            if review == "已通过" or status in ("待出库", "已出库", "部分出库"):
                return "approved"
            if review == "已驳回":
                return "rejected"
            return None
        if entity_type == "production_picking":
            from apps.kuaizhizao.models.production_picking import ProductionPicking

            row = await ProductionPicking.get_or_none(
                tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
            )
            if not row:
                return None
            status = str(row.status or "").strip()
            review = str(row.review_status or "").strip()
            if review == "已通过" or status in ("待领料", "已领料", "部分领料"):
                return "approved"
            if review == "已驳回":
                return "rejected"
            return None
        return None

    @staticmethod
    async def _entity_audit_decision(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> Optional[str]:
        """
        业务单据是否已有审定结果（与流程任务脱节时的收敛依据）。
        返回 approved / rejected / None（仍待审或单据不存在）。
        """
        et = (entity_type or "").strip()
        if et in ("sales_delivery", "production_picking"):
            return await ApprovalInstanceService._outbound_entity_decision(
                tenant_id, et, entity_id
            )
        if et == "payable":
            from apps.kuaicaiwu.models.payable import Payable

            row = await Payable.get_or_none(
                tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
            )
            if not row:
                return None
            review = str(row.review_status or "").strip()
            if review in ("已审核", "已通过", "approved"):
                return "approved"
            if review in ("驳回", "已驳回", "rejected"):
                return "rejected"
            return None
        if et == "receivable":
            from apps.kuaicaiwu.models.receivable import Receivable

            row = await Receivable.get_or_none(
                tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
            )
            if not row:
                return None
            review = str(row.review_status or "").strip()
            if review in ("已审核", "已通过", "approved"):
                return "approved"
            if review in ("驳回", "已驳回", "rejected"):
                return "rejected"
            return None
        if et == "purchase_invoice":
            from apps.kuaicaiwu.models.purchase_invoice import PurchaseInvoice

            row = await PurchaseInvoice.get_or_none(
                tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True
            )
            if not row:
                return None
            review = str(row.review_status or "").strip()
            status = str(row.status or "").strip()
            if review in ("已审核", "已通过", "approved") or status == "已审核":
                return "approved"
            if review in ("驳回", "已驳回", "rejected"):
                return "rejected"
            return None
        return None

    @staticmethod
    async def reconcile_orphaned_outbound_approval_tasks(
        tenant_id: int,
        approver_id: int,
    ) -> int:
        """兼容旧名：收敛孤儿审批任务（出库/领料/应收应付等）。"""
        return await ApprovalInstanceService.reconcile_orphaned_approval_tasks(
            tenant_id, approver_id
        )

    @staticmethod
    async def reconcile_orphaned_approval_tasks(
        tenant_id: int,
        approver_id: int,
    ) -> int:
        """
        清理「单据已审核、流程任务仍 pending」的历史脏数据。
        根因曾是业务审核未走 UniAuditService 关流程；正向路径已修复，此处仅收敛存量。
        """
        tasks = (
            await ApprovalTask.filter(
                tenant_id=tenant_id,
                approver_id=approver_id,
                status="pending",
            )
            .prefetch_related("approval_instance")
            .all()
        )
        closed = 0
        for task in tasks:
            inst = task.approval_instance
            if not inst:
                continue
            if inst.status in ("approved", "rejected", "cancelled"):
                await ApprovalTask.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=inst.id,
                    status="pending",
                ).update(status=inst.status)
                closed += 1
                logger.info(
                    "已关闭终态实例上的残留待办 instance={} status={}",
                    inst.id,
                    inst.status,
                )
                continue
            if inst.status != "pending":
                continue
            data = inst.data if isinstance(inst.data, dict) else {}
            entity_type = str(data.get("entity_type") or "").strip()
            try:
                entity_id = int(data.get("entity_id"))
            except (TypeError, ValueError):
                continue
            decision = await ApprovalInstanceService._entity_audit_decision(
                tenant_id, entity_type, entity_id
            )
            if decision is None:
                continue
            task_status = "approved" if decision == "approved" else "rejected"
            await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=inst.id,
                status="pending",
            ).update(status=task_status)
            inst.status = "approved" if decision == "approved" else "rejected"
            inst.completed_at = resolve_business_datetime()
            await inst.save(update_fields=["status", "completed_at", "updated_at"])
            closed += 1
            logger.info(
                "已收敛孤儿审批任务 instance={} entity={}:{} decision={}",
                inst.id,
                entity_type,
                entity_id,
                decision,
            )
        return closed

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
        if not instance:
            return False
        if instance.status != "pending":
            # completed/cancelled 仍留痕，避免反审核路径审计静默缺失
            await ApprovalInstanceService._create_approval_history(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                action="revoke_noop",
                action_by=operator_id,
                comment=f"cancel_approval no-op: instance.status={instance.status}",
                from_node=instance.current_node,
                to_node=instance.current_node,
            )
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

        instance.data = ApprovalInstanceService._strip_branch_decision_keys(instance.data)
        instance.status = "cancelled"
        instance.completed_at = resolve_business_datetime()
        instance.current_node = None
        instance.current_approver_id = None
        await instance.save()
        logger.info(f"审批流程已取消: {entity_type}:{entity_id}")
        return True

    @staticmethod
    async def recall_own_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> bool:
        """审批人撤回本级同意：流程退回该节点重审。"""
        from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
        from core.services.approval.approval_flow_policy import _node_data_bool
        from infra.exceptions.exceptions import AuthorizationError

        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            raise ValidationError("当前没有可撤回本级审批的流程")

        process = instance.process
        if not process:
            await instance.fetch_related("process")
            process = instance.process
        if not process:
            raise ValidationError("未绑定审批流程")

        graph = normalize_flow_graph(process.nodes or {})
        approved_tasks = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            approver_id=int(operator_id),
            status="approved",
        ).order_by("-action_at", "-id").all()

        recall_node_id: Optional[str] = None
        for task in approved_tasks:
            nid = str(task.node_id or "").strip()
            if not nid or str(instance.current_node or "") == nid:
                continue
            node = get_node_config(graph, nid)
            data = node.get("data") if node and isinstance(node.get("data"), dict) else {}
            if not _node_data_bool(data, "allowApproverRecall", True):
                continue
            recall_node_id = nid
            break

        if not recall_node_id:
            raise AuthorizationError("流程未开启撤回本级或未满足条件")

        from core.services.approval.approval_flow_policy import viewer_may_recall_own_on_instance

        if not await viewer_may_recall_own_on_instance(
            tenant_id, instance, int(operator_id), process.nodes if process else {}
        ):
            raise AuthorizationError("后续审批节点已处理，不可撤回本级")

        previous_node = instance.current_node

        # 其它节点任务一律取消；本节点也先整批取消再重建 pending。
        # 禁止只把某一行 approved→pending 却残留另一行 approved：
        # bootstrap/_reconcile 会按或签「已有通过」再次推进并清掉待办，导致无法再审。
        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
        ).update(status="cancelled")

        await ApprovalTask.create(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            node_id=recall_node_id,
            approver_id=int(operator_id),
            status="pending",
        )

        instance.current_node = recall_node_id
        instance.current_approver_id = int(operator_id)
        # 仅清撤回节点之后、需前序审批人再选的边；发起人提交时选的 initiator 分支须保留，
        # 否则打开审核概况 bootstrap 撞条件节点会报「发起人须选定…」并把弹窗显示成未绑定。
        instance.data = ApprovalInstanceService._strip_branch_keys_after_recall(
            instance.data, graph, recall_node_id
        )
        await instance.save()

        recall_node = get_node_config(graph, recall_node_id)
        if recall_node:
            try:
                approvers = await ApprovalInstanceService._resolve_node_approvers(
                    recall_node, instance
                )
                # 确保撤回人一定在可审名单里，避免 sync 后仅有空名单、待办被后续 stale 清理
                if int(operator_id) not in {int(x) for x in (approvers or [])}:
                    approvers = list(approvers or []) + [int(operator_id)]
                await ApprovalInstanceService._sync_node_approver_tasks(
                    tenant_id, instance, recall_node, approvers=approvers
                )
            except Exception as exc:
                logger.warning(
                    "recall_own_approval sync tasks skipped {}:{} — {}",
                    entity_type,
                    entity_id,
                    exc,
                )

        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action="recall_own",
            action_by=int(operator_id),
            comment="撤回本级审批",
            from_node=str(previous_node or ""),
            to_node=recall_node_id,
        )
        logger.info(
            "审批人撤回本级: {}:{} node={} operator={}",
            entity_type,
            entity_id,
            recall_node_id,
            operator_id,
        )
        return True

    @staticmethod
    async def _find_last_completed_approval_node_id(
        tenant_id: int,
        instance: ApprovalInstance,
    ) -> Optional[str]:
        """已通过实例上，时间序最后完成的人工审批节点（终审节点）。"""
        process = instance.process
        if not process:
            await instance.fetch_related("process")
            process = instance.process
        if not process:
            return None
        graph = ApprovalInstanceService._normalize_process_graph(process.nodes)
        approval_node_ids: Set[str] = set()
        for node in graph.get("nodes") or []:
            if not isinstance(node, dict):
                continue
            node_type = str(node.get("type") or "")
            if node_type != "approval":
                continue
            nid = str(node.get("id") or "").strip()
            if nid:
                approval_node_ids.add(nid)
        if not approval_node_ids:
            return None

        tasks = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            status="approved",
        ).order_by("-action_at", "-id").all()
        for task in tasks:
            nid = str(task.node_id or "").strip()
            if nid in approval_node_ids:
                return nid

        history = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
        ).order_by("-action_at", "-id").all()
        for h in history:
            if ApprovalInstanceService._normalize_execution_action(h.action) != "approve":
                continue
            for candidate in (h.from_node, h.to_node):
                nid = str(candidate or "").strip()
                if nid in approval_node_ids:
                    return nid
        return None

    @staticmethod
    async def reopen_at_last_approval_node(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> Optional[ApprovalInstance]:
        """
        反审核后重开终审节点：保留条件分支等前序决策，在最后人工审批节点重建待办。

        有已通过实例时：取消残留 pending → 新建 pending 实例停在终审节点。
        无已通过实例时返回 None（调用方回落到草稿/取消路径）。
        """
        entity_instances = await ApprovalInstanceService._list_instances_by_entity(
            tenant_id, entity_type, entity_id
        )
        approved = next(
            (inst for inst in entity_instances if inst.status == "approved"),
            None,
        )
        if not approved:
            return None

        last_node_id = await ApprovalInstanceService._find_last_completed_approval_node_id(
            tenant_id, approved
        )
        if not last_node_id:
            logger.warning(
                "反审核无法定位终审节点: {}:{} instance={}",
                entity_type,
                entity_id,
                approved.id,
            )
            return None

        process = approved.process
        if not process:
            await approved.fetch_related("process")
            process = approved.process
        if not process:
            return None

        graph = ApprovalInstanceService._normalize_process_graph(process.nodes)
        last_node = next(
            (
                n
                for n in (graph.get("nodes") or [])
                if isinstance(n, dict) and str(n.get("id") or "") == last_node_id
            ),
            None,
        )
        if not last_node:
            return None

        # 残留 pending（异常态）先取消，避免双实例抢 active
        await ApprovalInstanceService.cancel_approval(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
        )

        from core.services.approval.approval_audit_scope import enrich_instance_data_audit_app

        raw_data = dict(approved.data or {}) if isinstance(approved.data, dict) else {}
        raw_data.pop("writeback_failure", None)
        raw_data.pop("invalidated_by_config", None)
        raw_data.pop("invalidated_node_key", None)
        # 保留 __branch_true_* / 选人快照，禁止 strip 后回到上一级条件节点
        instance_data = enrich_instance_data_audit_app(
            raw_data,
            process_code=process.code,
        )
        instance_data["reopened_from_instance_id"] = int(approved.id)

        new_instance = ApprovalInstance(
            tenant_id=tenant_id,
            process=process,
            title=approved.title,
            content=approved.content,
            data=instance_data,
            status="pending",
            current_node=last_node_id,
            current_approver_id=None,
            submitter_id=approved.submitter_id,
            submitted_at=approved.submitted_at or resolve_business_datetime(),
            process_version=getattr(approved, "process_version", None)
            or getattr(process, "published_version", None)
            or 1,
        )
        await new_instance.save()

        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=new_instance.id,
            action="revoke",
            action_by=operator_id,
            comment="撤销审核，退回终审节点待重新审核",
            from_node="end",
            to_node=last_node_id,
        )

        # 终审节点待办必须按「原终审通过人」重建，禁止走 bootstrap→_create_node_tasks：
        # 三级/按汇报线解析为空时 emptyApproverPolicy=auto_pass 会立刻跳到 end，
        # 实例变 approved、重开失败，弹窗再取状态就看不到流程节点。
        from core.services.approval.approval_flow_policy import final_approver_user_ids_on_node

        final_uids = await final_approver_user_ids_on_node(
            tenant_id, approved, last_node_id
        )
        if not final_uids and operator_id:
            final_uids = {int(operator_id)}
        if not final_uids:
            try:
                resolved = await ApprovalInstanceService._resolve_node_approvers(
                    last_node, new_instance
                )
                final_uids = {int(x) for x in (resolved or []) if x is not None}
            except Exception as exc:
                logger.warning(
                    "反审核重开解析终审人失败: {}:{} — {}",
                    entity_type,
                    entity_id,
                    exc,
                )
                final_uids = set()

        async def _abort_reopen(reason: str) -> None:
            await ApprovalTask.filter(
                tenant_id=tenant_id,
                approval_instance_id=new_instance.id,
            ).update(status="cancelled")
            new_instance.status = "cancelled"
            new_instance.completed_at = resolve_business_datetime()
            new_instance.current_node = None
            new_instance.current_approver_id = None
            await new_instance.save()
            logger.error(
                "反审核重开终审节点失败并已作废新实例: {}:{} instance={} reason={}",
                entity_type,
                entity_id,
                new_instance.id,
                reason,
            )

        if not final_uids:
            await _abort_reopen("no_final_approvers")
            return None

        for uid in sorted(final_uids):
            await ApprovalTask.create(
                tenant_id=tenant_id,
                approval_instance_id=new_instance.id,
                node_id=last_node_id,
                approver_id=int(uid),
                status="pending",
            )
        new_instance.current_node = last_node_id
        new_instance.current_approver_id = int(next(iter(final_uids)))
        new_instance.status = "pending"
        await new_instance.save()

        # 仅补齐同节点其它可审人；已有 pending，不会再走空审批人 auto_pass
        try:
            await ApprovalInstanceService.bootstrap_instance_workflow(
                tenant_id, new_instance
            )
        except Exception as exc:
            logger.warning(
                "反审核重开后 bootstrap 补齐跳过: {}:{} — {}",
                entity_type,
                entity_id,
                exc,
            )
        await new_instance.refresh_from_db()
        if new_instance.status != "pending" or str(new_instance.current_node or "") != last_node_id:
            await _abort_reopen(
                f"status={new_instance.status} node={new_instance.current_node}"
            )
            return None

        pending_left = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=new_instance.id,
            node_id=last_node_id,
            status="pending",
        ).count()
        if pending_left < 1:
            await _abort_reopen("no_pending_tasks")
            return None

        logger.info(
            "反审核已重开终审节点: {}:{} node={} instance={} approvers={}",
            entity_type,
            entity_id,
            last_node_id,
            new_instance.id,
            sorted(final_uids),
        )
        return new_instance

    @staticmethod
    async def cancel_pending_for_process(
        tenant_id: int,
        process_id: int,
        *,
        operator_id: int = 0,
        node_key: Optional[str] = None,
    ) -> int:
        """
        配置级关审核开关：取消该流程下全部 pending 实例。

        不改变 cancel_approval 语义；仅用于 AuditBindingService 关闭开关路径。
        在 instance.data 写入 invalidated_by_config 留痕，并记审批历史。
        """
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            process_id=process_id,
            status="pending",
            deleted_at__isnull=True,
        )
        cancelled = 0
        for instance in instances:
            withdraw_node = instance.current_node
            data = ApprovalInstanceService._strip_branch_decision_keys(instance.data)
            data["invalidated_by_config"] = True
            if node_key:
                data["invalidated_node_key"] = node_key
            instance.data = data

            await ApprovalInstanceService._create_approval_history(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                action="withdraw",
                action_by=operator_id,
                comment="流程配置已变更，原待办已作废",
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
            cancelled += 1

        if cancelled:
            logger.info(
                "配置关审核开关取消 pending 实例: tenant={} process_id={} node_key={} count={}",
                tenant_id,
                process_id,
                node_key,
                cancelled,
            )
        return cancelled

    @staticmethod
    async def _list_instances_by_entity(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        *,
        limit: int = 500,
    ) -> List[ApprovalInstance]:
        """同一业务单据的全部审批实例（新→旧）。"""
        # ponytail: 全租户扫描+limit；entity 冗余列/GIN 若命中率不足再上
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(limit)

        matched: List[ApprovalInstance] = []
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and ApprovalInstanceService._entity_ids_equal(
                d.get("entity_id"), entity_id
            ):
                matched.append(inst)
        if not matched:
            total = await ApprovalInstance.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).count()
            if total > limit:
                logger.warning(
                    "_list_instances_by_entity scan miss risk: tenant={} entity={}:{} "
                    "total={} limit={}",
                    tenant_id,
                    entity_type,
                    entity_id,
                    total,
                    limit,
                )
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
        pending_task_for_user_id: Optional[int] = None,
        pending_for_user_id: Optional[int] = None,
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

        if pending_for_user_id:
            task_q = ApprovalTask.filter(
                tenant_id=tenant_id,
                approver_id=pending_for_user_id,
                status="pending",
            )
            instance_ids = await task_q.values_list("approval_instance_id", flat=True)
            uid = int(pending_for_user_id)
            if instance_ids:
                query = query.filter(
                    Q(id__in=list(instance_ids)) | Q(current_approver_id=uid)
                )
            else:
                query = query.filter(current_approver_id=uid)
        elif pending_task_for_user_id:
            task_q = ApprovalTask.filter(
                tenant_id=tenant_id,
                approver_id=pending_task_for_user_id,
                status="pending",
            )
            instance_ids = await task_q.values_list("approval_instance_id", flat=True)
            if not instance_ids:
                return []
            query = query.filter(id__in=list(instance_ids))

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

        reject_target_resolved: Optional[str] = None
        reject_options: Optional[Dict[str, Any]] = None
        if action_data.action == "reject":
            from core.services.approval.approval_flow_policy import resolve_reject_options_for_instance

            process_for_reject = instance.process
            if not process_for_reject:
                await instance.fetch_related("process")
                process_for_reject = instance.process
            if not process_for_reject:
                raise ValidationError("未绑定审批流程")
            reject_options = await resolve_reject_options_for_instance(
                tenant_id=tenant_id,
                instance=instance,
                process_nodes=process_for_reject.nodes if process_for_reject else {},
            )
            allowed = reject_options.get("allowed_targets") or ["submitter"]
            default_target = reject_options.get("default_target") or allowed[0]
            reject_target_resolved = (
                str(action_data.reject_target or "").strip().lower() or default_target
            )
            if reject_target_resolved not in allowed:
                raise ValidationError("当前节点不允许所选驳回落点")
            if reject_target_resolved == "previous" and not reject_options.get("previous_node_id"):
                raise ValidationError("当前为首审节点，无法驳回到上一级")

        process = instance.process if instance else None
        if process and action_data.action == "approve":
            await ApprovalInstanceService._apply_decision_on_approve(
                instance,
                task.node_id,
                process.nodes,
                action_data,
                decided_by=user_id,
            )

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

        node_completed, instance_status = await ApprovalInstanceService._check_node_completion(
            instance
        )
        if node_completed:
            if (
                action_data.action == "reject"
                and reject_target_resolved == "previous"
                and instance_status == "rejected"
            ):
                await ApprovalInstanceService.reject_to_previous_approval_node(
                    tenant_id=tenant_id,
                    instance=instance,
                    operator_id=user_id,
                    comment=action_data.comment,
                    previous_node_id=str((reject_options or {}).get("previous_node_id") or ""),
                )
            else:
                await ApprovalInstanceService._advance_instance_after_node_completion(
                    tenant_id,
                    instance,
                    instance_status,
                    route_action_by=user_id if action_data.action == "approve" else None,
                )

        return instance

    @staticmethod
    async def reject_to_previous_approval_node(
        tenant_id: int,
        instance: ApprovalInstance,
        operator_id: int,
        *,
        comment: Optional[str],
        previous_node_id: str,
    ) -> ApprovalInstance:
        """驳回至上一级 approval 节点：实例保持 pending，重建上一节点待办。"""
        from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph
        from core.services.approval.approval_flow_policy import (
            previous_approval_node_id_on_instance_path,
        )

        prev_node_id = str(previous_node_id or "").strip()
        if not prev_node_id:
            raise ValidationError("无法定位上一级审批节点")

        if not instance.process:
            await instance.fetch_related("process")
        process = instance.process
        if not process:
            raise ValidationError("未绑定审批流程")

        graph = normalize_flow_graph(process.nodes or {})
        computed_prev = previous_approval_node_id_on_instance_path(
            process.nodes, str(instance.current_node or ""), instance
        )
        if computed_prev != prev_node_id:
            raise ValidationError("驳回到上一级与流程路径不一致")

        prev_node = get_node_config(graph, prev_node_id)
        if not prev_node or str(prev_node.get("type") or "") != "approval":
            raise ValidationError("上一级节点不是审批节点")

        completed_node_id = instance.current_node
        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            status__in=["pending", "suspended"],
        ).update(status="cancelled")

        await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            node_id=prev_node_id,
        ).update(status="cancelled")

        instance.current_node = prev_node_id
        instance.status = "pending"
        instance.completed_at = None
        await instance.save()

        await ApprovalInstanceService._create_node_tasks(
            tenant_id, instance, prev_node, route_action_by=operator_id
        )

        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action="reject",
            action_by=int(operator_id),
            comment=comment,
            from_node=str(completed_node_id or ""),
            to_node=prev_node_id,
            change_payload={"reject_target": "previous"},
        )
        return instance

    @staticmethod
    async def _create_node_tasks(
        tenant_id: int,
        instance: ApprovalInstance,
        node: dict,
        *,
        route_action_by: Optional[int] = None,
        on_missing_branch: str = "raise",
    ) -> List[ApprovalTask]:
        """
        为节点创建审批任务。start/end 不建任务；condition 不建任务，按条件选边后递归下一节点；cc 不建任务，发通知并推进到下一节点再递归。

        on_missing_branch 传给条件选边：bootstrap 用 stop，审核推进用 raise。
        """
        node_type = node.get("type") or (node.get("data") or {}).get("type")
        node_id = node.get("id")

        if node_type == "start" or node_type == "end":
            return []

        if node_type == "condition":
            # 条件节点：不创建任务，按 instance.data 与节点 conditions 选一条出边，推进到下一节点再递归
            nodes_config = (instance.process.nodes or {}) if instance.process else {}
            next_node = ApprovalInstanceService._get_next_node(
                nodes_config,
                node_id,
                instance=instance,
                on_missing_branch=on_missing_branch,
            )
            if not next_node:
                if on_missing_branch == "stop":
                    logger.warning(
                        "条件节点 {} 暂无可用出边（缺选边或未命中），停在本节点等待人工选择",
                        node_id,
                    )
                    instance.current_node = str(node_id) if node_id else instance.current_node
                    await instance.save()
                    return []
                instance.status = "approved"
                instance.completed_at = resolve_business_datetime()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            next_label = ""
            next_data = next_node.get("data") if isinstance(next_node.get("data"), dict) else {}
            next_label = str(next_data.get("label") or next_node.get("id") or "").strip()
            # 选边人 = 刚通过前序节点的审批人（route_action_by / __branch_decided_by），不是流程发起人
            route_by = await ApprovalInstanceService._resolve_condition_route_action_by(
                tenant_id, instance, preferred_user_id=route_action_by
            )
            await ApprovalInstanceService._create_approval_history(
                tenant_id=tenant_id,
                approval_instance_id=instance.id,
                action="condition_route",
                action_by=route_by,
                comment=f"条件分支进入：{next_label}" if next_label else "条件分支已选定",
                from_node=str(node_id) if node_id else None,
                to_node=str(next_node.get("id") or "") or None,
            )
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
            return await ApprovalInstanceService._create_node_tasks(
                tenant_id,
                instance,
                next_node,
                route_action_by=route_action_by,
                on_missing_branch=on_missing_branch,
            )

        if node_type == "cc":
            # 抄送节点：不创建审批任务，可选通知抄送人，然后推进到下一节点
            try:
                approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
                if approvers:
                    ApprovalInstanceService._spawn_background(
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
                instance.process.nodes,
                node_id,
                instance=instance,
                on_missing_branch=on_missing_branch,
            )
            if not next_node:
                if on_missing_branch == "stop":
                    return []
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
            return await ApprovalInstanceService._create_node_tasks(
                tenant_id,
                instance,
                next_node,
                on_missing_branch=on_missing_branch,
            )

        node_data = node.get("data") if isinstance(node.get("data"), dict) else {}
        approver_type = str(
            (node_data or {}).get("approverType")
            or (node_data or {}).get("approver_type")
            or "user"
        ).strip().lower()
        empty_policy = str(
            (node_data or {}).get("emptyApproverPolicy")
            or (node_data or {}).get("empty_approver_policy")
            or "block"
        ).strip().lower()
        # 多级上级：组织树不足 N 级时默认跳过（有第 N 级则正常审批）；
        # 仍尊重显式「升级管理员 / 兜底审批人」。
        if approver_type == "multi_level_manager" and empty_policy == "block":
            empty_policy = "auto_pass"

        try:
            approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
        except ValidationError as resolve_err:
            err_text = str(resolve_err)
            # 仅「无人可审」走空审批人策略；配置错误（不支持的类型等）仍直接抛出
            is_empty_approver = any(
                token in err_text
                for token in (
                    "无可用",
                    "未配置",
                    "缺少",
                    "直属部门",
                    "部门未配置",
                    "向上第",
                )
            )
            if not is_empty_approver:
                raise
            if empty_policy == "auto_pass":
                logger.info(
                    "审批节点 {} 无可用审批人，emptyApproverPolicy=auto_pass，自动跳过: {}",
                    node_id,
                    resolve_err,
                )
                return await ApprovalInstanceService._auto_pass_empty_approval_node(
                    tenant_id,
                    instance,
                    node,
                    on_missing_branch=on_missing_branch,
                )
            if empty_policy == "escalate_admin":
                approvers = await ApprovalInstanceService._resolve_tenant_admin_approver_ids(
                    tenant_id
                )
                if not approvers:
                    raise ValidationError(
                        f"{resolve_err}；升级管理员失败：组织内无可用管理员"
                    ) from resolve_err
            elif empty_policy == "fallback_user":
                fallback_raw = (
                    (node_data or {}).get("fallbackApproverIds")
                    or (node_data or {}).get("fallback_approver_ids")
                    or []
                )
                approvers = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                    tenant_id, fallback_raw or [], by_uuid=None
                )
                approvers = await ApprovalInstanceService._filter_active_user_ids(
                    tenant_id, approvers
                )
                if not approvers:
                    raise ValidationError(
                        f"{resolve_err}；且未配置可用的兜底审批人（fallbackApproverIds）"
                    ) from resolve_err
            elif empty_policy == "block":
                raise ValidationError(
                    f"{resolve_err}（emptyApproverPolicy=block，禁止跳过）"
                ) from resolve_err
            else:
                raise ValidationError(
                    f"审批节点 emptyApproverPolicy 非法: {empty_policy!r}"
                ) from resolve_err

        if not approvers:
            if empty_policy == "auto_pass":
                logger.info(
                    "审批节点 {} 审批人为空，emptyApproverPolicy=auto_pass，自动跳过",
                    node_id,
                )
                return await ApprovalInstanceService._auto_pass_empty_approval_node(
                    tenant_id,
                    instance,
                    node,
                    on_missing_branch=on_missing_branch,
                )
            if empty_policy == "escalate_admin":
                approvers = await ApprovalInstanceService._resolve_tenant_admin_approver_ids(
                    tenant_id
                )
            if not approvers:
                raise ValidationError(
                    f"审批节点 {node_id or ''} 无可用审批人，无法提交审核"
                )

        tasks = await ApprovalInstanceService._sync_node_approver_tasks(
            tenant_id, instance, node, approvers
        )

        if approvers:
            instance.current_approver_id = approvers[0]
            await instance.save()

        return tasks

    @staticmethod
    async def _resolve_tenant_admin_approver_ids(tenant_id: int) -> List[int]:
        rows = await User.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            is_tenant_admin=True,
        ).values_list("id", flat=True)
        return list(dict.fromkeys(int(uid) for uid in rows if uid is not None))

    @staticmethod
    async def _auto_pass_empty_approval_node(
        tenant_id: int,
        instance: ApprovalInstance,
        node: dict,
        *,
        on_missing_branch: str = "raise",
    ) -> List[ApprovalTask]:
        """空审批人且策略为 auto_pass：记历史并推进到下一节点（或直接通过）。"""
        node_id = node.get("id")
        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action="approve",
            action_by=instance.submitter_id,
            from_node=str(node_id) if node_id else None,
            to_node=None,
            comment="空审批人自动通过",
        )
        next_node = ApprovalInstanceService._get_next_node(
            instance.process.nodes if instance.process else {},
            node_id,
            instance=instance,
            on_missing_branch=on_missing_branch,
        )
        if not next_node:
            if on_missing_branch == "stop":
                return []
            instance.status = "approved"
            instance.completed_at = resolve_business_datetime()
            instance.current_node = None
            instance.current_approver_id = None
            await instance.save()
            await ApprovalInstanceService._handle_approval_completion(tenant_id, instance)
            return []
        next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
        if next_type == "end":
            instance.status = "approved"
            instance.completed_at = resolve_business_datetime()
            instance.current_node = None
            instance.current_approver_id = None
            await instance.save()
            await ApprovalInstanceService._handle_approval_completion(tenant_id, instance)
            return []
        instance.current_node = next_node.get("id")
        await instance.save()
        return await ApprovalInstanceService._create_node_tasks(
            tenant_id,
            instance,
            next_node,
            on_missing_branch=on_missing_branch,
        )

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
    def _node_display_label(node: Optional[dict]) -> str:
        if not isinstance(node, dict):
            return ""
        data = node.get("data") if isinstance(node.get("data"), dict) else {}
        return str(data.get("label") or node.get("id") or "").strip()

    # instance.data 中记录「谁选的边」；条件分支履历 action_by 的真源
    BRANCH_DECIDED_BY_KEY = "__branch_decided_by"

    @staticmethod
    def _condition_branch_index_key(condition_node_id: str) -> str:
        return f"__branch_index_{condition_node_id}"

    @staticmethod
    def _condition_branch_route_key(condition_node_id: str) -> str:
        """旧图布尔选边键；读取时兼容，新写入优先 __branch_index_*。"""
        return f"__branch_true_{condition_node_id}"

    @staticmethod
    def _read_branch_edge_index(
        inst_data: Dict[str, Any],
        condition_node_id: str,
        out_edge_count: int,
    ) -> Optional[int]:
        if out_edge_count <= 0:
            return None
        data = inst_data or {}
        index_key = ApprovalInstanceService._condition_branch_index_key(condition_node_id)
        if index_key in data:
            raw = data.get(index_key)
            try:
                idx = int(raw)
            except (TypeError, ValueError):
                raise ValidationError(f"分支选择 {index_key!r} 须为 0 起整数下标")
            if idx < 0 or idx >= out_edge_count:
                raise ValidationError(f"分支选择下标 {idx} 超出范围（共 {out_edge_count} 条出边）")
            return idx
        legacy_key = ApprovalInstanceService._condition_branch_route_key(condition_node_id)
        if legacy_key in data:
            legacy_val = data.get(legacy_key)
            if isinstance(legacy_val, str):
                lowered = legacy_val.strip().lower()
                if lowered in ("true", "1", "yes", "on"):
                    legacy_val = True
                elif lowered in ("false", "0", "no", "off"):
                    legacy_val = False
            if isinstance(legacy_val, bool):
                return 0 if legacy_val else out_edge_count - 1
        return None

    @staticmethod
    def _condition_node_route_mode(
        condition_node: dict,
        *,
        out_edge_count: int,
    ) -> str:
        from core.schemas.approval_flow_schema import (
            CONDITION_ROUTE_MODES,
            _infer_condition_route_mode,
            normalize_condition_node_data,
        )

        if not isinstance(condition_node, dict):
            return "formula"
        data = condition_node.get("data") if isinstance(condition_node.get("data"), dict) else {}
        normalized = normalize_condition_node_data(data, out_edge_count=out_edge_count)
        mode = str(normalized.get("routeMode") or "").strip()
        if mode in CONDITION_ROUTE_MODES:
            return mode
        conditions = normalized.get("conditions") or []
        inferred = _infer_condition_route_mode(conditions, out_edge_count=out_edge_count)
        return inferred or "formula"

    @staticmethod
    def _strip_branch_decision_keys(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """撤回/取消时清掉显式选边，避免下一轮重提仍沿用旧分支。"""
        out: Dict[str, Any] = dict(data or {})
        out.pop(ApprovalInstanceService.BRANCH_DECIDED_BY_KEY, None)
        for key in list(out.keys()):
            sk = str(key)
            if sk.startswith("__branch_true_") or sk.startswith("__branch_index_"):
                out.pop(key, None)
        return out

    @staticmethod
    def _strip_branch_keys_after_recall(
        data: Optional[Dict[str, Any]],
        graph: Dict[str, Any],
        recall_node_id: str,
    ) -> Dict[str, Any]:
        """撤回本级后清选边：保留发起人提交时的 initiator 分支，只清撤回点之后需重选的边。"""
        out: Dict[str, Any] = dict(data or {})
        out.pop(ApprovalInstanceService.BRANCH_DECIDED_BY_KEY, None)
        downstream = ApprovalInstanceService._graph_node_ids_reachable_from(
            graph, str(recall_node_id or "")
        )
        for key in list(out.keys()):
            sk = str(key)
            cond_id = ""
            if sk.startswith("__branch_index_"):
                cond_id = sk[len("__branch_index_") :]
            elif sk.startswith("__branch_true_"):
                cond_id = sk[len("__branch_true_") :]
            else:
                continue
            if not cond_id:
                out.pop(key, None)
                continue
            node = next(
                (
                    n
                    for n in (graph.get("nodes") or [])
                    if isinstance(n, dict) and str(n.get("id") or "") == cond_id
                ),
                None,
            )
            keep_initiator = False
            if node and str(node.get("type") or "") == "condition":
                edges = [
                    e
                    for e in (graph.get("edges") or [])
                    if isinstance(e, dict) and str(e.get("source") or "") == cond_id
                ]
                route_mode = ApprovalInstanceService._condition_node_route_mode(
                    node, out_edge_count=len(edges)
                )
                # 发起人提交时已选定，撤回本级不得清掉，否则流程卡死在条件节点
                keep_initiator = route_mode == "initiator"
            if keep_initiator:
                continue
            # 未知键、或撤回点之后的 previous_approver/formula 选边一律清掉
            if (not node) or cond_id in downstream:
                out.pop(key, None)
        return out

    @staticmethod
    async def _restore_missing_initiator_branches_from_history(
        tenant_id: int,
        instance: ApprovalInstance,
        graph: Dict[str, Any],
    ) -> bool:
        """旧撤回清掉 initiator 选边后，用本实例 condition_route 履历回写 __branch_index_*。

        履历 to_node 是写路径真源，不是读侧猜测。
        """
        data: Dict[str, Any] = (
            dict(instance.data) if isinstance(instance.data, dict) else {}
        )
        changed = False
        for node in graph.get("nodes") or []:
            if not isinstance(node, dict) or str(node.get("type") or "") != "condition":
                continue
            cond_id = str(node.get("id") or "").strip()
            if not cond_id:
                continue
            edges = [
                e
                for e in (graph.get("edges") or [])
                if isinstance(e, dict) and str(e.get("source") or "") == cond_id
            ]
            if not edges:
                continue
            route_mode = ApprovalInstanceService._condition_node_route_mode(
                node, out_edge_count=len(edges)
            )
            if route_mode != "initiator":
                continue
            index_key = ApprovalInstanceService._condition_branch_index_key(cond_id)
            if index_key in data or ApprovalInstanceService._condition_branch_route_key(
                cond_id
            ) in data:
                continue
            hist = (
                await ApprovalHistory.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=instance.id,
                    from_node=cond_id,
                )
                .order_by("-action_at", "-id")
                .all()
            )
            route_hist = next(
                (
                    h
                    for h in hist
                    if ApprovalInstanceService._normalize_execution_action(h.action)
                    == "condition_route"
                ),
                None,
            )
            if not route_hist:
                continue
            to_id = str(route_hist.to_node or "").strip()
            if not to_id:
                continue
            edge_index = next(
                (
                    i
                    for i, e in enumerate(edges)
                    if str(e.get("target") or "") == to_id
                ),
                None,
            )
            if edge_index is None:
                continue
            data[index_key] = int(edge_index)
            changed = True
        if changed:
            instance.data = data
            await instance.save()
        return changed

    @staticmethod
    async def _resolve_condition_route_action_by(
        tenant_id: int,
        instance: ApprovalInstance,
        *,
        preferred_user_id: Optional[int] = None,
        at_or_before: Optional[datetime] = None,
    ) -> int:
        """
        条件分支操作人：前序审批人选边人。
        优先级：显式 preferred → instance.data.__branch_decided_by → 最近通过任务 → 当前审批人。
        禁止用流程发起人冒充选边人（仅无任何审批痕迹时才回落 submitter）。
        """
        if preferred_user_id and int(preferred_user_id) > 0:
            return int(preferred_user_id)
        data = instance.data if isinstance(instance.data, dict) else {}
        decided = data.get(ApprovalInstanceService.BRANCH_DECIDED_BY_KEY)
        if decided is not None and str(decided).strip() != "":
            try:
                uid = int(decided)
                if uid > 0:
                    return uid
            except (TypeError, ValueError):
                pass
        q = ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            status="approved",
        )
        if at_or_before is not None:
            q = q.filter(action_at__lte=at_or_before)
        last = await q.order_by("-action_at", "-id").first()
        if last and last.approver_id:
            return int(last.approver_id)
        if instance.current_approver_id:
            return int(instance.current_approver_id)
        return int(instance.submitter_id)

    @staticmethod
    async def _heal_condition_route_history_actors(
        tenant_id: int,
        instance: ApprovalInstance,
        history: List[ApprovalHistory],
    ) -> None:
        """纠正误写成流程发起人的 condition_route.action_by（写回真源表）。"""
        for h in history:
            if ApprovalInstanceService._normalize_execution_action(h.action) != "condition_route":
                continue
            correct = await ApprovalInstanceService._resolve_condition_route_action_by(
                tenant_id,
                instance,
                at_or_before=h.action_at,
            )
            if not correct or int(h.action_by or 0) == int(correct):
                continue
            h.action_by = int(correct)
            await ApprovalHistory.filter(id=h.id).update(action_by=int(correct))

    @staticmethod
    def _infer_decision_spec_from_condition_node(
        graph: Dict[str, Any],
        condition_node: dict,
    ) -> Optional[Dict[str, Any]]:
        """routeMode=previous_approver 时，前序审批人须在审核页按下标选边。"""
        if not isinstance(condition_node, dict) or condition_node.get("type") != "condition":
            return None
        condition_id = str(condition_node.get("id") or "").strip()
        if not condition_id:
            return None
        edges = graph.get("edges") or []
        out_edges = [
            e for e in edges
            if isinstance(e, dict) and str(e.get("source") or "") == condition_id
        ]
        if len(out_edges) < 2:
            return None
        route_mode = ApprovalInstanceService._condition_node_route_mode(
            condition_node, out_edge_count=len(out_edges)
        )
        if route_mode != "previous_approver":
            return None
        node_list = graph.get("nodes") or []
        by_id = {
            str(n.get("id")): n
            for n in node_list
            if isinstance(n, dict) and n.get("id") is not None
        }
        data = condition_node.get("data") if isinstance(condition_node.get("data"), dict) else {}
        label = str(data.get("label") or "").strip() or "后续分支"
        conditions = data.get("conditions") or data.get("condition_list") or []
        branches: List[Dict[str, Any]] = []
        for i, edge in enumerate(out_edges):
            cond = conditions[i] if i < len(conditions) and isinstance(conditions[i], dict) else {}
            branch_label = str(cond.get("label") or "").strip()
            if not branch_label:
                target = by_id.get(str(edge.get("target") or ""))
                branch_label = ApprovalInstanceService._node_display_label(target) or f"分支{i + 1}"
            branches.append({"index": i, "label": branch_label})
        index_field = ApprovalInstanceService._condition_branch_index_key(condition_id)
        first_label = branches[0]["label"] if branches else "是"
        last_label = branches[-1]["label"] if branches else "否"
        return {
            "field": index_field,
            "label": label,
            "kind": "branch_index",
            "branches": branches,
            "trueBranchLabel": first_label,
            "falseBranchLabel": last_label,
            "conditionNodeId": condition_id,
            "requireExplicit": True,
            "defaultValue": None,
        }

    @staticmethod
    def _resolve_decision_on_approve_spec(
        graph: Dict[str, Any],
        approval_node: dict,
    ) -> Optional[Dict[str, Any]]:
        """下一条件节点为 previous_approver 时强制审核人选边；旧 decisionOnApprove 仅在此场景兼容。"""
        node_id = str(approval_node.get("id") or "")
        if not node_id:
            return None
        next_node = ApprovalInstanceService._get_next_node(graph, node_id, instance=None)
        if not next_node or next_node.get("type") != "condition":
            return None
        inferred = ApprovalInstanceService._infer_decision_spec_from_condition_node(graph, next_node)
        if not inferred:
            return None
        data = approval_node.get("data") if isinstance(approval_node.get("data"), dict) else {}
        explicit = data.get("decisionOnApprove")
        if isinstance(explicit, dict) and str(explicit.get("label") or "").strip():
            inferred = dict(inferred)
            inferred["label"] = str(explicit.get("label")).strip()
            default_raw = explicit.get("defaultValue")
            if default_raw is not None:
                inferred["defaultValue"] = 0 if bool(default_raw) else len(inferred.get("branches") or []) - 1
        return inferred

    @staticmethod
    async def _apply_decision_on_approve(
        instance: ApprovalInstance,
        node_id: Optional[str],
        process_nodes: Any,
        action_data: ApprovalInstanceAction,
        *,
        decided_by: Optional[int] = None,
    ) -> None:
        """审批通过时写入分支下标；previous_approver 条件必须带显式选择，禁止默认跳边。"""
        from core.schemas.approval_flow_schema import get_node_config, normalize_flow_graph

        if not node_id:
            return
        graph = normalize_flow_graph(process_nodes or {})
        node = get_node_config(graph, str(node_id))
        if not node or node.get("type") != "approval":
            return
        spec = ApprovalInstanceService._resolve_decision_on_approve_spec(graph, node)
        if not spec:
            return
        field = str(spec.get("field") or "").strip()
        if not field:
            raise ValidationError("审批分支决策未配置 field")
        patch = action_data.instance_data_patch if isinstance(action_data.instance_data_patch, dict) else {}
        label = str(spec.get("label") or "后续分支")
        if field not in patch:
            raise ValidationError(f"请选择「{label}」后再审核通过")
        value = patch[field]
        branches = spec.get("branches") if isinstance(spec.get("branches"), list) else []
        branch_count = len(branches) if branches else 2
        edge_index: Optional[int] = None
        if isinstance(value, bool):
            edge_index = 0 if value else branch_count - 1
        elif isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in ("true", "1", "yes", "on"):
                edge_index = 0
            elif lowered in ("false", "0", "no", "off"):
                edge_index = branch_count - 1
            else:
                try:
                    edge_index = int(value.strip())
                except (TypeError, ValueError) as exc:
                    raise ValidationError(f"审批分支决策 {field!r} 须为分支下标") from exc
        else:
            try:
                edge_index = int(value)
            except (TypeError, ValueError) as exc:
                raise ValidationError(f"请选择「{label}」后再审核通过") from exc
        if edge_index is None or edge_index < 0 or edge_index >= branch_count:
            raise ValidationError(f"分支选择下标无效，须在 0～{branch_count - 1} 之间")
        data = dict(instance.data or {})
        condition_node_id = str(spec.get("conditionNodeId") or "").strip()
        if not condition_node_id:
            next_node = ApprovalInstanceService._get_next_node(graph, str(node_id), instance=None)
            if next_node and next_node.get("type") == "condition":
                condition_node_id = str(next_node.get("id") or "").strip()
        if condition_node_id:
            index_key = ApprovalInstanceService._condition_branch_index_key(condition_node_id)
            data[index_key] = edge_index
            data[field] = edge_index
            if branch_count == 2:
                data[ApprovalInstanceService._condition_branch_route_key(condition_node_id)] = edge_index == 0
        else:
            data[field] = edge_index
        if decided_by and int(decided_by) > 0:
            data[ApprovalInstanceService.BRANCH_DECIDED_BY_KEY] = int(decided_by)
        instance.data = data
        await instance.save(update_fields=["data", "updated_at"])

    @staticmethod
    async def _resolve_submitter_department_manager_at_level(
        tenant_id: int,
        submitter_id: int,
        level: int,
    ) -> List[int]:
        """
        沿发起人部门向上，按出现顺序取第 level 个有效部门负责人（level=1 为链上第一个负责人）。
        """
        if level < 1:
            return []
        submitter = await User.filter(
            id=submitter_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).first()
        dept_id = getattr(submitter, "department_id", None) if submitter else None
        visited: set[int] = set()
        found = 0
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
                    found += 1
                    if found == level:
                        return active
            dept_id = getattr(dept, "parent_id", None)
        return []

    @staticmethod
    async def _resolve_node_approvers(node: dict, instance: ApprovalInstance) -> List[int]:
        """
        解析节点审批人。兼容前端 camelCase（approverType, approverIds）与后端 snake_case。
        支持：user（指定用户）、role（角色）、department（部门负责人）、manager（直属上级）、
        multi_level_manager（沿部门树第 N 级负责人；不足 N 级返回空列表由创建任务侧跳过）、
        initiator_select / form / form_select / selected（发起时勾选快照）。
        找不到有效审批人时抛 ValidationError（multi_level_manager 不足级数除外），禁止回落到提交人。
        """
        node_data = node.get("data", {})
        node_id = str(node.get("id") or "")
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
        instance_data = instance.data if isinstance(instance.data, dict) else {}

        async def _from_selected_snapshot() -> List[int]:
            by_node = instance_data.get("selected_approver_by_node") or {}
            if isinstance(by_node, dict) and node_id and by_node.get(node_id):
                raw = by_node.get(node_id) or []
            else:
                raw = instance_data.get("selected_approver_user_ids") or []
                snap = instance_data.get("selected_approver_snapshot") or {}
                if not raw and isinstance(snap, dict):
                    raw = snap.get("user_ids") or []
            ids = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                tenant_id, raw or [], by_uuid=None
            )
            active = await ApprovalInstanceService._filter_active_user_ids(tenant_id, ids)
            if not active:
                raise ValidationError(
                    f"审批节点 {node_id or approver_type} 缺少发起时勾选的有效人员快照，无法提交审核"
                )
            return active

        if approver_type in {"form", "form_select", "selected", "initiator_select"}:
            return await _from_selected_snapshot()

        if approver_type == "user":
            ids = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                tenant_id, approver_ids_raw or [], by_uuid=None
            )
            if ids:
                return ids
            # 节点未写死人员时，允许使用发起快照
            if instance_data.get("selected_approver_user_ids") or instance_data.get(
                "selected_approver_by_node"
            ):
                return await _from_selected_snapshot()
            raise ValidationError(
                f"审批节点未配置有效指定人员（approverType=user），无法提交审核"
            )

        if approver_type == "role":
            # approverIds 存角色 UUID，解析该角色下所有用户
            try:
                role_uuids = [str(x).strip() for x in approver_ids_raw if x]
                if not role_uuids:
                    raise ValidationError(
                        "审批节点未配置角色（approverType=role），无法提交审核"
                    )
                roles = await Role.filter(
                    tenant_id=tenant_id,
                    uuid__in=role_uuids,
                    deleted_at__isnull=True,
                    is_active=True,
                ).all()
                if not roles:
                    raise ValidationError(
                        "审批节点配置的角色不存在或已停用，无法提交审核"
                    )
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
                raise ValidationError(
                    "审批节点角色下无可用用户，无法提交审核"
                )
            except ValidationError:
                raise
            except Exception as e:
                logger.error("解析角色审批人失败: {}", e)
                raise ValidationError(f"解析角色审批人失败: {e}") from e

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
                    raise ValidationError(
                        "审批节点指定部门未配置可用负责人，无法提交审核"
                    )
                managers = await ApprovalInstanceService._resolve_submitter_department_manager_ids(
                    tenant_id, submitter_id, walk_parent=True
                )
                if managers:
                    return managers
                raise ValidationError(
                    "提交人部门未配置可用负责人，无法提交审核"
                )
            except ValidationError:
                raise
            except Exception as e:
                logger.error("解析部门负责人失败: {}", e)
                raise ValidationError(f"解析部门负责人失败: {e}") from e

        if approver_type == "manager":
            try:
                managers = await ApprovalInstanceService._resolve_submitter_department_manager_ids(
                    tenant_id, submitter_id, walk_parent=False
                )
                if managers:
                    return managers
                raise ValidationError(
                    "提交人直属部门未配置可用负责人，无法提交审核"
                )
            except ValidationError:
                raise
            except Exception as e:
                logger.error("解析直属上级失败: {}", e)
                raise ValidationError(f"解析直属上级失败: {e}") from e

        if approver_type == "multi_level_manager":
            try:
                raw_level = node_data.get("managerLevel") or node_data.get("manager_level") or 2
                try:
                    level = int(raw_level)
                except (TypeError, ValueError) as exc:
                    raise ValidationError(
                        f"审批节点 managerLevel 非法: {raw_level!r}"
                    ) from exc
                if level < 2:
                    raise ValidationError("multi_level_manager 的 managerLevel 须 ≥ 2")
                managers = await ApprovalInstanceService._resolve_submitter_department_manager_at_level(
                    tenant_id, submitter_id, level
                )
                # 有第 N 级负责人则返回；不足 N 级返回空，由创建任务侧按 auto_pass 跳过
                return managers
            except ValidationError:
                raise
            except Exception as e:
                logger.error("解析多级上级失败: {}", e)
                raise ValidationError(f"解析多级上级失败: {e}") from e

        raise ValidationError(
            f"不支持的审批人类型 {approver_type!r}，无法提交审核"
        )

    @staticmethod
    async def _check_node_completion(
        instance: ApprovalInstance,
        last_action: Optional[str] = None,
    ) -> tuple[bool, str]:
        """
        检查当前节点是否完成。

        或签 (OR)：任一人通过即完成（后加签 pending 除外）；任一人驳回即拒绝。
        会签 (AND)：全部通过才完成；任一人驳回即拒绝。

        返回: (是否完成, 建议状态 approved|rejected|pending)
        """
        del last_action  # 完成判定以任务状态为准，保留参数仅兼容旧调用
        node_id = instance.current_node
        node_id_str = str(node_id or "").strip()
        if not node_id_str:
            return False, "pending"

        process = instance.process
        process_nodes = (process.nodes if process else None) or {}
        graph = ApprovalInstanceService._normalize_process_graph(process_nodes)

        current_node_config = None
        for node in graph.get("nodes") or []:
            if not isinstance(node, dict):
                continue
            if str(node.get("id") or "").strip() == node_id_str:
                current_node_config = node
                break

        # 找不到节点配置时不得冒充已通过（否则 reconcile 会在投票前推进并取消待办）
        if not current_node_config:
            return False, "pending"

        data = current_node_config.get("data", {}) or {}
        approval_type = str(
            data.get("approvalType") or data.get("approval_type") or "OR"
        ).upper()

        tasks = await ApprovalTask.filter(approval_instance=instance, node_id=node_id).all()
        active = [t for t in tasks if t.status not in ("transferred", "suspended", "cancelled")]

        # 一人驳回即整节点拒绝（或签/会签相同）
        if any(t.status == "rejected" for t in active):
            return True, "rejected"

        if approval_type == "OR":
            # 后加签：发起人已通过，须等后加签人处理完再推进
            if any(t.status == "pending" and t.sign_type == "after" for t in active):
                return False, "pending"
            if any(t.status == "approved" for t in active):
                return True, "approved"
            return False, "pending"

        # 会签：须无 pending，且有效任务全部通过
        if any(t.status == "pending" for t in active):
            return False, "pending"
        if active and all(t.status == "approved" for t in active):
            return True, "approved"
        return False, "pending"

    @staticmethod
    async def _advance_instance_after_node_completion(
        tenant_id: int,
        instance: ApprovalInstance,
        instance_status: str,
        *,
        route_action_by: Optional[int] = None,
    ) -> ApprovalInstance:
        """节点完成后取消同节点剩余待办，并推进到下一节点或结束流程。"""
        completed_node_id = instance.current_node
        if completed_node_id:
            await ApprovalTask.filter(
                approval_instance_id=instance.id,
                node_id=completed_node_id,
                status__in=["pending", "suspended"],
            ).update(status="cancelled")

        if not instance.process:
            await instance.fetch_related("process")

        if instance_status == "rejected":
            instance.status = "rejected"
            instance.completed_at = resolve_business_datetime()
            instance.current_node = None
            instance.current_approver_id = None
            await instance.save()
        else:
            next_node = ApprovalInstanceService._get_next_node(
                instance.process.nodes, completed_node_id, instance=instance
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
                    await ApprovalInstanceService._create_node_tasks(
                        tenant_id,
                        instance,
                        next_node,
                        route_action_by=route_action_by,
                    )

        if instance.status in ("approved", "rejected"):
            await ApprovalInstanceService._handle_approval_completion(tenant_id, instance)
        return instance

    @staticmethod
    async def _reconcile_current_node_completion(
        tenant_id: int,
        instance: ApprovalInstance,
    ) -> bool:
        """
        若当前节点按或签/会签规则已满足完成条件，则推进。
        用于打开审批状态时收敛「或签已通过但仍卡住」的历史实例。
        """
        if instance.status != "pending" or not instance.current_node:
            return False
        if not instance.process:
            await instance.fetch_related("process")
        if not instance.process:
            return False

        node_completed, instance_status = await ApprovalInstanceService._check_node_completion(
            instance
        )
        if not node_completed:
            return False
        await ApprovalInstanceService._advance_instance_after_node_completion(
            tenant_id, instance, instance_status
        )
        return True

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
        
        # 异步发送消息通知（须脱离事务 context，避免与主链路共用连接）
        ApprovalInstanceService._spawn_background(
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
            "approval_instance_uuid": str(instance.uuid),
            "mobile_path": f"/(tabs)/approval/detail?uuid={instance.uuid}",
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
        process: Optional[ApprovalProcess] = None,
    ) -> None:
        """提交后仅通知当前审批人（待办）；不给提交人刷「已提交」以免打扰。"""
        try:
            if process is None:
                await approval_instance.fetch_related("process")
                process = approval_instance.process
            if not process:
                return
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
    def _coerce_condition_pair(actual: Any, expected: Any) -> tuple[Any, Any] | None:
        """数字条件统一按 Decimal 比较，避免 str/float 混用导致分支永不命中。"""
        from decimal import Decimal, InvalidOperation

        if actual is None or expected is None:
            return actual, expected
        try:
            left = Decimal(str(actual).strip())
            right = Decimal(str(expected).strip())
            return left, right
        except (InvalidOperation, ValueError, TypeError, AttributeError):
            return actual, expected

    @staticmethod
    def _evaluate_conditions(instance: ApprovalInstance, conditions: List[Dict[str, Any]]) -> int:
        """
        按顺序评估条件，返回第一条满足条件的下标。
        无命中且无「其余」分支返回 -1；有 else 则返回其下标。
        条件项：{ "field": str, "operator": str, "value": any, "else": bool }。
        """
        if not conditions:
            return -1
        data = instance.data or {}
        else_index = -1
        for i, cond in enumerate(conditions):
            if not isinstance(cond, dict):
                continue
            if cond.get("else"):
                else_index = i
        for i, cond in enumerate(conditions):
            if not isinstance(cond, dict):
                continue
            if cond.get("else"):
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
                elif operator in (">", "gt", "<", "lt", ">=", "gte", "<=", "lte"):
                    left, right = ApprovalInstanceService._coerce_condition_pair(actual, value)
                    if left is None or right is None:
                        continue
                    if operator in (">", "gt") and left > right:
                        return i
                    if operator in ("<", "lt") and left < right:
                        return i
                    if operator in (">=", "gte") and left >= right:
                        return i
                    if operator in ("<=", "lte") and left <= right:
                        return i
                elif operator == "contains":
                    if value is not None and actual is not None and str(value) in str(actual):
                        return i
            except (TypeError, ValueError):
                continue
        return else_index

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
        *,
        on_missing_branch: str = "raise",
    ) -> Optional[dict]:
        """
        获取下一个节点。支持 ProFlow 格式；当前节点为 condition 时按 instance.data 与 conditions 选边。

        on_missing_branch:
          - raise：缺选边时抛 ValidationError（审核执行路径）
          - stop：缺选边时返回 None（bootstrap 补齐路径，禁止把概况接口打挂）
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

        # 条件节点：人工选边读 __branch_index_*；公式模式按规则求值。
        if node_type == "condition" and instance and current_node:
            inst_data = instance.data if isinstance(instance.data, dict) else {}
            route_mode = ApprovalInstanceService._condition_node_route_mode(
                current_node, out_edge_count=len(out_edges)
            )
            cond_label = ApprovalInstanceService._node_display_label(current_node) or "后续分支"
            if route_mode in ("previous_approver", "initiator"):
                edge_index = ApprovalInstanceService._read_branch_edge_index(
                    inst_data, str(current_node_id), len(out_edges)
                )
                if edge_index is None:
                    if on_missing_branch == "stop":
                        return None
                    if route_mode == "previous_approver":
                        raise ValidationError(
                            f"请先由前序审批人选择「{cond_label}」后再继续，禁止默认跳转"
                        )
                    raise ValidationError(
                        f"流程发起人须在提交时选择「{cond_label}」分支，禁止默认跳转"
                    )
            elif route_mode == "formula":
                data = current_node.get("data", {}) if isinstance(current_node, dict) else {}
                conditions = data.get("conditions") or data.get("condition_list") or []
                edge_index = ApprovalInstanceService._evaluate_conditions(instance, conditions)
                if edge_index < 0 or edge_index >= len(out_edges):
                    if on_missing_branch == "stop":
                        return None
                    raise ValidationError(
                        f"条件节点「{cond_label}」未命中任何规则且未配置其余分支，流程无法继续"
                    )
            else:
                edge_index = ApprovalInstanceService._read_branch_edge_index(
                    inst_data, str(current_node_id), len(out_edges)
                )
                if edge_index is None:
                    data = current_node.get("data", {}) if isinstance(current_node, dict) else {}
                    conditions = data.get("conditions") or data.get("condition_list") or []
                    edge_index = ApprovalInstanceService._evaluate_conditions(instance, conditions)
                    if edge_index < 0 or edge_index >= len(out_edges):
                        if on_missing_branch == "stop":
                            return None
                        raise ValidationError(
                            f"条件节点「{cond_label}」无法确定出边，禁止默认走第一条"
                        )
            next_node_id = out_edges[edge_index].get("target")
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
        to_approver_id: Optional[int] = None,
        change_payload: Optional[Dict[str, Any]] = None,
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
            change_payload: 驳回落点、审核中改单等扩展明细
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
                to_approver_id=to_approver_id,
                change_payload=change_payload,
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
                if not entity_id:
                    return
                from apps.kuaizhizao.services.sales_order_service import SalesOrderService
                service = SalesOrderService()
                sales_order_id = int(entity_id)
                if approval_instance.status == "approved":
                    await service.approve_sales_order(
                        tenant_id=tenant_id,
                        sales_order_id=sales_order_id,
                        approved_by=approver_id,
                        is_auto_approve=True,
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_sales_order(
                        tenant_id=tenant_id,
                        sales_order_id=sales_order_id,
                        approved_by=approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"销售订单 {sales_order_id} 审批回调完成: {approval_instance.status}")

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

            async def _handle_kuaioa_dept_training_application() -> None:
                from apps.kuaioa.services.training_workflow_service import (
                    apply_dept_training_application_decision,
                )

                approved = approval_instance.status == "approved"
                await apply_dept_training_application_decision(
                    tenant_id, entity_id, approved, approver_id
                )
                logger.info(
                    f"部门培训申请 {entity_id} 审批回调完成: {approval_instance.status}"
                )

            async def _handle_kuaioa_training_plan() -> None:
                from apps.kuaioa.services.training_workflow_service import (
                    apply_training_plan_decision,
                )

                approved = approval_instance.status == "approved"
                await apply_training_plan_decision(
                    tenant_id, entity_id, approved, approver_id
                )
                logger.info(
                    f"年度培训计划 {entity_id} 审批回调完成: {approval_instance.status}"
                )

            async def _handle_kuaioa_special_work_qualification() -> None:
                from apps.kuaioa.services.training_workflow_service import (
                    apply_special_work_qualification_decision,
                )

                approved = approval_instance.status == "approved"
                await apply_special_work_qualification_decision(
                    tenant_id, entity_id, approved, approver_id
                )
                logger.info(
                    f"特殊作业资格 {entity_id} 审批回调完成: {approval_instance.status}"
                )

            async def _handle_sales_delivery() -> None:
                from apps.kuaizhizao.services.warehouse_service import SalesDeliveryService

                service = SalesDeliveryService()
                if approval_instance.status == "approved":
                    await service.approve_sales_delivery(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_sales_delivery(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"销售出库 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_production_picking() -> None:
                from apps.kuaizhizao.services.warehouse_service import ProductionPickingService

                service = ProductionPickingService()
                if approval_instance.status == "approved":
                    await service.approve_production_picking(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_production_picking(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"生产领料 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_payable() -> None:
                from apps.kuaicaiwu.services.finance_service import PayableService

                service = PayableService()
                if approval_instance.status == "approved":
                    await service.approve_payable(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_payable(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"应付单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_receivable() -> None:
                from apps.kuaicaiwu.services.finance_service import ReceivableService

                service = ReceivableService()
                if approval_instance.status == "approved":
                    await service.approve_receivable(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_receivable(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"应收单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_purchase_invoice() -> None:
                from apps.kuaicaiwu.services.finance_service import PurchaseInvoiceService

                service = PurchaseInvoiceService()
                if approval_instance.status == "approved":
                    await service.approve_invoice(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_invoice(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"采购发票 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_product_firmware() -> None:
                from apps.kuaiplm.services.product_firmware_service import ProductFirmwareService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = ProductFirmwareService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"产品固件 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_lab_request() -> None:
                from apps.kuaiplm.schemas.lab_request import LabRequestRejectRequest
                from apps.kuaiplm.services.lab_request_service import LabRequestService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = LabRequestService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(
                        tenant_id,
                        int(entity_id),
                        LabRequestRejectRequest(reason="审批驳回"),
                        approver,
                    )
                logger.info(f"实验委托 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_production_file() -> None:
                from apps.kuaiplm.services.production_file_service import ProductionFileService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = ProductionFileService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"生产文件 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_trial_flow() -> None:
                from apps.kuaiplm.services.trial_flow_service import TrialFlowService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = TrialFlowService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"试流单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_rework_order() -> None:
                from apps.kuaizhizao.services.rework_order_service import ReworkOrderService

                if not entity_id:
                    return
                svc = ReworkOrderService()
                if approval_instance.status == "approved":
                    await svc.approve_rework_order(tenant_id, int(entity_id), approver_id)
                elif approval_instance.status == "rejected":
                    await svc.reject_rework_order(tenant_id, int(entity_id), approver_id)
                logger.info(f"返工单 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_quality_complaint() -> None:
                from apps.kuaizhizao.services.quality_complaint_service import QualityComplaintService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = QualityComplaintService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"质量投诉 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_engineering_change() -> None:
                from apps.kuaiplm.services.engineering_change_service import EngineeringChangeService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = EngineeringChangeService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"工程变更 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_sample_process() -> None:
                from apps.kuaiplm.services.sample_process_service import SampleProcessService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = SampleProcessService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"样品加工申请 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_prototype_build_sheet() -> None:
                from apps.kuaiplm.services.prototype_build_sheet_service import (
                    PrototypeBuildSheetService,
                )
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = PrototypeBuildSheetService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"样机制作书 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_rd_deliverable() -> None:
                from apps.kuaiplm.services.rd_project_service import RdProjectService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = RdProjectService()
                if approval_instance.status == "approved":
                    await svc.approve_deliverable_by_id(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject_deliverable_by_id(tenant_id, int(entity_id), approver)
                logger.info(f"研发交付物 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_qms_system_document() -> None:
                from apps.kuaizhizao.services.quality_qms_service import QmsSystemDocumentService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                actor_name = (
                    getattr(approver, "full_name", None)
                    or getattr(approver, "username", None)
                    or str(approver.id)
                )
                svc = QmsSystemDocumentService()
                if approval_instance.status == "approved":
                    await svc.approve_document_after_audit(
                        tenant_id,
                        int(entity_id),
                        actor_id=approver.id,
                        actor_name=actor_name,
                    )
                elif approval_instance.status == "rejected":
                    await svc.reject_document_after_audit(
                        tenant_id,
                        int(entity_id),
                        actor_id=approver.id,
                        actor_name=actor_name,
                    )
                logger.info(f"体系文件 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_material_review() -> None:
                from apps.kuaiplm.services.material_review_service import MaterialReviewService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = MaterialReviewService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"物料评审 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_bom_collaboration() -> None:
                from apps.kuaiplm.services.bom_collaboration_service import BomCollaborationService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = BomCollaborationService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"BOM 协同 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_project_proposal() -> None:
                from apps.kuaiplm.services.project_proposal_service import ProjectProposalService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = ProjectProposalService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"项目建议书 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_mold_sample() -> None:
                from apps.kuaiplm.services.mold_sample_order_service import MoldSampleOrderService
                from infra.models.user import User

                if not entity_id:
                    return
                approver = await User.get_or_none(id=approver_id)
                if not approver:
                    return
                svc = MoldSampleOrderService()
                if approval_instance.status == "approved":
                    await svc.approve(tenant_id, int(entity_id), approver)
                elif approval_instance.status == "rejected":
                    await svc.reject(tenant_id, int(entity_id), approver)
                logger.info(f"开模/打样 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_incoming_inspection() -> None:
                from apps.kuaizhizao.services.quality_service import IncomingInspectionService

                if not entity_id:
                    return
                service = IncomingInspectionService()
                if approval_instance.status == "approved":
                    await service.approve_inspection(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_inspection(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"来料检验 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_process_inspection() -> None:
                from apps.kuaizhizao.services.quality_service import ProcessInspectionService

                if not entity_id:
                    return
                service = ProcessInspectionService()
                if approval_instance.status == "approved":
                    await service.approve_inspection(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_inspection(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"过程检验 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_finished_goods_inspection() -> None:
                from apps.kuaizhizao.services.quality_service import FinishedGoodsInspectionService

                if not entity_id:
                    return
                service = FinishedGoodsInspectionService()
                if approval_instance.status == "approved":
                    await service.approve_inspection(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_inspection(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"成品检验 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_oqc_inspection() -> None:
                from apps.kuaizhizao.services.quality_improvement_service import OQCInspectionService

                if not entity_id:
                    return
                service = OQCInspectionService()
                if approval_instance.status == "approved":
                    await service.approve(
                        tenant_id, int(entity_id), approver_id, approve=True, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.approve(
                        tenant_id, int(entity_id), approver_id, approve=False, is_auto_approve=True
                    )
                logger.info(f"出货检验 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_purchase_inquiry() -> None:
                from apps.kuaizhizao.services.purchase_inquiry_service import PurchaseInquiryService

                if not entity_id:
                    return
                service = PurchaseInquiryService()
                if approval_instance.status == "approved":
                    await service.approve_inquiry(
                        tenant_id,
                        int(entity_id),
                        True,
                        approver_id,
                        remarks="审批通过",
                        is_auto_approve=True,
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_inquiry(
                        tenant_id,
                        int(entity_id),
                        False,
                        approver_id,
                        remarks="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"采购询价 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_purchase_request() -> None:
                from apps.kuaizhizao.services.purchase_requisition_service import (
                    PurchaseRequisitionService,
                )

                if not entity_id:
                    return
                service = PurchaseRequisitionService()
                if approval_instance.status == "approved":
                    await service.approve_requisition(
                        tenant_id,
                        int(entity_id),
                        True,
                        review_remarks="审批通过",
                        approved_by=approver_id,
                        is_auto_approve=True,
                    )
                elif approval_instance.status == "rejected":
                    await service.approve_requisition(
                        tenant_id,
                        int(entity_id),
                        False,
                        review_remarks="审批驳回",
                        approved_by=approver_id,
                        is_auto_approve=True,
                    )
                logger.info(f"采购申请 {entity_id} 审批回调完成: {approval_instance.status}")

            async def _handle_work_order() -> None:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService

                if not entity_id:
                    return
                service = WorkOrderService()
                if approval_instance.status == "approved":
                    await service.approve_work_order(
                        tenant_id, int(entity_id), approver_id, is_auto_approve=True
                    )
                elif approval_instance.status == "rejected":
                    await service.reject_work_order(
                        tenant_id,
                        int(entity_id),
                        approver_id,
                        rejection_reason="审批驳回",
                        is_auto_approve=True,
                    )
                logger.info(f"生产工单 {entity_id} 审批回调完成: {approval_instance.status}")

            completion_handlers = {
                "sales_order": _handle_sales_order,
                "demand": _handle_demand,
                "purchase_order": _handle_purchase_order,
                "purchase_inquiry": _handle_purchase_inquiry,
                "purchase_request": _handle_purchase_request,
                "work_order": _handle_work_order,
                "bom_change": _handle_bom_change,
                "process_route_change": _handle_process_route_change,
                "quotation": _handle_quotation,
                "kuaioa_form_request": _handle_kuaioa_form_request,
                "kuaioa_asset_purchase": _handle_kuaioa_asset_purchase,
                "kuaioa_dept_training_application": _handle_kuaioa_dept_training_application,
                "kuaioa_training_plan": _handle_kuaioa_training_plan,
                "kuaioa_special_work_qualification": _handle_kuaioa_special_work_qualification,
                "sales_delivery": _handle_sales_delivery,
                "production_picking": _handle_production_picking,
                "payable": _handle_payable,
                "receivable": _handle_receivable,
                "purchase_invoice": _handle_purchase_invoice,
                "product_firmware": _handle_product_firmware,
                "lab_request": _handle_lab_request,
                "production_file": _handle_production_file,
                "trial_flow": _handle_trial_flow,
                "rework_order": _handle_rework_order,
                "quality_complaint": _handle_quality_complaint,
                "engineering_change": _handle_engineering_change,
                "sample_process": _handle_sample_process,
                "prototype_build_sheet": _handle_prototype_build_sheet,
                "rd_deliverable": _handle_rd_deliverable,
                "qms_system_document": _handle_qms_system_document,
                "material_review": _handle_material_review,
                "bom_collaboration": _handle_bom_collaboration,
                "project_proposal": _handle_project_proposal,
                "mold_sample": _handle_mold_sample,
                "incoming_inspection": _handle_incoming_inspection,
                "process_inspection": _handle_process_inspection,
                "finished_goods_inspection": _handle_finished_goods_inspection,
                "oqc_inspection": _handle_oqc_inspection,
            }
            handler = completion_handlers.get(entity_type)
            if handler:
                await handler()
                # 成功写回则清失败留痕，便于补齐重试
                data = dict(approval_instance.data or {})
                if data.pop("writeback_failure", None) is not None:
                    approval_instance.data = data
                    await approval_instance.save(update_fields=["data", "updated_at"])

        except Exception as e:
            logger.error(f"处理审批完成回调失败: {str(e)}")
            try:
                data = dict(approval_instance.data or {})
                data["writeback_failure"] = {
                    "error": str(e),
                    "entity_type": (approval_instance.data or {}).get("entity_type"),
                    "entity_id": (approval_instance.data or {}).get("entity_id"),
                    "instance_status": approval_instance.status,
                }
                approval_instance.data = data
                await approval_instance.save(update_fields=["data", "updated_at"])
            except Exception as save_exc:
                logger.error(f"记录审批完成回调失败留痕时出错: {save_exc}")

