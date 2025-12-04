"""
定时任务管理服务模块

提供定时任务的 CRUD 操作和 Inngest 集成功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from tree_root.models.scheduled_task import ScheduledTask
from tree_root.schemas.scheduled_task import ScheduledTaskCreate, ScheduledTaskUpdate
from tree_root.services.message_service import MessageService
from tree_root.schemas.message_template import SendMessageRequest
from soil.models.user import User
from soil.exceptions.exceptions import NotFoundError, ValidationError


class ScheduledTaskService:
    """
    定时任务管理服务类
    
    提供定时任务的 CRUD 操作和 Inngest 集成功能。
    """
    
    @staticmethod
    async def create_scheduled_task(
        tenant_id: int,
        data: ScheduledTaskCreate
    ) -> ScheduledTask:
        """
        创建定时任务
        
        Args:
            tenant_id: 组织ID
            data: 定时任务创建数据
            
        Returns:
            ScheduledTask: 创建的定时任务对象
            
        Raises:
            ValidationError: 当任务代码已存在时抛出
        """
        try:
            scheduled_task = ScheduledTask(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await scheduled_task.save()
            
            # TODO: 集成 Inngest 函数注册
            # 当任务启用时，注册到 Inngest
            # if scheduled_task.is_active:
            #     from tree_root.inngest.functions.scheduled_task_executor import register_scheduled_task
            #     function_id = await register_scheduled_task(scheduled_task)
            #     scheduled_task.inngest_function_id = function_id
            #     await scheduled_task.save()
            
            return scheduled_task
        except IntegrityError:
            raise ValidationError(f"定时任务代码 {data.code} 已存在")
    
    @staticmethod
    async def get_scheduled_task_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ScheduledTask:
        """
        根据UUID获取定时任务
        
        Args:
            tenant_id: 组织ID
            uuid: 定时任务UUID
            
        Returns:
            ScheduledTask: 定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTask.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not scheduled_task:
            raise NotFoundError("定时任务不存在")
        
        return scheduled_task
    
    @staticmethod
    async def list_scheduled_tasks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        trigger_type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[ScheduledTask]:
        """
        获取定时任务列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 任务类型筛选
            trigger_type: 触发器类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[ScheduledTask]: 定时任务列表
        """
        query = ScheduledTask.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if trigger_type:
            query = query.filter(trigger_type=trigger_type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_scheduled_task(
        tenant_id: int,
        uuid: str,
        data: ScheduledTaskUpdate
    ) -> ScheduledTask:
        """
        更新定时任务
        
        Args:
            tenant_id: 组织ID
            uuid: 定时任务UUID
            data: 定时任务更新数据
            
        Returns:
            ScheduledTask: 更新后的定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(scheduled_task, key, value)
        
        await scheduled_task.save()
        
        # TODO: 集成 Inngest 函数更新
        # 如果触发器配置或任务配置发生变化，需要重新注册 Inngest 函数
        # if 'trigger_config' in update_data or 'task_config' in update_data:
        #     if scheduled_task.inngest_function_id:
        #         # 取消注册旧函数
        #         await unregister_scheduled_task(scheduled_task.inngest_function_id)
        #     if scheduled_task.is_active:
        #         # 注册新函数
        #         function_id = await register_scheduled_task(scheduled_task)
        #         scheduled_task.inngest_function_id = function_id
        #         await scheduled_task.save()
        
        return scheduled_task
    
    @staticmethod
    async def delete_scheduled_task(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除定时任务（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 定时任务UUID
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, uuid)
        
        # TODO: 集成 Inngest 函数注销
        # 如果任务已注册到 Inngest，需要先注销
        # if scheduled_task.inngest_function_id:
        #     await unregister_scheduled_task(scheduled_task.inngest_function_id)
        
        scheduled_task.deleted_at = datetime.now()
        await scheduled_task.save()
    
    @staticmethod
    async def start_scheduled_task(
        tenant_id: int,
        uuid: str
    ) -> ScheduledTask:
        """
        启动定时任务
        
        将任务注册到 Inngest 并启用。
        
        Args:
            tenant_id: 组织ID
            uuid: 定时任务UUID
            
        Returns:
            ScheduledTask: 更新后的定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, uuid)
        
        scheduled_task.is_active = True
        await scheduled_task.save()
        
        # TODO: 集成 Inngest 函数注册
        # if not scheduled_task.inngest_function_id:
        #     function_id = await register_scheduled_task(scheduled_task)
        #     scheduled_task.inngest_function_id = function_id
        #     await scheduled_task.save()
        
        return scheduled_task
    
    @staticmethod
    async def stop_scheduled_task(
        tenant_id: int,
        uuid: str
    ) -> ScheduledTask:
        """
        停止定时任务
        
        从 Inngest 注销任务并禁用。
        
        Args:
            tenant_id: 组织ID
            uuid: 定时任务UUID
            
        Returns:
            ScheduledTask: 更新后的定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, uuid)
        
        scheduled_task.is_active = False
        await scheduled_task.save()
        
        # TODO: 集成 Inngest 函数注销
        # if scheduled_task.inngest_function_id:
        #     await unregister_scheduled_task(scheduled_task.inngest_function_id)
        #     scheduled_task.inngest_function_id = None
        #     await scheduled_task.save()
        
        return scheduled_task
    
    @staticmethod
    async def mark_task_running(
        tenant_id: int,
        task_uuid: str,
        inngest_run_id: Optional[str] = None
    ) -> ScheduledTask:
        """
        标记定时任务开始执行（由 Inngest 函数调用）
        
        Args:
            tenant_id: 组织ID
            task_uuid: 定时任务UUID
            inngest_run_id: Inngest 运行ID（可选）
            
        Returns:
            ScheduledTask: 更新后的定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, task_uuid)
        
        scheduled_task.is_running = True
        scheduled_task.last_run_at = datetime.now()
        await scheduled_task.save()
        
        return scheduled_task
    
    @staticmethod
    async def update_task_execution_result(
        tenant_id: int,
        task_uuid: str,
        status: str,
        error: Optional[str] = None,
        inngest_run_id: Optional[str] = None
    ) -> ScheduledTask:
        """
        更新定时任务执行结果（由 Inngest 函数调用）
        
        Args:
            tenant_id: 组织ID
            task_uuid: 定时任务UUID
            status: 执行状态（success、failed）
            error: 错误信息（可选）
            inngest_run_id: Inngest 运行ID（可选）
            
        Returns:
            ScheduledTask: 更新后的定时任务对象
            
        Raises:
            NotFoundError: 当定时任务不存在时抛出
        """
        scheduled_task = await ScheduledTaskService.get_scheduled_task_by_uuid(tenant_id, task_uuid)
        
        old_status = scheduled_task.last_run_status
        
        # 更新执行结果
        scheduled_task.is_running = False
        scheduled_task.last_run_at = datetime.now()
        scheduled_task.last_run_status = status
        scheduled_task.last_error = error
        
        if inngest_run_id:
            # 可以存储 Inngest 运行ID用于追踪
            pass
        
        await scheduled_task.save()
        
        # 异步发送消息通知
        import asyncio
        asyncio.create_task(
            ScheduledTaskService._send_task_execution_notification(
                tenant_id=tenant_id,
                scheduled_task=scheduled_task,
                status=status,
                error=error,
                old_status=old_status
            )
        )
        
        return scheduled_task
    
    @staticmethod
    async def _send_task_execution_notification(
        tenant_id: int,
        scheduled_task: ScheduledTask,
        status: str,
        error: Optional[str],
        old_status: Optional[str]
    ) -> None:
        """
        发送定时任务执行结果通知
        
        Args:
            tenant_id: 组织ID
            scheduled_task: 定时任务对象
            status: 执行状态
            error: 错误信息
            old_status: 旧状态
        """
        try:
            # 获取组织管理员列表（发送通知给管理员）
            # 如果没有管理员，则发送到系统消息中心
            admins = await User.filter(
                tenant_id=tenant_id,
                is_tenant_admin=True,
                is_active=True,
                deleted_at__isnull=True
            ).all()
            
            # 如果没有管理员，尝试获取创建者（如果有的话）
            recipients = []
            if admins:
                for admin in admins:
                    if admin.email:
                        recipients.append(admin.email)
            
            # 如果没有找到接收人，跳过发送（或者可以发送到系统消息中心）
            if not recipients:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"定时任务 {scheduled_task.name} 执行结果通知：未找到接收人（组织管理员）")
                return
            
            # 构建消息内容
            status_text = {
                "success": "成功",
                "failed": "失败"
            }.get(status, status)
            
            error_text = f"，错误信息：{error}" if error else ""
            
            # 发送消息给所有管理员
            for recipient in recipients:
                try:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=recipient,
                            subject=f"定时任务执行{status_text}：{scheduled_task.name}",
                            content=f"定时任务「{scheduled_task.name}」（代码：{scheduled_task.code}）执行{status_text}{error_text}。执行时间：{scheduled_task.last_run_at.strftime('%Y-%m-%d %H:%M:%S') if scheduled_task.last_run_at else '未知'}。",
                        )
                    )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"发送定时任务执行结果通知失败（接收人：{recipient}）: {str(e)}")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"发送定时任务执行结果通知失败: {str(e)}")

