"""
审批实例管理服务模块

提供审批实例的 CRUD 操作和审批操作功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from tree_root.models.approval_instance import ApprovalInstance
from tree_root.models.approval_process import ApprovalProcess
from tree_root.schemas.approval_instance import ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceAction
from soil.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalInstanceService:
    """
    审批实例管理服务类
    
    提供审批实例的 CRUD 操作和审批操作功能。
    """
    
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
                submitted_at=datetime.now()
            )
            await approval_instance.save()
            
            # TODO: 集成 Inngest 工作流触发
            # 触发审批工作流事件
            # from tree_root.inngest.client import inngest_client
            # from inngest import Event
            # await inngest_client.send_event(
            #     event=Event(
            #         name="approval/submit",
            #         data={
            #             "tenant_id": tenant_id,
            #             "approval_id": str(approval_instance.uuid),
            #             "process_id": str(process.uuid),
            #             "current_node": "start"
            #         }
            #     )
            # )
            
            return approval_instance
        except IntegrityError:
            raise ValidationError("创建审批实例失败")
    
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
        current_approver_id: Optional[int] = None
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
        approval_instance.deleted_at = datetime.now()
        await approval_instance.save()
    
    @staticmethod
    async def perform_approval_action(
        tenant_id: int,
        uuid: str,
        user_id: int,
        action: ApprovalInstanceAction
    ) -> ApprovalInstance:
        """
        执行审批操作（同意、拒绝、取消、转交）
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            user_id: 操作人ID
            action: 审批操作
            
        Returns:
            ApprovalInstance: 更新后的审批实例对象
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
            ValidationError: 当操作不合法时抛出
        """
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        
        # 验证操作权限
        if approval_instance.status != "pending":
            raise ValidationError("审批实例已完成，无法操作")
        
        if approval_instance.current_approver_id != user_id:
            raise ValidationError("您不是当前审批人，无法操作")
        
        # 执行操作
        if action.action == "approve":
            # TODO: 判断是否有下一个节点
            # 如果有下一个节点，更新 current_node 和 current_approver_id
            # 如果没有下一个节点，更新 status 为 "approved" 并设置 completed_at
            approval_instance.status = "approved"
            approval_instance.completed_at = datetime.now()
        elif action.action == "reject":
            approval_instance.status = "rejected"
            approval_instance.completed_at = datetime.now()
        elif action.action == "cancel":
            approval_instance.status = "cancelled"
            approval_instance.completed_at = datetime.now()
        elif action.action == "transfer":
            if not action.transfer_to_user_id:
                raise ValidationError("转交操作必须指定目标用户")
            approval_instance.current_approver_id = action.transfer_to_user_id
        
        await approval_instance.save()
        
        # TODO: 集成 Inngest 工作流触发
        # 触发审批操作事件
        # from tree_root.inngest.client import inngest_client
        # from inngest import Event
        # await inngest_client.send_event(
        #     event=Event(
        #         name="approval/action",
        #         data={
        #             "tenant_id": tenant_id,
        #             "approval_id": str(approval_instance.uuid),
        #             "action": action.action,
        #             "comment": action.comment,
        #             "user_id": user_id
        #         }
        #     )
        # )
        
        return approval_instance

