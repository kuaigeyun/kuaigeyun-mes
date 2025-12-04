"""
审批流程管理服务模块

提供审批流程的 CRUD 操作和 Inngest 工作流集成功能。
"""

from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.approval_process import ApprovalProcess
from core.schemas.approval_process import ApprovalProcessCreate, ApprovalProcessUpdate
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
            
            # TODO: 集成 Inngest 工作流注册
            # 将 ProFlow 设计转换为 Inngest 工作流配置
            # if approval_process.is_active:
            #     inngest_config = ApprovalProcessService.convert_proflow_to_inngest(approval_process.nodes)
            #     workflow_id = await register_approval_workflow(approval_process, inngest_config)
            #     approval_process.inngest_workflow_id = workflow_id
            #     await approval_process.save()
            
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
        
        # TODO: 集成 Inngest 工作流更新
        # 如果节点配置发生变化，需要重新注册 Inngest 工作流
        # if 'nodes' in update_data:
        #     if approval_process.inngest_workflow_id:
        #         # 取消注册旧工作流
        #         await unregister_approval_workflow(approval_process.inngest_workflow_id)
        #     if approval_process.is_active:
        #         # 注册新工作流
        #         inngest_config = ApprovalProcessService.convert_proflow_to_inngest(approval_process.nodes)
        #         workflow_id = await register_approval_workflow(approval_process, inngest_config)
        #         approval_process.inngest_workflow_id = workflow_id
        #         await approval_process.save()
        
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
        
        # TODO: 集成 Inngest 工作流注销
        # 如果流程已注册到 Inngest，需要先注销
        # if approval_process.inngest_workflow_id:
        #     await unregister_approval_workflow(approval_process.inngest_workflow_id)
        
        approval_process.deleted_at = datetime.now()
        await approval_process.save()

