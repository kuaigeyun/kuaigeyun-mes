"""
审批流程管理服务模块

提供审批流程的 CRUD 操作与异步工作流（Taskiq）注册能力。
"""

from typing import Optional, List, Dict, Any, Set
from uuid import UUID
from datetime import datetime

from loguru import logger
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from core.models.approval_process import ApprovalProcess
from core.schemas.approval_process import ApprovalProcessCreate, ApprovalProcessUpdate
from core.workflows.approval_registration import register_approval_workflow, unregister_approval_workflow
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.config.audit_registry import all_entries as _audit_entries
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
    
    提供审批流程的 CRUD 操作与异步工作流（Taskiq）注册能力。
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
    def convert_proflow_to_inngest(proflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        将 ProFlow 设计转换为异步工作流配置（供 Taskiq 事件链使用）
        
        Args:
            proflow_config: ProFlow 设计的流程配置
            
        Returns:
            异步工作流配置（字典）
        """
        # TODO: 实现 ProFlow 到异步工作流步骤的转换逻辑
        inngest_steps = []
        
        nodes = proflow_config.get("nodes", [])
        edges = proflow_config.get("edges", [])
        
        for node in nodes:
            step = {
                "id": node.get("id"),
                "name": node.get("name"),
                "type": node.get("type"),
                "config": node.get("config", {})
            }
            inngest_steps.append(step)
        
        return {
            "steps": inngest_steps,
            "edges": edges
        }
    
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
    async def _sync_inngest_workflow(approval_process: ApprovalProcess) -> None:
        """按 is_active 同步异步工作流注册状态。"""
        if approval_process.inngest_workflow_id:
            await unregister_approval_workflow(approval_process.inngest_workflow_id)
            approval_process.inngest_workflow_id = None
        if approval_process.is_active:
            inngest_config = ApprovalProcessService.convert_proflow_to_inngest(
                approval_process.nodes
            )
            workflow_id = await register_approval_workflow(approval_process, inngest_config)
            approval_process.inngest_workflow_id = workflow_id
        await approval_process.save()

    @staticmethod
    async def set_audit_switch_active(
        tenant_id: int,
        code: str,
        is_active: bool,
    ) -> ApprovalProcess:
        """
        配置中心审核开关（兼容旧 API）。

        可审核单据 node_key 写入 AuditDocumentBinding；非 manifest 声明的 code 仍走流程库逻辑。
        """
        from core.config.audit_registry import is_auditable_node_key
        from core.services.approval.audit_binding_service import AuditBindingService

        if is_auditable_node_key(code):
            preset = await AuditBindingService._default_process_for_node(tenant_id, code)
            if not preset and is_active:
                preset_item = next(
                    (item for item in ApprovalProcessService.PRESET_APPROVAL_PROCESSES if item["code"] == code),
                    None,
                )
                if preset_item:
                    data = ApprovalProcessCreate(
                        name=preset_item["name"],
                        code=preset_item["code"],
                        description=preset_item.get("description"),
                        nodes=preset_item["nodes"],
                        config=preset_item.get("config", {}),
                        is_active=False,
                    )
                    preset = await ApprovalProcessService.create_approval_process(tenant_id, data)
            await AuditBindingService.update_binding(
                tenant_id,
                code,
                is_enabled=is_active,
                process_uuid=preset.uuid if preset else None,
            )
            process = await AuditBindingService.resolve_process_for_node(tenant_id, code)
            if process:
                return process
            if not is_active:
                legacy = await ApprovalProcessService.get_approval_process_by_code(tenant_id, code)
                if legacy:
                    return legacy
            raise NotFoundError(f"审批流程 {code} 不存在")

        process = await ApprovalProcessService.get_approval_process_by_code(tenant_id, code)
        if process:
            process.is_active = is_active
            await process.save()
            await ApprovalProcessService._sync_inngest_workflow(process)
            return process

        if not is_active:
            raise NotFoundError(f"审批流程 {code} 不存在")

        preset = next(
            (item for item in ApprovalProcessService.PRESET_APPROVAL_PROCESSES if item["code"] == code),
            None,
        )
        if preset:
            data = ApprovalProcessCreate(
                name=preset["name"],
                code=preset["code"],
                description=preset.get("description"),
                nodes=preset["nodes"],
                config=preset.get("config", {}),
                is_active=True,
            )
        else:
            data = ApprovalProcessCreate(
                name=ApprovalProcessService.CANONICAL_PROCESS_NAMES.get(code, f"{code}_audit"),
                code=code,
                description="单据审核开关（配置中心创建）",
                nodes=ApprovalProcessService._simple_nodes("审核"),
                config={},
                is_active=True,
            )
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

            if approval_process.is_active:
                inngest_config = ApprovalProcessService.convert_proflow_to_inngest(approval_process.nodes)
                workflow_id = await register_approval_workflow(approval_process, inngest_config)
                approval_process.inngest_workflow_id = workflow_id
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
            from core.services.system.installed_feature_scope import (
                KUAIZHIZAO_APPROVAL_PROCESS_CODES,
                approval_process_code_visible_for_installed_apps,
            )

            if not approval_process_code_visible_for_installed_apps(
                "demand",
                installed_app_codes,
            ):
                query = query.filter(~Q(code__in=list(KUAIZHIZAO_APPROVAL_PROCESS_CODES)))
        
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

        if 'nodes' in update_data:
            if approval_process.inngest_workflow_id:
                await unregister_approval_workflow(approval_process.inngest_workflow_id)
            if approval_process.is_active:
                inngest_config = ApprovalProcessService.convert_proflow_to_inngest(approval_process.nodes)
                workflow_id = await register_approval_workflow(approval_process, inngest_config)
                approval_process.inngest_workflow_id = workflow_id
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
        if approval_process.is_active:
            if approval_process.inngest_workflow_id:
                await unregister_approval_workflow(approval_process.inngest_workflow_id)
            inngest_config = ApprovalProcessService.convert_proflow_to_inngest(approval_process.nodes)
            workflow_id = await register_approval_workflow(approval_process, inngest_config)
            approval_process.inngest_workflow_id = workflow_id
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

        if approval_process.inngest_workflow_id:
            await unregister_approval_workflow(approval_process.inngest_workflow_id)

        approval_process.deleted_at = datetime.now()
        await approval_process.save()

    @staticmethod
    def _simple_nodes(label: str) -> Dict[str, Any]:
        """预置流程唯一节点模板：开始 → 单级审批 → 结束。"""
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
                        "approverType": "user",
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

    @staticmethod
    def _sme_standard_nodes(label: str) -> Dict[str, Any]:
        """SME 模板：部门主管 → 金额条件分支 → 财务 / 直接结束。"""
        return {
            "nodes": [
                {"id": "start", "type": "start", "position": {"x": 250, "y": 50}, "data": {"label": "开始"}},
                {
                    "id": "approval_dept",
                    "type": "approval",
                    "position": {"x": 250, "y": 170},
                    "data": {
                        "label": f"{label}·部门主管",
                        "approverType": "department",
                        "approvalType": "OR",
                        "allowEditDuringApproval": False,
                    },
                },
                {
                    "id": "condition_amount",
                    "type": "condition",
                    "position": {"x": 250, "y": 290},
                    "data": {
                        "label": "金额条件",
                        "conditions": [
                            {"field": "total_amount", "operator": ">=", "value": 10000, "label": "金额≥1万"},
                            {"field": "total_amount", "operator": "<", "value": 10000, "label": "其他"},
                        ],
                    },
                },
                {
                    "id": "approval_finance",
                    "type": "approval",
                    "position": {"x": 100, "y": 410},
                    "data": {
                        "label": "财务审批",
                        "approverType": "manager",
                        "approvalType": "OR",
                        "allowEditDuringApproval": True,
                    },
                },
                {"id": "end", "type": "end", "position": {"x": 250, "y": 530}, "data": {"label": "结束"}},
            ],
            "edges": [
                {"source": "start", "target": "approval_dept"},
                {"source": "approval_dept", "target": "condition_amount"},
                {"source": "condition_amount", "target": "approval_finance"},
                {"source": "condition_amount", "target": "end"},
                {"source": "approval_finance", "target": "end"},
            ],
        }

    # 单据审核预设：唯一来源为 manifest.audit（见类定义后的 _build_preset_processes）。
    # 全部默认关闭（is_active=False），按需在配置中心开启；节点由 template 生成。
    PRESET_APPROVAL_PROCESSES: List[Dict[str, Any]] = []

    @staticmethod
    async def load_preset_sme(
        tenant_id: int,
        *,
        only_codes: Optional[Set[str]] = None,
    ) -> int:
        """
        加载审批流程预设数据（开始 → 单级审批 → 结束）。
        仅创建不存在的流程（按 code 去重）。
        """
        created = 0
        for item in ApprovalProcessService.PRESET_APPROVAL_PROCESSES:
            code = str(item.get("code") or "").strip()
            if not code:
                continue
            if only_codes is not None and code not in only_codes:
                continue
            exists = await ApprovalProcess.filter(
                tenant_id=tenant_id,
                code=code,
                deleted_at__isnull=True,
            ).exists()
            if not exists:
                try:
                    data = ApprovalProcessCreate(
                        name=item["name"],
                        code=item["code"],
                        description=item.get("description"),
                        nodes=item["nodes"],
                        config=item.get("config", {}),
                        is_active=item.get("is_active", False),
                    )
                    await ApprovalProcessService.create_approval_process(tenant_id, data)
                    created += 1
                except Exception as e:
                    logger.warning(f"创建审批流程 {item['code']} 失败: {e}")
        return created


def _build_preset_processes() -> List[Dict[str, Any]]:
    """由 manifest.audit 派生审批流程预设；template=sme 使用多级模板。"""
    presets: List[Dict[str, Any]] = []
    for entry in _audit_entries():
        nodes = (
            ApprovalProcessService._sme_standard_nodes(entry.name)
            if entry.template == "sme"
            else ApprovalProcessService._simple_nodes(entry.name)
        )
        presets.append(
            {
                "name": entry.name,
                "code": entry.node_key,
                "description": entry.name,
                "nodes": nodes,
                "config": {},
                "is_active": False,
            }
        )
    return presets


ApprovalProcessService.PRESET_APPROVAL_PROCESSES = _build_preset_processes()

