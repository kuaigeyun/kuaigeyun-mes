"""
审核单据绑定服务

manifest.audit 声明「哪些单据可审核」；AuditDocumentBinding 为运行时唯一真源（开关 + 流程 FK）。
ApprovalProcess 在启用审核开关时按需创建，关闭时注销工作流但保留流程定义。
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional, Set
from uuid import UUID

from core.config.audit_registry import AuditEntry, all_entries, entry_by_node_key, is_auditable_node_key
from core.models.approval_process import ApprovalProcess
from core.models.audit_document_binding import AuditDocumentBinding
from core.services.approval.approval_process_service import ApprovalProcessService
from core.services.system.installed_feature_scope import (
    approval_process_codes_for_installed_apps,
    get_installed_application_codes,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AuditBindingService:
    """审核单据 ↔ 审批流程绑定（运行时唯一真源）"""

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
    async def ensure_binding_rows(
        tenant_id: int,
        *,
        only_node_keys: Optional[Set[str]] = None,
        installed: Optional[Set[str]] = None,
    ) -> int:
        """为已安装应用 manifest.audit 声明补齐空绑定行（不创建 ApprovalProcess）。"""
        app_codes = installed if installed is not None else await get_installed_application_codes(tenant_id)
        target_keys = [
            entry.node_key
            for entry in all_entries()
            if entry.app in app_codes
            and (only_node_keys is None or entry.node_key in only_node_keys)
        ]
        if not target_keys:
            return 0
        existing_keys = set(
            await AuditDocumentBinding.filter(
                tenant_id=tenant_id,
                node_key__in=target_keys,
                deleted_at__isnull=True,
            ).values_list("node_key", flat=True)
        )
        missing_keys = [key for key in target_keys if key not in existing_keys]
        if not missing_keys:
            return 0
        await AuditDocumentBinding.bulk_create(
            [
                AuditDocumentBinding(
                    tenant_id=tenant_id,
                    node_key=node_key,
                    is_enabled=False,
                    process_id=None,
                )
                for node_key in missing_keys
            ]
        )
        return len(missing_keys)

    @staticmethod
    async def reconcile_stale_binding(
        tenant_id: int,
        node_key: str,
        *,
        binding: Optional[AuditDocumentBinding] = None,
        installed: Optional[Set[str]] = None,
    ) -> bool:
        """对齐单条绑定（写操作，仅在更新开关/流程时调用）。"""
        entry = entry_by_node_key(node_key)
        if not entry:
            return False
        app_codes = installed if installed is not None else await get_installed_application_codes(tenant_id)
        if entry.app not in app_codes:
            return False
        if binding is None:
            binding = await AuditDocumentBinding.filter(
                tenant_id=tenant_id,
                node_key=node_key,
                deleted_at__isnull=True,
            ).prefetch_related("process").first()
        if not binding or not binding.process_id:
            return False
        process = binding.process
        if not process or process.deleted_at is not None:
            binding.process_id = None
            binding.is_enabled = False
            await binding.save()
            return True
        if process.code == node_key:
            return False
        if binding.is_enabled:
            canonical = await AuditBindingService._resolve_or_create_bound_process(tenant_id, node_key)
            if binding.process_id != canonical.id:
                binding.process_id = canonical.id
                await binding.save()
                await AuditBindingService._activate_process(canonical)
                return True
        else:
            binding.process_id = None
            await binding.save()
            return True
        return False

    @staticmethod
    async def _process_for_node(tenant_id: int, node_key: str) -> Optional[ApprovalProcess]:
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
    async def _validate_process_option(
        tenant_id: int,
        process: ApprovalProcess,
        installed: Set[str],
        node_key: str,
    ) -> None:
        visible_codes = approval_process_codes_for_installed_apps(installed) - {"personal_task"}
        if process.code not in visible_codes:
            raise ValidationError(f"审批流程 {process.code} 不属于当前已安装应用的可审核单据")
        if process.code != node_key:
            raise ValidationError(
                f"单据 {node_key} 只能绑定同名审批流程 {node_key}，当前选中为 {process.code}"
            )

    @staticmethod
    async def _activate_process(process: ApprovalProcess) -> None:
        if process.is_active:
            return
        process.is_active = True
        await process.save(update_fields=["is_active", "updated_at"])

    @staticmethod
    async def _deactivate_process(process: ApprovalProcess) -> None:
        if not process.is_active:
            return
        process.is_active = False
        await process.save(update_fields=["is_active", "updated_at"])

    @staticmethod
    async def _resolve_or_create_bound_process(
        tenant_id: int,
        node_key: str,
    ) -> ApprovalProcess:
        process = await AuditBindingService._process_for_node(tenant_id, node_key)
        if process:
            return process
        return await ApprovalProcessService.create_audit_process_for_node(tenant_id, node_key)

    @staticmethod
    def _binding_is_operational(binding: Optional[AuditDocumentBinding]) -> bool:
        if not binding or not binding.is_enabled or not binding.process_id:
            return False
        process = binding.process
        return bool(process and process.deleted_at is None)

    @staticmethod
    async def get_binding_map(tenant_id: int) -> Dict[str, AuditDocumentBinding]:
        rows = await AuditDocumentBinding.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process")
        return {str(r.node_key): r for r in rows}

    @staticmethod
    def _display_process(
        binding: Optional[AuditDocumentBinding],
        *,
        node_key: str,
    ) -> Optional[ApprovalProcess]:
        """列表展示用：关闭且错绑时不展示旧流程（只读，不写库）。"""
        if not binding or not binding.process_id:
            return None
        process = binding.process
        if not process or process.deleted_at is not None:
            return None
        if not binding.is_enabled and process.code != node_key:
            return None
        return process

    @staticmethod
    async def list_bindings(tenant_id: int) -> Dict[str, Any]:
        installed = await get_installed_application_codes(tenant_id)
        visible_codes = approval_process_codes_for_installed_apps(installed) - {"personal_task"}
        target_keys = [
            entry.node_key for entry in all_entries() if entry.app in installed
        ]

        binding_map, process_options = await asyncio.gather(
            AuditBindingService.get_binding_map(tenant_id),
            ApprovalProcess.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                code__in=list(visible_codes),
            ).order_by("name").all(),
        )

        missing_keys = [key for key in target_keys if key not in binding_map]
        if missing_keys:
            await AuditDocumentBinding.bulk_create(
                [
                    AuditDocumentBinding(
                        tenant_id=tenant_id,
                        node_key=node_key,
                        is_enabled=False,
                        process_id=None,
                    )
                    for node_key in missing_keys
                ]
            )
            for node_key in missing_keys:
                binding_map[node_key] = AuditDocumentBinding(
                    tenant_id=tenant_id,
                    node_key=node_key,
                    is_enabled=False,
                    process_id=None,
                )

        items: List[Dict[str, Any]] = []
        for entry in all_entries():
            if entry.app not in installed:
                continue
            binding = binding_map.get(entry.node_key)
            process = AuditBindingService._display_process(binding, node_key=entry.node_key)
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
                    "process_matched": bool(process and process.code == entry.node_key),
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

        installed = await get_installed_application_codes(tenant_id)
        binding = await AuditBindingService._ensure_binding_row(tenant_id, node_key)

        if process_uuid is not None:
            process = await AuditBindingService._resolve_process(tenant_id, process_uuid)
            await AuditBindingService._validate_process_option(
                tenant_id, process, installed, node_key
            )
            binding.process_id = process.id
            if binding.is_enabled:
                await AuditBindingService._activate_process(process)

        if is_enabled is not None:
            if is_enabled:
                process = await AuditBindingService._resolve_or_create_bound_process(
                    tenant_id, node_key
                )
                binding.process_id = process.id
                await AuditBindingService._activate_process(process)
                binding.is_enabled = True
            else:
                binding.is_enabled = False
                if binding.process_id:
                    process = await ApprovalProcess.get_or_none(id=binding.process_id)
                    if process and process.deleted_at is None:
                        await AuditBindingService._deactivate_process(process)

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
        return AuditBindingService._binding_is_operational(binding)

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
        enabled = {
            str(row.node_key)
            for row in rows
            if AuditBindingService._binding_is_operational(row)
        }
        return {key: key in enabled for key in keys}

    @staticmethod
    async def resolve_process_for_node(
        tenant_id: int,
        node_key: str,
    ) -> Optional[ApprovalProcess]:
        """解析 node_key 绑定的审批流程（审核开关已启用且流程存在）。"""
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
        process = binding.process
        if not process.is_active:
            await AuditBindingService._activate_process(process)
        return process

    @staticmethod
    def entry_for_node(node_key: str) -> Optional[AuditEntry]:
        return entry_by_node_key(node_key)
