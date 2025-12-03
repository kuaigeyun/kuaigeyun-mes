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

from tree_root.models.approval_instance import ApprovalInstance
from tree_root.schemas.user_task import (
    UserTaskResponse,
    UserTaskListResponse,
    UserTaskStatsResponse,
    UserTaskActionRequest,
)
from soil.exceptions.exceptions import NotFoundError, ValidationError


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
        
        # 查询总数
        total = await ApprovalInstance.filter(query).count()
        
        # 查询列表（按创建时间倒序）
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
        
        # 检查权限：必须是当前审批人
        if task.current_approver_id != user_id:
            raise ValidationError("您不是当前审批人，无法处理此任务")
        
        # 检查状态：必须是待处理状态
        if task.status != "pending":
            raise ValidationError("任务状态不允许此操作")
        
        # 处理任务
        if data.action == "approve":
            # 审批通过
            # TODO: 这里应该调用审批流程服务来处理审批逻辑
            # 暂时简单处理：更新状态为 approved
            task.status = "approved"
            task.completed_at = datetime.now()
        elif data.action == "reject":
            # 审批拒绝
            task.status = "rejected"
            task.completed_at = datetime.now()
        else:
            raise ValidationError(f"不支持的操作类型: {data.action}")
        
        # 更新审批历史（存储到 data 字段中）
        if not task.data:
            task.data = {}
        
        if "approval_history" not in task.data:
            task.data["approval_history"] = []
        
        task.data["approval_history"].append({
            "approver_id": user_id,
            "action": data.action,
            "comment": data.comment,
            "timestamp": datetime.now().isoformat(),
        })
        
        await task.save()
        
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

