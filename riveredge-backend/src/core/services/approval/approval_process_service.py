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

    @staticmethod
    def _simple_nodes(label: str) -> Dict[str, Any]:
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
        }

    # 中国中小制造业常见单据审核开关（全部默认关闭，按需开启）
    PRESET_APPROVAL_PROCESSES = [
        {"name": "需求审核", "code": "demand", "description": "需求单据审核", "nodes": _simple_nodes.__func__("计划主管审核"), "config": {}, "is_active": False},
        {"name": "销售预测审核", "code": "sales_forecast", "description": "销售预测审核", "nodes": _simple_nodes.__func__("销售主管审核"), "config": {}, "is_active": False},
        {"name": "销售订单审核", "code": "sales_order", "description": "销售订单审核", "nodes": _simple_nodes.__func__("销售经理审核"), "config": {}, "is_active": False},
        {"name": "报价单审核", "code": "quotation", "description": "报价单审核", "nodes": _simple_nodes.__func__("商务负责人审核"), "config": {}, "is_active": False},
        {"name": "生产计划审核", "code": "production_plan", "description": "生产计划审核", "nodes": _simple_nodes.__func__("计划主管审核"), "config": {}, "is_active": False},
        {"name": "采购申请审核", "code": "purchase_request", "description": "采购申请审核", "nodes": _simple_nodes.__func__("采购主管审核"), "config": {}, "is_active": False},
        {"name": "采购订单审核", "code": "purchase_order", "description": "采购订单审核", "nodes": _simple_nodes.__func__("采购经理审核"), "config": {}, "is_active": False},
        {"name": "报工审核", "code": "reporting_record", "description": "报工记录审核", "nodes": _simple_nodes.__func__("生产主管审核"), "config": {}, "is_active": False},
        {"name": "质检审核", "code": "quality_inspection", "description": "来料/过程/成品质检审核", "nodes": _simple_nodes.__func__("质量负责人审核"), "config": {}, "is_active": False},
        {"name": "来料检验审核", "code": "incoming_inspection", "description": "来料检验单审核", "nodes": _simple_nodes.__func__("质量负责人审核"), "config": {}, "is_active": False},
        {"name": "过程检验审核", "code": "process_inspection", "description": "过程检验单审核", "nodes": _simple_nodes.__func__("质量负责人审核"), "config": {}, "is_active": False},
        {"name": "成品检验审核", "code": "finished_goods_inspection", "description": "成品检验单审核", "nodes": _simple_nodes.__func__("质量负责人审核"), "config": {}, "is_active": False},
        {"name": "销售出库审核", "code": "sales_delivery", "description": "销售出库审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "采购收货审核", "code": "purchase_receipt", "description": "采购收货审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "成品入库审核", "code": "finished_goods_receipt", "description": "成品入库审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "其他入库审核", "code": "other_inbound", "description": "其他入库审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "其他出库审核", "code": "other_outbound", "description": "其他出库审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "生产领料审核", "code": "production_picking", "description": "生产领料审核", "nodes": _simple_nodes.__func__("车间主管审核"), "config": {}, "is_active": False},
        {"name": "生产退料审核", "code": "production_return", "description": "生产退料审核", "nodes": _simple_nodes.__func__("车间主管审核"), "config": {}, "is_active": False},
        {"name": "借料审核", "code": "material_borrow", "description": "借料审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "还料审核", "code": "material_return", "description": "还料审核", "nodes": _simple_nodes.__func__("仓储负责人审核"), "config": {}, "is_active": False},
        {"name": "销售退货审核", "code": "sales_return", "description": "销售退货审核", "nodes": _simple_nodes.__func__("售后负责人审核"), "config": {}, "is_active": False},
        {"name": "采购退货审核", "code": "purchase_return", "description": "采购退货审核", "nodes": _simple_nodes.__func__("采购主管审核"), "config": {}, "is_active": False},
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

