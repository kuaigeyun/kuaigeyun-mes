"""
库存调整服务模块

提供库存调整的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiwms.models.inventory_adjustment import InventoryAdjustment
from apps.kuaiwms.schemas.inventory_adjustment_schemas import (
    InventoryAdjustmentCreate, InventoryAdjustmentUpdate, InventoryAdjustmentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InventoryAdjustmentService:
    """库存调整服务"""
    
    @staticmethod
    async def create_inventory_adjustment(
        tenant_id: int,
        data: InventoryAdjustmentCreate
    ) -> InventoryAdjustmentResponse:
        """
        创建库存调整
        
        Args:
            tenant_id: 租户ID
            data: 调整创建数据
            
        Returns:
            InventoryAdjustmentResponse: 创建的调整对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await InventoryAdjustment.filter(
            tenant_id=tenant_id,
            adjustment_no=data.adjustment_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"调整单编号 {data.adjustment_no} 已存在")
        
        # 创建调整
        adjustment = await InventoryAdjustment.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return InventoryAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def get_inventory_adjustment_by_uuid(
        tenant_id: int,
        adjustment_uuid: str
    ) -> InventoryAdjustmentResponse:
        """
        根据UUID获取库存调整
        
        Args:
            tenant_id: 租户ID
            adjustment_uuid: 调整UUID
            
        Returns:
            InventoryAdjustmentResponse: 调整对象
            
        Raises:
            NotFoundError: 当调整不存在时抛出
        """
        adjustment = await InventoryAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"库存调整 {adjustment_uuid} 不存在")
        
        return InventoryAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def list_inventory_adjustments(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        warehouse_id: Optional[int] = None
    ) -> List[InventoryAdjustmentResponse]:
        """
        获取库存调整列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 调整状态（过滤）
            warehouse_id: 仓库ID（过滤）
            
        Returns:
            List[InventoryAdjustmentResponse]: 调整列表
        """
        query = InventoryAdjustment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if warehouse_id:
            query = query.filter(warehouse_id=warehouse_id)
        
        adjustments = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [InventoryAdjustmentResponse.model_validate(adj) for adj in adjustments]
    
    @staticmethod
    async def update_inventory_adjustment(
        tenant_id: int,
        adjustment_uuid: str,
        data: InventoryAdjustmentUpdate
    ) -> InventoryAdjustmentResponse:
        """
        更新库存调整
        
        Args:
            tenant_id: 租户ID
            adjustment_uuid: 调整UUID
            data: 调整更新数据
            
        Returns:
            InventoryAdjustmentResponse: 更新后的调整对象
            
        Raises:
            NotFoundError: 当调整不存在时抛出
        """
        adjustment = await InventoryAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"库存调整 {adjustment_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(adjustment, key, value)
        
        await adjustment.save()
        
        return InventoryAdjustmentResponse.model_validate(adjustment)
    
    @staticmethod
    async def delete_inventory_adjustment(
        tenant_id: int,
        adjustment_uuid: str
    ) -> None:
        """
        删除库存调整（软删除）
        
        Args:
            tenant_id: 租户ID
            adjustment_uuid: 调整UUID
            
        Raises:
            NotFoundError: 当调整不存在时抛出
        """
        adjustment = await InventoryAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"库存调整 {adjustment_uuid} 不存在")
        
        adjustment.deleted_at = datetime.utcnow()
        await adjustment.save()
    
    @staticmethod
    async def submit_for_approval(
        tenant_id: int,
        adjustment_uuid: str,
        process_code: str,
        user_id: int
    ) -> InventoryAdjustmentResponse:
        """
        提交库存调整审批
        
        Args:
            tenant_id: 租户ID
            adjustment_uuid: 调整UUID
            process_code: 审批流程代码
            user_id: 提交人ID
            
        Returns:
            InventoryAdjustmentResponse: 更新后的调整对象
            
        Raises:
            NotFoundError: 当调整或审批流程不存在时抛出
            ValidationError: 当调整已提交审批时抛出
        """
        adjustment = await InventoryAdjustment.filter(
            tenant_id=tenant_id,
            uuid=adjustment_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not adjustment:
            raise NotFoundError(f"库存调整 {adjustment_uuid} 不存在")
        
        # 检查是否已经提交审批
        if adjustment.approval_instance_id:
            raise ValidationError("库存调整已提交审批，无法重复提交")
        
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
            title=f"库存调整审批：{adjustment.adjustment_no}",
            content=f"调整单编号：{adjustment.adjustment_no}\n调整类型：{adjustment.adjustment_type}\n调整原因：{adjustment.adjustment_reason}",
            data={
                "adjustment_uuid": adjustment_uuid,
                "adjustment_no": adjustment.adjustment_no,
                "adjustment_type": adjustment.adjustment_type,
                "warehouse_id": adjustment.warehouse_id,
            }
        )
        
        approval_instance = await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id,
            user_id=user_id,
            data=approval_data
        )
        
        # 更新调整状态
        adjustment.approval_instance_id = approval_instance.id
        adjustment.approval_status = "pending"
        adjustment.status = "待审批"
        await adjustment.save()
        
        return InventoryAdjustmentResponse.model_validate(adjustment)
