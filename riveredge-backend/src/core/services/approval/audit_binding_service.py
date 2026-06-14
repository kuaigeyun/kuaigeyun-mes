"""
审核单据绑定服务

manifest.audit 声明「哪些单据可审核」；本服务管理租户级「开关 + 流程」绑定。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from loguru import logger

from core.config.audit_registry import AuditEntry, all_entries, entry_by_node_key, is_auditable_node_key
from core.models.approval_process import ApprovalProcess
from core.models.audit_document_binding import AuditDocumentBinding
from core.services.approval.approval_process_service import ApprovalProcessService
from core.services.system.installed_feature_scope import get_installed_application_codes
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AuditBindingService:
    """审核单据 ↔ 审批流程绑定"""

    @staticmethod
    async def _ensure_binding_row(tenant_id: int, node_key: str) -> AuditDocumentBinding:
        binding = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            node_key=node_key,
            deleted_at__isnull=True,
        ).first()
        if binding:
            return binding
        return await AuditDocumentBinding.create(
            tenant_id=tenant_id,
            node_key=node_key,
            is_enabled=False,
            process_id=None,
        )

    @staticmethod
    async def _default_process_for_node(tenant_id: int, node_key: str) -> Optional[ApprovalProcess]:
        """优先使用同 code 的预设流程作为默认绑定目标。"""
        return await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=node_key,
            deleted_at__isnull=True,
        ).first()

    @staticmethod
    async def _resolve_process(
        tenant_id: int,
        process_uuid: UUID,
    ) -> ApprovalProcess:
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=str(process_uuid),
            deleted_at__isnull=True,
        ).first()
        if not process:
            raise NotFoundError(f"审批流程 {process_uuid} 不存在")
        return process

    @staticmethod
    async def _activate_process_if_needed(process: ApprovalProcess) -> None:
        if process.is_active:
            return
        process.is_active = True
        await process.save()
        await ApprovalProcessService._sync_inngest_workflow(process)

    @staticmethod
    async def get_binding_map(tenant_id: int) -> Dict[str, AuditDocumentBinding]:
        rows = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process")
        return {str(r.node_key): r for r in rows}

    @staticmethod
    async def list_bindings(tenant_id: int) -> Dict[str, Any]:
        installed = await get_installed_application_codes(tenant_id)
        binding_map = await AuditBindingService.get_binding_map(tenant_id)
        process_options = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).order_by("name").all()

        items: List[Dict[str, Any]] = []
        for entry in all_entries():
            if entry.app not in installed:
                continue
            binding = binding_map.get(entry.node_key)
            process = binding.process if binding else None
            items.append(
                {
                    "node_key": entry.node_key,
                    "entity_type": entry.entity_type,
                    "resource": entry.resource,
                    "name": entry.name,
                    "app": entry.app,
                    "config_category": entry.config_category,
                    "template": entry.template,
                    "is_enabled": bool(binding and binding.is_enabled),
                    "process_uuid": str(process.uuid) if process else None,
                    "process_name": process.name if process else None,
                    "process_code": process.code if process else None,
                }
            )

        return {
            "items": items,
            "process_options": [
                {
                    "uuid": str(p.uuid),
                    "name": p.name,
                    "code": p.code,
                    "is_active": p.is_active,
                }
                for p in process_options
            ],
        }

    @staticmethod
    async def update_binding(
        tenant_id: int,
        node_key: str,
        *,
        is_enabled: Optional[bool] = None,
        process_uuid: Optional[UUID] = None,
    ) -> AuditDocumentBinding:
        if not is_auditable_node_key(node_key):
            raise ValidationError(f"单据节点 {node_key} 未在 manifest.audit 中声明")

        binding = await AuditBindingService._ensure_binding_row(tenant_id, node_key)

        if process_uuid is not None:
            process = await AuditBindingService._resolve_process(tenant_id, process_uuid)
            binding.process_id = process.id

        if is_enabled is not None:
            binding.is_enabled = is_enabled
            if is_enabled:
                if not binding.process_id:
                    default_process = await AuditBindingService._default_process_for_node(
                        tenant_id, node_key
                    )
                    if not default_process:
                        raise ValidationError(
                            f"启用 {node_key} 审核前请先选择审批流程"
                        )
                    binding.process_id = default_process.id
                process = await ApprovalProcess.get(id=binding.process_id)
                await AuditBindingService._activate_process_if_needed(process)

        await binding.save()
        await binding.fetch_related("process")
        return binding

    @staticmethod
    async def is_audit_enabled(tenant_id: int, node_key: str) -> bool:
        if not node_key or not is_auditable_node_key(node_key):
            return False
        binding = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            node_key=node_key,
            is_enabled=True,
            deleted_at__isnull=True,
        ).prefetch_related("process").first()
        if not binding or not binding.process_id:
            return False
        process = binding.process
        return bool(process and process.is_active and process.deleted_at is None)

    @staticmethod
    async def get_audit_required_map(
        tenant_id: int,
        node_keys: Optional[List[str]] = None,
    ) -> Dict[str, bool]:
        keys = [k for k in (node_keys or [e.node_key for e in all_entries()]) if k]
        if not keys:
            return {}
        rows = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            node_key__in=keys,
            is_enabled=True,
            deleted_at__isnull=True,
        ).prefetch_related("process")
        enabled: Set[str] = set()
        for row in rows:
            if row.process and row.process.is_active and row.process.deleted_at is None:
                enabled.add(str(row.node_key))
        return {key: key in enabled for key in keys}

    @staticmethod
    async def resolve_process_for_node(
        tenant_id: int,
        node_key: str,
    ) -> Optional[ApprovalProcess]:
        """解析 node_key 绑定的可用审批流程（启用开关且流程可用）。"""
        if not await AuditBindingService.is_audit_enabled(tenant_id, node_key):
            return None
        binding = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            node_key=node_key,
            is_enabled=True,
            deleted_at__isnull=True,
        ).prefetch_related("process").first()
        if not binding or not binding.process:
            return None
        return binding.process

    @staticmethod
    async def seed_bindings_for_tenant(
        tenant_id: int,
        *,
        only_node_keys: Optional[Set[str]] = None,
    ) -> int:
        """
        为租户补齐绑定行；若存在 legacy ApprovalProcess(code=node_key, is_active=True) 则迁移开关与流程。
        """
        created = 0
        for entry in all_entries():
            if only_node_keys is not None and entry.node_key not in only_node_keys:
                continue
            exists = await AuditDocumentBinding.filter(
                tenant_id=tenant_id,
                node_key=entry.node_key,
                deleted_at__isnull=True,
            ).exists()
            if exists:
                continue

            legacy = await ApprovalProcess.filter(
                tenant_id=tenant_id,
                code=entry.node_key,
                deleted_at__isnull=True,
            ).first()
            await AuditDocumentBinding.create(
                tenant_id=tenant_id,
                node_key=entry.node_key,
                is_enabled=bool(legacy and legacy.is_active),
                process_id=legacy.id if legacy else None,
            )
            created += 1
        return created

    @staticmethod
    def entry_for_node(node_key: str) -> Optional[AuditEntry]:
        return entry_by_node_key(node_key)
