"""
定时任务管理服务模块

提供定时任务的 CRUD；执行侧由 Taskiq 事件管道（如 scheduled-task/execute）触发。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import IntegrityError

from core.models.scheduled_task import ScheduledTask
from core.schemas.scheduled_task import ScheduledTaskCreate, ScheduledTaskUpdate
from core.services.messaging.message_service import MessageService
from core.schemas.message_template import SendMessageRequest
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat


class ScheduledTaskService:
    """
    定时任务管理服务类

    提供定时任务的 CRUD；与运行记录字段（如历史 inngest_run_id）兼容，调度由 Taskiq 承担。
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
            
            # TODO: 集成工作流函数注册
            # 当任务启用时，注册到工作流执行器
            # if scheduled_task.is_active:
            #     from core.workflows.functions.scheduled_task_executor import register_scheduled_task
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
        
        scheduled_task.deleted_at = resolve_business_datetime()
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
        scheduled_task.last_run_at = resolve_business_datetime()
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
        scheduled_task.last_run_at = resolve_business_datetime()
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
            # 仅失败时通知，且只发站内信给组织管理员（recipient=user.id）
            if status != "failed":
                return

            admins = await User.filter(
                tenant_id=tenant_id,
                is_tenant_admin=True,
                is_active=True,
                deleted_at__isnull=True
            ).all()
            recipient_ids = [admin.id for admin in admins if admin.id]
            if not recipient_ids:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"定时任务 {scheduled_task.name} 执行结果通知：未找到接收人（组织管理员）")
                return

            error_text = f"，错误信息：{error}" if error else ""
            run_at = (
                to_api_isoformat(scheduled_task.last_run_at)
                if scheduled_task.last_run_at
                else "未知"
            )
            for uid in recipient_ids:
                try:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=str(uid),
                            subject=f"定时任务执行失败：{scheduled_task.name}",
                            content=(
                                f"定时任务「{scheduled_task.name}」（代码：{scheduled_task.code}）"
                                f"执行失败{error_text}。执行时间：{run_at}。"
                            ),
                            variables={
                                "message_category": "system",
                                "trigger_document": "scheduled_task",
                                "trigger_action": "failed",
                                "detail_path": "/system/scheduled-tasks",
                            },
                        )
                    )
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"发送定时任务执行结果通知失败（接收人：{uid}）: {str(e)}")
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"发送定时任务执行结果通知失败: {str(e)}")

