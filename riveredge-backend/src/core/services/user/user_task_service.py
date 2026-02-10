"""
用户任务管理服务模块

提供用户任务的查询、处理等功能。
复用 ApprovalInstance 模型，但提供用户视角的服务。
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from tortoise.exceptions import DoesNotExist
from tortoise.expressions import Q

from core.models.approval_instance import ApprovalInstance
from core.models.approval_task import ApprovalTask
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.schemas.approval_instance import ApprovalInstanceAction
from core.schemas.user_task import (
    UserTaskResponse,
    UserTaskListResponse,
    UserTaskStatsResponse,
    UserTaskActionRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
        task_type: Optional[str] = None,  # "pending" 待处理, "submitted" 我提交的
    ) -> UserTaskListResponse:
        """
        获取用户任务列表
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            page: 页码
            page_size: 每页数量
            status: 任务状态过滤（可选）
            task_type: 任务类型（pending=待处理, submitted=我提交的）
            
        Returns:
            UserTaskListResponse: 用户任务列表
        """
        offset = (page - 1) * page_size
        
        items = []
        if task_type == "submitted":
            # 查询我提交的任务（基于实例）
            query = Q(tenant_id=tenant_id, submitter_id=user_id)
            if status:
                query &= Q(status=status)
            total = await ApprovalInstance.filter(query).count()
            instances = await ApprovalInstance.filter(query).prefetch_related("process").order_by("-created_at").offset(offset).limit(page_size)
            for inst in instances:
                items.append(UserTaskResponse(
                    uuid=inst.uuid,
                    tenant_id=inst.tenant_id,
                    process_uuid=inst.process.uuid if inst.process else None,
                    title=inst.title,
                    content=inst.content,
                    data=inst.data,
                    submitter_id=inst.submitter_id,
                    current_approver_id=inst.current_approver_id,
                    status=inst.status,
                    current_node=inst.current_node,
                    submitted_at=inst.submitted_at,
                    completed_at=inst.completed_at,
                    created_at=inst.created_at,
                    updated_at=inst.updated_at
                ))
        else:
            # 查询我的待办任务（基于任务表）
            query = Q(tenant_id=tenant_id, approver_id=user_id, status="pending")
            total = await ApprovalTask.filter(query).count()
            tasks = await ApprovalTask.filter(query).prefetch_related("approval_instance__process").order_by("-created_at").offset(offset).limit(page_size)
            for task in tasks:
                inst = task.approval_instance
                items.append(UserTaskResponse(
                    uuid=task.uuid, # 注意：待办任务返回的是任务自身的 UUID
                    tenant_id=task.tenant_id,
                    process_uuid=inst.process.uuid if inst.process else None,
                    title=inst.title,
                    content=inst.content,
                    data=inst.data,
                    submitter_id=inst.submitter_id,
                    current_approver_id=user_id,
                    status=task.status,
                    current_node=task.node_id,
                    submitted_at=inst.submitted_at,
                    completed_at=inst.completed_at,
                    created_at=task.created_at,
                    updated_at=task.updated_at
                ))
        
        return UserTaskListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
    
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
            "submitted_at": task.submitted_at,
            "completed_at": task.completed_at,
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        return UserTaskResponse.model_validate(task_dict)
    
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
        
        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            
        Returns:
            UserTaskStatsResponse: 用户任务统计
        """
        # 待处理任务（基于任务表）
        pending = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approver_id=user_id,
            status="pending"
        ).count()
        
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
            approved=approved,
            rejected=rejected,
            submitted=submitted,
        )

