"""
审批流程管理服务模块

提供审批流程的 CRUD 操作和 Inngest 工作流集成功能。
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from loguru import logger
from tortoise.exceptions import IntegrityError

from core.models.approval_process import ApprovalProcess
from core.schemas.approval_process import ApprovalProcessCreate, ApprovalProcessUpdate
from core.inngest.approval_registration import register_approval_workflow, unregister_approval_workflow
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalProcessService:
    """
    审批流程管理服务类
    
    提供审批流程的 CRUD 操作和 Inngest 工作流集成功能。
    """
    
    @staticmethod
    def convert_proflow_to_inngest(proflow_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        将 ProFlow 设计转换为 Inngest 工作流配置
        
        Args:
            proflow_config: ProFlow 设计的流程配置
            
        Returns:
            Inngest 工作流配置
        """
        # TODO: 实现 ProFlow 到 Inngest 的转换逻辑
        # 将 ProFlow 节点转换为 Inngest 步骤
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
            approval_process = ApprovalProcess(
                tenant_id=tenant_id,
                **data.model_dump()
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
        is_active: Optional[bool] = None
    ) -> List[ApprovalProcess]:
        """
        获取审批流程列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用筛选
            
        Returns:
            List[ApprovalProcess]: 审批流程列表
        """
        query = ApprovalProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
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

    # 中国中小企业常用审批流程预设。
    # 业务调用 start_approval(process_code=...) 时使用的 code 与下表一致：
    # - simple_approval: 通用简单审批
    # - purchase_order: 采购订单审批（与采购业务关联）
    # - sales_order: 销售订单审批（与销售业务关联）
    # - work_order: 生产工单审批
    # - amount_tier_approval: 金额分档审批（按 instance.data.amount 走不同分支）
    PRESET_APPROVAL_PROCESSES = [
        {
            "name": "简单审批",
            "code": "simple_approval",
            "description": "通用简单审批流程：提交→审批人→结束",
            "nodes": {
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
                            "label": "审批",
                            "approver_type": "user",
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
            },
            "config": {},
            "is_active": False,
        },
        {
            "name": "采购单审批",
            "code": "purchase_order",
            "description": "采购订单审批流程",
            "nodes": {
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
                            "label": "采购经理审批",
                            "approver_type": "user",
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
            },
            "config": {},
            "is_active": False,
        },
        {
            "name": "销售单审批",
            "code": "sales_order",
            "description": "销售订单审批流程",
            "nodes": {
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
                            "label": "销售经理审批",
                            "approver_type": "user",
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
            },
            "config": {},
            "is_active": False,
        },
        {
            "name": "工单审批",
            "code": "work_order",
            "description": "生产工单审批流程",
            "nodes": {
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
                            "label": "生产经理审批",
                            "approver_type": "user",
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
            },
            "config": {},
            "is_active": False,
        },
        {
            "name": "金额分档审批",
            "code": "amount_tier_approval",
            "description": "按金额分支：大额走经理审批，小额走部门审批。提交时 data 需含 amount 字段。",
            "nodes": {
                "nodes": [
                    {"id": "start", "type": "start", "position": {"x": 250, "y": 50}, "data": {"label": "开始", "layoutDirection": "vertical"}},
                    {
                        "id": "cond_1",
                        "type": "condition",
                        "position": {"x": 250, "y": 150},
                        "data": {
                            "label": "条件判断",
                            "layoutDirection": "vertical",
                            "conditions": [
                                {"field": "amount", "operator": ">", "value": 10000},
                                {"field": "amount", "operator": "<=", "value": 10000},
                            ],
                        },
                    },
                    {
                        "id": "approval_manager",
                        "type": "approval",
                        "position": {"x": 100, "y": 280},
                        "data": {"label": "经理审批", "approverType": "manager", "layoutDirection": "vertical"},
                    },
                    {
                        "id": "approval_dept",
                        "type": "approval",
                        "position": {"x": 400, "y": 280},
                        "data": {"label": "部门审批", "approverType": "department", "layoutDirection": "vertical"},
                    },
                    {"id": "end", "type": "end", "position": {"x": 250, "y": 400}, "data": {"label": "结束", "layoutDirection": "vertical"}},
                ],
                "edges": [
                    {"source": "start", "target": "cond_1"},
                    {"source": "cond_1", "target": "approval_manager"},
                    {"source": "cond_1", "target": "approval_dept"},
                    {"source": "approval_manager", "target": "end"},
                    {"source": "approval_dept", "target": "end"},
                ],
            },
            "config": {},
            "is_active": False,
        },
    ]

    @staticmethod
    async def load_preset_sme(tenant_id: int) -> int:
        """
        加载中国中小制造业极简审批流程预设数据。
        仅创建不存在的流程（按 code 去重）。
        """
        created = 0
        for item in ApprovalProcessService.PRESET_APPROVAL_PROCESSES:
            exists = await ApprovalProcess.filter(
                tenant_id=tenant_id,
                code=item["code"],
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

