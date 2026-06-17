"""
审批流程管理服务模块

提供审批流程的 CRUD 操作。
"""

from typing import Optional, List, Dict, Any, Set
from uuid import UUID
from datetime import datetime

from loguru import logger
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from core.models.approval_process import ApprovalProcess
from core.models.approval_instance import ApprovalInstance
from core.schemas.approval_process import ApprovalProcessCreate, ApprovalProcessUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.config.audit_registry import all_entries as _audit_entries, entry_by_node_key, is_auditable_node_key
from core.schemas.approval_flow_schema import normalize_and_validate_flow


def _registry_canonical_names() -> Dict[str, str]:
    """审批流程规范名映射唯一来源：manifest.audit（node_key -> name），个人任务保留为全局。"""
    names: Dict[str, str] = {"personal_task": "个人任务"}
    for entry in _audit_entries():
        names[entry.node_key] = entry.name
    return names


class ApprovalProcessService:
    """
    审批流程管理服务类
    
    提供审批流程的 CRUD 操作。
    """
    
    # 唯一来源：manifest.audit（见 _registry_canonical_names）。不再保留历史 `*_audit` 别名。
    CANONICAL_PROCESS_NAMES: Dict[str, str] = _registry_canonical_names()

    @staticmethod
    def _normalize_name_token(value: Optional[str]) -> str:
        if not value:
            return ""
        return str(value).strip().lower().replace("-", "_").replace(" ", "_")

    @staticmethod
    def _resolve_canonical_name(code: Optional[str], name: Optional[str]) -> Optional[str]:
        code_key = ApprovalProcessService._normalize_name_token(code)
        if not code_key:
            return None
        canonical = ApprovalProcessService.CANONICAL_PROCESS_NAMES.get(code_key)
        if not canonical:
            return None

        name_key = ApprovalProcessService._normalize_name_token(name)
        # 仅修正明显的英文/机器名，避免覆盖用户已维护的中文自定义名称
        if name_key in {
            "",
            code_key,
            f"{code_key}_audit",
            "reporting_record",
            "reporting_record_audit",
            "reporting",
            "sales_forecast",
            "sales_forecast_audit",
        }:
            return canonical
        if name and all(ord(ch) < 128 for ch in str(name)):
            return canonical
        return None

    @staticmethod
    async def _normalize_process_name_if_needed(approval_process: ApprovalProcess) -> None:
        canonical = ApprovalProcessService._resolve_canonical_name(
            getattr(approval_process, "code", None),
            getattr(approval_process, "name", None),
        )
        if canonical and canonical != approval_process.name:
            approval_process.name = canonical
            await approval_process.save(update_fields=["name", "updated_at"])

    @staticmethod
    async def get_approval_process_by_code(
        tenant_id: int,
        code: str,
    ) -> Optional[ApprovalProcess]:
        """按 code 获取审批流程（不受已安装应用范围过滤）。"""
        return await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True,
        ).first()

    @staticmethod
    def build_audit_process_create_data(node_key: str) -> ApprovalProcessCreate:
        """按 manifest.audit 模板构建单据审核流程（启用开关时按需创建）。"""
        entry = entry_by_node_key(node_key)
        if not entry:
            raise ValidationError(f"单据节点 {node_key} 未在 manifest.audit 中声明")
        nodes = ApprovalProcessService._default_audit_nodes(entry.name)
        return ApprovalProcessCreate(
            name=entry.name,
            code=entry.node_key,
            description=entry.name,
            nodes=nodes,
            config={},
            is_active=False,
        )

    @staticmethod
    async def create_audit_process_for_node(tenant_id: int, node_key: str) -> ApprovalProcess:
        """为 manifest 可审核单据按需创建默认流程（code = node_key）。"""
        if not is_auditable_node_key(node_key):
            raise ValidationError(f"单据节点 {node_key} 未在 manifest.audit 中声明")
        existing = await ApprovalProcessService.get_approval_process_by_code(tenant_id, node_key)
        if existing:
            return existing
        data = ApprovalProcessService.build_audit_process_create_data(node_key)
        return await ApprovalProcessService.create_approval_process(tenant_id, data)

    @staticmethod
    async def create_approval_process(
        tenant_id: int,
        data: ApprovalProcessCreate
    ) -> ApprovalProcess:
        """
        创建审批流程
        
        Args:
            tenant_id: 组织ID
            data: 审批流程创建数据
            
        Returns:
            ApprovalProcess: 创建的审批流程对象
            
        Raises:
            ValidationError: 当流程代码已存在时抛出
        """
        try:
            payload = data.model_dump()
            canonical_name = ApprovalProcessService._resolve_canonical_name(
                payload.get("code"),
                payload.get("name"),
            )
            if canonical_name:
                payload["name"] = canonical_name
            if payload.get("nodes"):
                payload["nodes"] = normalize_and_validate_flow(payload["nodes"])
            approval_process = ApprovalProcess(
                tenant_id=tenant_id,
                **payload
            )
            await approval_process.save()

            return approval_process
        except IntegrityError:
            raise ValidationError(f"审批流程代码 {data.code} 已存在")
    
    @staticmethod
    async def get_approval_process_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ApprovalProcess:
        """
        根据UUID获取审批流程
        
        Args:
            tenant_id: 组织ID
            uuid: 审批流程UUID
            
        Returns:
            ApprovalProcess: 审批流程对象
            
        Raises:
            NotFoundError: 当审批流程不存在时抛出
        """
        approval_process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not approval_process:
            raise NotFoundError("审批流程不存在")
        
        return approval_process
    
    @staticmethod
    async def list_approval_processes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        installed_app_codes: Optional[Set[str]] = None,
        for_audit_config: bool = False,
    ) -> List[ApprovalProcess]:
        """
        获取审批流程列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用筛选
            installed_app_codes: 已安装应用代码；未含快制造时隐藏其域内预设流程代码
            
        Returns:
            List[ApprovalProcess]: 审批流程列表
        """
        query = ApprovalProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)

        if installed_app_codes is not None:
            from core.config.audit_registry import all_entries
            from core.services.system.installed_feature_scope import (
                approval_process_code_visible_for_installed_apps,
            )

            hidden_codes = [
                entry.node_key
                for entry in all_entries()
                if not approval_process_code_visible_for_installed_apps(
                    entry.node_key,
                    installed_app_codes,
                )
            ]
            if hidden_codes:
                query = query.filter(~Q(code__in=hidden_codes))
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_approval_process(
        tenant_id: int,
        uuid: str,
        data: ApprovalProcessUpdate
    ) -> ApprovalProcess:
        """
        更新审批流程
        
        Args:
            tenant_id: 组织ID
            uuid: 审批流程UUID
            data: 审批流程更新数据
            
        Returns:
            ApprovalProcess: 更新后的审批流程对象
            
        Raises:
            NotFoundError: 当审批流程不存在时抛出
        """
        approval_process = await ApprovalProcessService.get_approval_process_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        if "name" in update_data:
            canonical_name = ApprovalProcessService._resolve_canonical_name(
                getattr(approval_process, "code", None),
                update_data.get("name"),
            )
            if canonical_name:
                update_data["name"] = canonical_name
        if "nodes" in update_data and update_data["nodes"] is not None:
            normalized = normalize_and_validate_flow(update_data["nodes"])
            pending_count = await ApprovalInstance.filter(
                tenant_id=tenant_id,
                process_id=approval_process.id,
                status="pending",
                deleted_at__isnull=True,
            ).count()
            if pending_count > 0:
                approval_process.draft_nodes = normalized
                update_data.pop("nodes")
            else:
                update_data["nodes"] = normalized
                approval_process.draft_nodes = None
        for key, value in update_data.items():
            setattr(approval_process, key, value)
        
        await approval_process.save()

        return approval_process
    
    @staticmethod
    async def publish_approval_process(tenant_id: int, uuid: str) -> ApprovalProcess:
        """发布流程草稿：将有进行中实例时写入 draft_nodes 的变更应用到 nodes，并递增版本。"""
        approval_process = await ApprovalProcessService.get_approval_process_by_uuid(tenant_id, uuid)
        if approval_process.draft_nodes:
            approval_process.nodes = normalize_and_validate_flow(approval_process.draft_nodes)
            approval_process.draft_nodes = None
        next_ver = (approval_process.published_version or 1) + 1
        approval_process.version = next_ver
        approval_process.published_version = next_ver
        await approval_process.save()
        return approval_process
    
    @staticmethod
    async def delete_approval_process(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除审批流程（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 审批流程UUID
            
        Raises:
            NotFoundError: 当审批流程不存在时抛出
        """
        approval_process = await ApprovalProcessService.get_approval_process_by_uuid(tenant_id, uuid)

        approval_process.deleted_at = datetime.now()
        await approval_process.save()

    @staticmethod
    def _default_audit_nodes(label: str) -> Dict[str, Any]:
        """默认审核流程：开始 → 单级审批 → 结束。"""
        return {
            "nodes": [
                {
                    "id": "start",
                    "type": "start",
                    "position": {"x": 250, "y": 50},
                    "data": {"label": "开始", "layoutDirection": "vertical"},
                },
                {
                    "id": "approval_1",
                    "type": "approval",
                    "position": {"x": 250, "y": 200},
                    "data": {
                        "label": label,
                        "approverType": "manager",
                        "approvalType": "OR",
                        "layoutDirection": "vertical",
                    },
                },
                {
                    "id": "end",
                    "type": "end",
                    "position": {"x": 250, "y": 350},
                    "data": {"label": "结束", "layoutDirection": "vertical"},
                },
            ],
            "edges": [
                {"source": "start", "target": "approval_1"},
                {"source": "approval_1", "target": "end"},
            ],
        }

