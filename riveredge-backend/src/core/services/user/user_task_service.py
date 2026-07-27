"""
用户任务管理服务模块

提供用户任务的查询、处理等功能。
复用 ApprovalInstance 模型，但提供用户视角的服务。
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from tortoise.expressions import Q
from loguru import logger

from core.models.approval_instance import ApprovalInstance
from core.models.approval_process import ApprovalProcess
from core.models.approval_task import ApprovalTask
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.schemas.approval_instance import ApprovalInstanceAction
from core.schemas.user_task import (
    UserTaskResponse,
    UserTaskListResponse,
    UserTaskStatsResponse,
    UserTaskActionRequest,
    UserTaskCreateRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime


# 个人任务在 ApprovalProcess 表里对应的占位流程 code，各租户首次创建个人任务时自动落库
_PERSONAL_TASK_PROCESS_CODE = "personal_task"


def _parse_status_filter(status: Optional[str]) -> Optional[List[str]]:
    """
    解析状态筛选参数，兼容单值与逗号分隔多值（如 approved,rejected）。
    """
    if not status:
        return None
    values = [s.strip() for s in status.split(",") if s and s.strip()]
    return values or None


async def _enrich_user_display_names(
    tenant_id: int, items: List[UserTaskResponse]
) -> List[UserTaskResponse]:
    """为任务列表补齐提交人 / 当前审批人显示名。"""
    if not items:
        return items
    user_ids: List[int] = []
    for item in items:
        if item.submitter_id:
            user_ids.append(int(item.submitter_id))
        if item.current_approver_id:
            user_ids.append(int(item.current_approver_id))
    name_map = await ApprovalInstanceService._user_display_map(tenant_id, user_ids)
    for item in items:
        sid = int(item.submitter_id) if item.submitter_id else None
        if sid:
            item.submitter_name = name_map.get(sid) or str(sid)
        aid = int(item.current_approver_id) if item.current_approver_id else None
        if aid:
            item.current_approver_name = name_map.get(aid) or str(aid)
    return items


class UserTaskService:
    """
    用户任务管理服务类
    
    提供用户任务的查询、处理等功能。
    复用 ApprovalInstance 模型，但提供用户视角的服务。
    """
    
    @staticmethod
    async def get_user_tasks(
        tenant_id: int,
        user_id: int,
        page: int = 1,
        page_size: int = 20,
        status: Optional[str] = None,
        task_type: Optional[str] = None,  # "pending" 待处理, "processed" 已处理, "submitted" 我提交的
    ) -> UserTaskListResponse:
        """
        获取用户任务列表
        """
        try:
            offset = (page - 1) * page_size
            status_values = _parse_status_filter(status)
            
            items = []
            if task_type == "submitted":
                # 查询我提交的任务（基于实例）
                query = Q(tenant_id=tenant_id, submitter_id=user_id)
                if status_values:
                    query &= Q(status__in=status_values)
                total = await ApprovalInstance.filter(query).count()
                instances = await ApprovalInstance.filter(query).prefetch_related("process").order_by("-created_at").offset(offset).limit(page_size)
                for inst in instances:
                    # 安全获取流程 UUID
                    process_uuid = None
                    if inst.process:
                        process_uuid = getattr(inst.process, "uuid", None)
                    
                    items.append(UserTaskResponse(
                        uuid=inst.uuid,
                        tenant_id=inst.tenant_id,
                        process_uuid=process_uuid,
                        title=inst.title,
                        content=inst.content,
                        data=inst.data,
                        submitter_id=inst.submitter_id,
                        current_approver_id=inst.current_approver_id,
                        status=inst.status,
                        current_node=inst.current_node,
                        remind_at=inst.remind_at,
                        submitted_at=inst.submitted_at,
                        completed_at=inst.completed_at,
                        created_at=inst.created_at,
                        updated_at=inst.updated_at
                    ))
            elif task_type == "processed":
                # 查询我已处理的任务（基于任务表）
                query = Q(tenant_id=tenant_id, approver_id=user_id)
                if status_values:
                    query &= Q(status__in=status_values)
                else:
                    query &= Q(status__in=["approved", "rejected", "cancelled"])
                total = await ApprovalTask.filter(query).count()
                tasks = await ApprovalTask.filter(query).prefetch_related("approval_instance__process").order_by("-created_at").offset(offset).limit(page_size)
                for task in tasks:
                    inst = task.approval_instance
                    if not inst:
                        continue

                    process_uuid = None
                    if hasattr(inst, "process") and inst.process:
                        process_uuid = getattr(inst.process, "uuid", None)

                    items.append(UserTaskResponse(
                        uuid=task.uuid,
                        tenant_id=task.tenant_id,
                        process_uuid=process_uuid,
                        title=inst.title,
                        content=inst.content,
                        data=inst.data,
                        submitter_id=inst.submitter_id,
                        current_approver_id=user_id,
                        status=task.status,
                        current_node=task.node_id,
                        remind_at=inst.remind_at,
                        submitted_at=inst.submitted_at,
                        completed_at=inst.completed_at,
                        created_at=task.created_at,
                        updated_at=task.updated_at
                    ))
            else:
                # 查询我的待办任务（基于任务表）
                query = Q(tenant_id=tenant_id, approver_id=user_id, status="pending")
                total = await ApprovalTask.filter(query).count()
                tasks = await ApprovalTask.filter(query).prefetch_related("approval_instance__process").order_by("-created_at").offset(offset).limit(page_size)
                for task in tasks:
                    inst = task.approval_instance
                    if not inst:
                        continue
                    
                    # 安全获取流程 UUID
                    process_uuid = None
                    if hasattr(inst, "process") and inst.process:
                        process_uuid = getattr(inst.process, "uuid", None)
                    
                    items.append(UserTaskResponse(
                        uuid=task.uuid, # 注意：待办任务返回的是任务自身的 UUID
                        tenant_id=task.tenant_id,
                        process_uuid=process_uuid,
                        title=inst.title,
                        content=inst.content,
                        data=inst.data,
                        submitter_id=inst.submitter_id,
                        current_approver_id=user_id,
                        status=task.status,
                        current_node=task.node_id,
                        remind_at=inst.remind_at,
                        submitted_at=inst.submitted_at,
                        completed_at=inst.completed_at,
                        created_at=task.created_at,
                        updated_at=task.updated_at
                    ))

            await _enrich_user_display_names(tenant_id, items)
            return UserTaskListResponse(
                items=items,
                total=total,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.exception(f"获取用户任务列表失败: {e}")
            raise e
    
    @staticmethod
    async def get_user_task(
        tenant_id: int,
        user_id: int,
        task_uuid: str
    ) -> UserTaskResponse:
        """
        获取用户任务详情
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            task_uuid: 任务UUID
            
        Returns:
            UserTaskResponse: 用户任务对象
            
        Raises:
            NotFoundError: 当任务不存在时抛出
        """
        task = await ApprovalInstance.filter(
            uuid=task_uuid,
            tenant_id=tenant_id
        ).prefetch_related("process").first()
        
        if not task:
            raise NotFoundError("任务不存在")
        
        # 检查权限：必须是当前审批人或提交人
        if task.current_approver_id != user_id and task.submitter_id != user_id:
            raise NotFoundError("无权访问此任务")
        
        # 转换为响应格式
        task_dict = {
            "uuid": task.uuid,
            "tenant_id": task.tenant_id,
            "process_uuid": task.process.uuid if task.process else None,
            "title": task.title,
            "content": task.content,
            "data": task.data,
            "submitter_id": task.submitter_id,
            "current_approver_id": task.current_approver_id,
            "status": task.status,
            "current_node": task.current_node,
            "remind_at": task.remind_at,
            "submitted_at": task.submitted_at,
            "completed_at": task.completed_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        response = UserTaskResponse.model_validate(task_dict)
        await _enrich_user_display_names(tenant_id, [response])
        return response
    
    @staticmethod
    async def process_user_task(
        tenant_id: int,
        user_id: int,
        task_uuid: str,
        data: UserTaskActionRequest
    ) -> UserTaskResponse:
        """
        处理用户任务（审批或拒绝）
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            task_uuid: 任务UUID
            data: 任务操作数据
            
        Returns:
            UserTaskResponse: 更新后的任务对象
            
        Raises:
            NotFoundError: 当任务不存在时抛出
            ValidationError: 当操作无效时抛出
        """
        # 先尝试按任务 UUID 查找
        task = await ApprovalTask.filter(uuid=task_uuid, tenant_id=tenant_id, approver_id=user_id).prefetch_related("approval_instance__process").first()
        
        if task:
            # 使用高级任务处理逻辑
            instance = await ApprovalInstanceService.perform_task_action(
                tenant_id=tenant_id,
                task_uuid=task_uuid,
                user_id=user_id,
                action_data=ApprovalInstanceAction(
                    action=data.action,
                    comment=data.comment
                )
            )
            # 返回对应实例的状态（包装成 UserTaskResponse）
            return UserTaskResponse(
                uuid=instance.uuid,
                tenant_id=instance.tenant_id,
                process_uuid=instance.process.uuid if instance.process else None,
                title=instance.title,
                content=instance.content,
                status=instance.status,
                submitter_id=instance.submitter_id,
                submitted_at=instance.submitted_at,
                created_at=instance.created_at,
                updated_at=instance.updated_at
            )
            
        # 回退到旧逻辑（按实例 UUID 查找）
        approval_action = ApprovalInstanceAction(
            action=data.action,
            comment=data.comment
        )
        updated_inst = await ApprovalInstanceService.perform_approval_action(
            tenant_id=tenant_id,
            uuid=task_uuid,
            user_id=user_id,
            action=approval_action
        )
        return UserTaskResponse.model_validate(updated_inst)
    
    @staticmethod
    async def get_user_task_stats(
        tenant_id: int,
        user_id: int
    ) -> UserTaskStatsResponse:
        """
        获取用户任务统计
        """
        try:
            # 待处理任务（基于任务表）
            pending_tasks = await ApprovalTask.filter(
                tenant_id=tenant_id,
                approver_id=user_id,
                status="pending"
            ).prefetch_related("approval_instance")
            
            pending = len(pending_tasks)
            pending_personal = 0
            for t in pending_tasks:
                if t.approval_instance and t.approval_instance.data and t.approval_instance.data.get("is_personal"):
                    pending_personal += 1
            pending_system = pending - pending_personal
            
            # 我提交的任务（基于实例表）
            submitted = await ApprovalInstance.filter(
                tenant_id=tenant_id,
                submitter_id=user_id
            ).count()
            
            # 已通过任务（我提交的）
            approved = await ApprovalInstance.filter(
                tenant_id=tenant_id,
                submitter_id=user_id,
                status="approved"
            ).count()
            
            # 已拒绝任务（我提交的）
            rejected = await ApprovalInstance.filter(
                tenant_id=tenant_id,
                submitter_id=user_id,
                status="rejected"
            ).count()
            
            return UserTaskStatsResponse(
                total=pending + submitted,
                pending=pending,
                pending_system=pending_system,
                pending_personal=pending_personal,
                approved=approved,
                rejected=rejected,
                submitted=submitted,
            )
        except Exception as e:
            logger.exception(f"获取用户任务统计失败: {e}")
            raise e
            
    @staticmethod
    async def _get_or_create_personal_task_process(tenant_id: int) -> ApprovalProcess:
        """
        获取或初始化该租户下用于承载「个人任务」的占位审批流程。

        个人任务不走真正的审批链路，但当前复用 ApprovalInstance 模型，
        ApprovalInstance.process 是必填外键，因此需要一条稳定的流程记录来关联，
        避免硬编码 process_id=1 在不同租户/环境下缺失导致外键约束失败。
        """
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=_PERSONAL_TASK_PROCESS_CODE,
        ).first()
        if process:
            return process
        return await ApprovalProcess.create(
            tenant_id=tenant_id,
            name="个人任务",
            code=_PERSONAL_TASK_PROCESS_CODE,
            description="用户手动创建的个人待办任务占位流程",
            nodes=[],
            config={"is_personal": True},
            is_active=True,
        )

    @staticmethod
    async def create_user_task(
        tenant_id: int,
        user_id: int,
        data: UserTaskCreateRequest
    ) -> UserTaskResponse:
        """
        手动创建个人任务 (TodoList)
        """
        try:
            process = await UserTaskService._get_or_create_personal_task_process(tenant_id)

            # 创建审批实例作为个人任务（uuid 由 BaseModel 默认值生成，无需手动指定）
            inst = await ApprovalInstance.create(
                tenant_id=tenant_id,
                process=process,
                title=data.title,
                content=data.content,
                remind_at=data.remind_at,
                data={"is_personal": True},
                status="pending",
                submitter_id=user_id,
                current_approver_id=user_id,
                submitted_at=resolve_business_datetime(),
            )

            # 同时创建一条关联任务，方便在"待办"中看到
            await ApprovalTask.create(
                tenant_id=tenant_id,
                approval_instance=inst,
                node_id="personal_task",
                approver_id=user_id,
                status="pending",
            )

            return UserTaskResponse(
                uuid=inst.uuid,
                tenant_id=inst.tenant_id,
                process_uuid=process.uuid,
                title=inst.title,
                content=inst.content,
                remind_at=inst.remind_at,
                status=inst.status,
                submitter_id=inst.submitter_id,
                submitted_at=inst.submitted_at,
                created_at=inst.created_at,
                updated_at=inst.updated_at,
            )
        except Exception as e:
            logger.exception(f"创建个人任务失败: {e}")
            raise e

    @staticmethod
    async def delete_user_task(
        tenant_id: int,
        user_id: int,
        task_uuid: str
    ) -> None:
        """
        删除用户任务
        
        仅限：
        1. 手动创建的个人任务（is_personal=True）
        2. 处于待审批状态且由本人提交的任务（撤回/删除）
        """
        instance = await ApprovalInstance.filter(
            uuid=task_uuid,
            tenant_id=tenant_id
        ).first()
        
        if not instance:
            raise NotFoundError("任务不存在")
            
        # 权限校验：必须是提交者才能删除
        if instance.submitter_id != user_id:
            raise ValidationError("无权删除非本人提交的任务")
            
        # 业务校验：个人任务随时可删；正式任务仅待处理时可删
        is_personal = instance.data and instance.data.get("is_personal")
        if not is_personal and instance.status != "pending":
            raise ValidationError("正式流程任务已处理，无法删除")
            
        # 执行物理删除（Cascade 会自动处理关联的 ApprovalTask）
        await instance.delete()

