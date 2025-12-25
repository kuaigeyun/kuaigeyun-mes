"""
设计变更服务模块

提供设计变更的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaipdm.models.design_change import DesignChange
from apps.kuaipdm.schemas.design_change_schemas import (
    DesignChangeCreate, DesignChangeUpdate, DesignChangeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DesignChangeService:
    """设计变更服务"""
    
    @staticmethod
    async def create_design_change(
        tenant_id: int,
        data: DesignChangeCreate
    ) -> DesignChangeResponse:
        """
        创建设计变更
        
        Args:
            tenant_id: 租户ID
            data: 变更创建数据
            
        Returns:
            DesignChangeResponse: 创建的变更对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await DesignChange.filter(
            tenant_id=tenant_id,
            change_no=data.change_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"变更编号 {data.change_no} 已存在")
        
        # 创建变更
        change = await DesignChange.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DesignChangeResponse.model_validate(change)
    
    @staticmethod
    async def get_design_change_by_uuid(
        tenant_id: int,
        change_uuid: str
    ) -> DesignChangeResponse:
        """
        根据UUID获取设计变更
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            
        Returns:
            DesignChangeResponse: 变更对象
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await DesignChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"设计变更 {change_uuid} 不存在")
        
        return DesignChangeResponse.model_validate(change)
    
    @staticmethod
    async def list_design_changes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        change_type: Optional[str] = None
    ) -> List[DesignChangeResponse]:
        """
        获取设计变更列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 变更状态（过滤）
            change_type: 变更类型（过滤）
            
        Returns:
            List[DesignChangeResponse]: 变更列表
        """
        query = DesignChange.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if change_type:
            query = query.filter(change_type=change_type)
        
        changes = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DesignChangeResponse.model_validate(change) for change in changes]
    
    @staticmethod
    async def update_design_change(
        tenant_id: int,
        change_uuid: str,
        data: DesignChangeUpdate
    ) -> DesignChangeResponse:
        """
        更新设计变更
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            data: 变更更新数据
            
        Returns:
            DesignChangeResponse: 更新后的变更对象
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await DesignChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"设计变更 {change_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(change, key, value)
        
        await change.save()
        
        return DesignChangeResponse.model_validate(change)
    
    @staticmethod
    async def delete_design_change(
        tenant_id: int,
        change_uuid: str
    ) -> None:
        """
        删除设计变更（软删除）
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            
        Raises:
            NotFoundError: 当变更不存在时抛出
        """
        change = await DesignChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"设计变更 {change_uuid} 不存在")
        
        change.deleted_at = datetime.utcnow()
        await change.save()
    
    @staticmethod
    async def submit_for_approval(
        tenant_id: int,
        change_uuid: str,
        process_code: str,
        user_id: int
    ) -> DesignChangeResponse:
        """
        提交设计变更审批
        
        Args:
            tenant_id: 租户ID
            change_uuid: 变更UUID
            process_code: 审批流程代码
            user_id: 提交人ID
            
        Returns:
            DesignChangeResponse: 更新后的变更对象
            
        Raises:
            NotFoundError: 当变更或审批流程不存在时抛出
            ValidationError: 当变更已提交审批时抛出
        """
        change = await DesignChange.filter(
            tenant_id=tenant_id,
            uuid=change_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not change:
            raise NotFoundError(f"设计变更 {change_uuid} 不存在")
        
        # 检查是否已经提交审批
        if change.approval_instance_id:
            raise ValidationError("设计变更已提交审批，无法重复提交")
        
        # 获取审批流程
        from core.models.approval_process import ApprovalProcess
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=process_code,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not process:
            raise NotFoundError(f"审批流程 {process_code} 不存在或未启用")
        
        # 创建审批实例
        from core.services.approval_instance_service import ApprovalInstanceService
        from core.schemas.approval_instance import ApprovalInstanceCreate
        
        approval_data = ApprovalInstanceCreate(
            process_uuid=str(process.uuid),
            title=f"设计变更审批：{change.change_no}",
            content=f"变更编号：{change.change_no}\n变更类型：{change.change_type}\n变更原因：{change.change_reason}",
            data={
                "change_uuid": change_uuid,
                "change_no": change.change_no,
                "change_type": change.change_type,
                "product_id": change.product_id,
            }
        )
        
        approval_instance = await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id,
            user_id=user_id,
            data=approval_data
        )
        
        # 更新变更状态
        change.approval_instance_id = approval_instance.id
        change.approval_status = "pending"
        change.status = "审批中"
        await change.save()
        
        return DesignChangeResponse.model_validate(change)
