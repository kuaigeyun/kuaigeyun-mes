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
from tree_root.services.message_service import MessageService
from tree_root.schemas.message_template import SendMessageRequest
from soil.models.user import User
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
            
            # 异步发送消息通知
            import asyncio
            asyncio.create_task(
                ApprovalInstanceService._send_approval_submitted_notification(
                    tenant_id=tenant_id,
                    approval_instance=approval_instance,
                    process=process
                )
            )
            
            # 触发审批工作流事件
            from tree_root.inngest.client import inngest_client
            from inngest import Event
            
            try:
                await inngest_client.send_event(
                    event=Event(
                        name="approval/submit",
                        data={
                            "tenant_id": tenant_id,
                            "approval_id": str(approval_instance.uuid),
                            "process_id": str(process.uuid),
                        }
                    )
                )
            except Exception as e:
                # 如果 Inngest 事件发送失败，记录错误但不影响审批实例创建
                from loguru import logger
                logger.error(f"发送审批工作流事件失败: {e}")
            
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
        
        old_status = approval_instance.status
        old_current_approver_id = approval_instance.current_approver_id
        
        await approval_instance.save()
        
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
        
        # 触发审批操作事件
        from tree_root.inngest.client import inngest_client
        from inngest import Event
        
        try:
            event_data = {
                "tenant_id": tenant_id,
                "approval_id": str(approval_instance.uuid),
                "action": action.action,
                "user_id": user_id,
            }
            if action.comment:
                event_data["comment"] = action.comment
            if action.transfer_to_user_id:
                event_data["transfer_to_user_id"] = action.transfer_to_user_id
            
            await inngest_client.send_event(
                event=Event(
                    name="approval/action",
                    data=event_data
                )
            )
        except Exception as e:
            # 如果 Inngest 事件发送失败，记录错误但不影响审批操作
            from loguru import logger
            logger.error(f"发送审批操作事件失败: {e}")
        
        return approval_instance
    
    @staticmethod
    async def _send_approval_submitted_notification(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        process: ApprovalProcess
    ) -> None:
        """
        发送审批提交通知
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
            process: 审批流程
        """
        try:
            # 获取提交人信息
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not submitter or not submitter.email:
                return
            
            # 发送消息给提交人
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=submitter.email,
                    subject=f"审批已提交：{approval_instance.title}",
                    content=f"您提交的审批「{approval_instance.title}」已成功提交，流程：{process.name}。请等待审批。",
                )
            )
            
            # 如果有当前审批人，发送消息给审批人
            if approval_instance.current_approver_id:
                approver = await User.filter(
                    id=approval_instance.current_approver_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if approver and approver.email:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=approver.email,
                            subject=f"待审批：{approval_instance.title}",
                            content=f"您有一个待审批的申请：{approval_instance.title}，提交人：{submitter.full_name or submitter.username}，流程：{process.name}。",
                        )
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
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
        发送审批操作通知
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
            action: 审批操作
            user_id: 操作人ID
            old_status: 旧状态
            old_current_approver_id: 旧审批人ID
        """
        try:
            await approval_instance.fetch_related('process')
            process = approval_instance.process
            
            # 获取提交人信息
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not submitter or not submitter.email:
                return
            
            # 获取操作人信息
            operator = await User.filter(
                id=user_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            # 根据操作类型发送不同的消息
            action_text = {
                "approve": "已通过",
                "reject": "已拒绝",
                "cancel": "已取消",
                "transfer": "已转交"
            }.get(action.action, action.action)
            
            # 发送消息给提交人
            comment_text = f"，备注：{action.comment}" if action.comment else ""
            operator_name = operator.full_name or operator.username if operator else "系统"
            
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=submitter.email,
                    subject=f"审批{action_text}：{approval_instance.title}",
                    content=f"您的审批「{approval_instance.title}」已被{operator_name}{action_text}{comment_text}。流程：{process.name}。",
                )
            )
            
            # 如果审批完成（approved/rejected/cancelled），发送完成通知
            if approval_instance.status in ["approved", "rejected", "cancelled"]:
                status_text = {
                    "approved": "已通过",
                    "rejected": "已拒绝",
                    "cancelled": "已取消"
                }.get(approval_instance.status, approval_instance.status)
                
                await MessageService.send_message(
                    tenant_id=tenant_id,
                    request=SendMessageRequest(
                        type="internal",
                        recipient=submitter.email,
                        subject=f"审批完成：{approval_instance.title}",
                        content=f"您的审批「{approval_instance.title}」已完成，结果：{status_text}。流程：{process.name}。",
                    )
                )
            
            # 如果有新的审批人（转交或进入下一节点），发送消息给新审批人
            if approval_instance.current_approver_id and \
               approval_instance.current_approver_id != old_current_approver_id and \
               approval_instance.status == "pending":
                new_approver = await User.filter(
                    id=approval_instance.current_approver_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if new_approver and new_approver.email:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=new_approver.email,
                            subject=f"待审批：{approval_instance.title}",
                            content=f"您有一个待审批的申请：{approval_instance.title}，提交人：{submitter.full_name or submitter.username}，流程：{process.name}。",
                        )
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"发送审批操作通知失败: {str(e)}")

