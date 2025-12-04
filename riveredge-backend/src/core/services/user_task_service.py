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
from core.services.approval_instance_service import ApprovalInstanceService
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
        # 构建查询条件
        if task_type == "pending":
            # 待处理任务：当前审批人是当前用户，且状态为 pending
            query = Q(
                tenant_id=tenant_id,
                current_approver_id=user_id,
                status="pending"
            )
        elif task_type == "submitted":
            # 我提交的任务：提交人是当前用户
            query = Q(
                tenant_id=tenant_id,
                submitter_id=user_id
            )
        else:
            # 默认：待处理任务
            query = Q(
                tenant_id=tenant_id,
                current_approver_id=user_id,
                status="pending"
            )
        
        # 状态过滤
        if status:
            query &= Q(status=status)
        
        # 优化分页查询：先查询总数，再查询数据
        total = await ApprovalInstance.filter(query).count()
        
        # 限制分页大小，避免过大查询
        if page_size > 100:
            page_size = 100
        
        # 查询列表（按创建时间倒序，预加载关联数据）
        offset = (page - 1) * page_size
        tasks = await ApprovalInstance.filter(query).prefetch_related("process").order_by("-created_at").offset(offset).limit(page_size)
        
        # 转换为响应格式
        items = []
        for task in tasks:
            # 需要获取 process.uuid
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
            items.append(UserTaskResponse.model_validate(task_dict))
        
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
        try:
            task = await ApprovalInstance.filter(
                uuid=task_uuid,
                tenant_id=tenant_id
            ).prefetch_related("process").first()
            
            if not task:
                raise DoesNotExist()
        except DoesNotExist:
            raise NotFoundError("任务不存在")
        
        # 调用审批流程服务来处理审批操作，确保逻辑一致并触发消息通知
        approval_action = ApprovalInstanceAction(
            action=data.action,
            comment=data.comment,
            transfer_to_user_id=None  # 用户任务暂不支持转交
        )
        
        # 调用审批流程服务执行审批操作（会自动触发消息通知）
        updated_task = await ApprovalInstanceService.perform_approval_action(
            tenant_id=tenant_id,
            uuid=task_uuid,
            user_id=user_id,
            action=approval_action
        )
        
        # 重新获取任务以获取最新状态
        await updated_task.fetch_related("process")
        
        # 转换为响应格式
        task_dict = {
            "uuid": updated_task.uuid,
            "tenant_id": updated_task.tenant_id,
            "process_uuid": updated_task.process.uuid if updated_task.process else None,
            "title": updated_task.title,
            "content": updated_task.content,
            "data": updated_task.data,
            "submitter_id": updated_task.submitter_id,
            "current_approver_id": updated_task.current_approver_id,
            "status": updated_task.status,
            "current_node": updated_task.current_node,
            "submitted_at": updated_task.submitted_at,
            "completed_at": updated_task.completed_at,
            "created_at": updated_task.created_at,
            "updated_at": updated_task.updated_at,
        }
        return UserTaskResponse.model_validate(task_dict)
    
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
        # 待处理任务（当前审批人是当前用户，且状态为 pending）
        pending_query = Q(
            tenant_id=tenant_id,
            current_approver_id=user_id,
            status="pending"
        )
        pending = await ApprovalInstance.filter(pending_query).count()
        
        # 我提交的任务
        submitted_query = Q(
            tenant_id=tenant_id,
            submitter_id=user_id
        )
        submitted = await ApprovalInstance.filter(submitted_query).count()
        
        # 已通过任务（我提交的）
        approved_query = Q(
            tenant_id=tenant_id,
            submitter_id=user_id,
            status="approved"
        )
        approved = await ApprovalInstance.filter(approved_query).count()
        
        # 已拒绝任务（我提交的）
        rejected_query = Q(
            tenant_id=tenant_id,
            submitter_id=user_id,
            status="rejected"
        )
        rejected = await ApprovalInstance.filter(rejected_query).count()
        
        # 总任务数（待处理 + 我提交的）
        total = pending + submitted
        
        return UserTaskStatsResponse(
            total=total,
            pending=pending,
            approved=approved,
            rejected=rejected,
            submitted=submitted,
        )

