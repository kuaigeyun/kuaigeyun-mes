"""
审批实例管理服务模块

提供审批实例的 CRUD 操作和审批操作功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
from core.models.approval_history import ApprovalHistory

from tortoise.exceptions import IntegrityError

from core.models.approval_instance import ApprovalInstance
from core.models.approval_process import ApprovalProcess
from core.schemas.approval_instance import ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceAction
from core.services.message_service import MessageService
from core.schemas.message_template import SendMessageRequest
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
            from core.inngest.client import inngest_client
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
        
        # 获取审批流程
        await approval_instance.fetch_related('process')
        process = approval_instance.process
        
        # 记录操作前的状态
        old_node = approval_instance.current_node
        old_approver_id = approval_instance.current_approver_id
        
        # 执行操作
        if action.action == "approve":
            # 判断是否有下一个节点
            next_node = ApprovalInstanceService._get_next_node(process.nodes, approval_instance.current_node)
            
            if next_node:
                # 进入下一个节点
                approval_instance.current_node = next_node.get("id")
                approval_instance.current_approver_id = ApprovalInstanceService._get_node_approver(next_node, approval_instance)
                approval_instance.status = "pending"  # 保持待审批状态
            else:
                # 没有下一个节点，审批完成
                approval_instance.status = "approved"
                approval_instance.completed_at = datetime.now()
                approval_instance.current_node = None
                approval_instance.current_approver_id = None
        elif action.action == "reject":
            approval_instance.status = "rejected"
            approval_instance.completed_at = datetime.now()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "cancel":
            approval_instance.status = "cancelled"
            approval_instance.completed_at = datetime.now()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "transfer":
            if not action.transfer_to_user_id:
                raise ValidationError("转交操作必须指定目标用户")
            approval_instance.current_approver_id = action.transfer_to_user_id
        
        old_status = approval_instance.status
        old_current_approver_id = approval_instance.current_approver_id
        
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
        from core.inngest.client import inngest_client
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
    
    @staticmethod
    def _get_start_node(nodes: dict) -> Optional[dict]:
        """
        获取起始节点
        
        Args:
            nodes: 流程节点配置
            
        Returns:
            Optional[dict]: 起始节点配置
        """
        if not nodes:
            return None
        
        # 查找起始节点（通常节点类型为 "start" 或第一个节点）
        for node_id, node_config in nodes.items():
            if isinstance(node_config, dict):
                node_type = node_config.get("type", "")
                if node_type == "start" or node_id == "start":
                    return {"id": node_id, **node_config}
        
        # 如果没有找到起始节点，返回第一个节点
        if nodes:
            first_node_id = list(nodes.keys())[0]
            first_node = nodes[first_node_id]
            if isinstance(first_node, dict):
                return {"id": first_node_id, **first_node}
        
        return None
    
    @staticmethod
    def _get_next_node(nodes: dict, current_node_id: Optional[str]) -> Optional[dict]:
        """
        获取下一个节点
        
        Args:
            nodes: 流程节点配置
            current_node_id: 当前节点ID
            
        Returns:
            Optional[dict]: 下一个节点配置，如果没有则返回None
        """
        if not nodes or not current_node_id:
            return None
        
        current_node = nodes.get(current_node_id)
        if not isinstance(current_node, dict):
            return None
        
        # 获取当前节点的出边（edges）
        edges = current_node.get("edges", [])
        if not edges:
            return None
        
        # 获取第一个出边指向的节点
        first_edge = edges[0] if isinstance(edges, list) else None
        if not first_edge:
            return None
        
        next_node_id = first_edge.get("target") if isinstance(first_edge, dict) else None
        if not next_node_id:
            return None
        
        next_node = nodes.get(next_node_id)
        if isinstance(next_node, dict):
            return {"id": next_node_id, **next_node}
        
        return None
    
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
        to_approver_id: Optional[int] = None
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
        """
        try:
            await ApprovalHistory.create(
                tenant_id=tenant_id,
                approval_instance_id=approval_instance_id,
                action=action,
                action_by=action_by,
                action_at=datetime.now(),
                comment=comment,
                from_node=from_node,
                to_node=to_node,
                from_approver_id=from_approver_id,
                to_approver_id=to_approver_id
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
        处理审批完成后的业务回调
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
        """
        try:
            # 从审批数据中获取业务对象信息
            data = approval_instance.data or {}
            
            # 处理销售订单审批完成
            if "order_uuid" in data:
                await ApprovalInstanceService._handle_sales_order_approval(
                    tenant_id=tenant_id,
                    approval_instance=approval_instance,
                    order_uuid=data["order_uuid"]
                )
            
            # TODO: 可以添加其他业务对象的审批回调
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"处理审批完成回调失败: {str(e)}")
    
    @staticmethod
    async def _handle_sales_order_approval(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        order_uuid: str
    ) -> None:
        """
        处理销售订单审批完成
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
            order_uuid: 订单UUID
        """
        try:
            from apps.kuaicrm.models.sales_order import SalesOrder
            
            order = await SalesOrder.filter(
                tenant_id=tenant_id,
                uuid=order_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not order:
                return
            
            # 更新订单审批状态
            order.approval_status = approval_instance.status
            
            # 根据审批结果更新订单状态
            if approval_instance.status == "approved":
                order.status = "已审批"
            elif approval_instance.status == "rejected":
                order.status = "已关闭"
            
            await order.save()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"处理销售订单审批完成失败: {str(e)}")

