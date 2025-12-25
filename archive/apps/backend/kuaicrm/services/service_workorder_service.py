"""
服务工单服务模块

提供服务工单的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.service_workorder import ServiceWorkOrder
from apps.kuaicrm.schemas.service_workorder_schemas import (
    ServiceWorkOrderCreate, ServiceWorkOrderUpdate, ServiceWorkOrderResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ServiceWorkOrderService:
    """服务工单服务"""
    
    @staticmethod
    async def create_workorder(
        tenant_id: int,
        data: ServiceWorkOrderCreate
    ) -> ServiceWorkOrderResponse:
        """
        创建服务工单
        
        Args:
            tenant_id: 租户ID
            data: 工单创建数据
            
        Returns:
            ServiceWorkOrderResponse: 创建的工单对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            workorder_no=data.workorder_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工单编号 {data.workorder_no} 已存在")
        
        # 创建工单
        workorder = await ServiceWorkOrder.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ServiceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def get_workorder_by_uuid(
        tenant_id: int,
        workorder_uuid: str
    ) -> ServiceWorkOrderResponse:
        """
        根据UUID获取服务工单
        
        Args:
            tenant_id: 租户ID
            workorder_uuid: 工单UUID
            
        Returns:
            ServiceWorkOrderResponse: 工单对象
            
        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        workorder = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"工单 {workorder_uuid} 不存在")
        
        return ServiceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def list_workorders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        workorder_type: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[ServiceWorkOrderResponse]:
        """
        获取服务工单列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 工单状态（过滤）
            workorder_type: 工单类型（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[ServiceWorkOrderResponse]: 工单列表
        """
        query = ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if workorder_type:
            query = query.filter(workorder_type=workorder_type)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        workorders = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ServiceWorkOrderResponse.model_validate(wo) for wo in workorders]
    
    @staticmethod
    async def assign_workorder(
        tenant_id: int,
        workorder_uuid: str,
        assigned_to: int
    ) -> ServiceWorkOrderResponse:
        """
        分配服务工单
        
        Args:
            tenant_id: 租户ID
            workorder_uuid: 工单UUID
            assigned_to: 分配给（用户ID）
            
        Returns:
            ServiceWorkOrderResponse: 更新后的工单对象
            
        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        workorder = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"工单 {workorder_uuid} 不存在")
        
        workorder.assigned_to = assigned_to
        workorder.status = "已分配"
        await workorder.save()
        
        return ServiceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def update_workorder(
        tenant_id: int,
        workorder_uuid: str,
        data: ServiceWorkOrderUpdate
    ) -> ServiceWorkOrderResponse:
        """
        更新服务工单
        
        Args:
            tenant_id: 租户ID
            workorder_uuid: 工单UUID
            data: 工单更新数据
            
        Returns:
            ServiceWorkOrderResponse: 更新后的工单对象
            
        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        workorder = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"工单 {workorder_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(workorder, key, value)
        
        await workorder.save()
        
        return ServiceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def close_workorder(
        tenant_id: int,
        workorder_uuid: str,
        execution_result: str
    ) -> ServiceWorkOrderResponse:
        """
        关闭服务工单
        
        Args:
            tenant_id: 租户ID
            workorder_uuid: 工单UUID
            execution_result: 执行结果
            
        Returns:
            ServiceWorkOrderResponse: 更新后的工单对象
            
        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        workorder = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"工单 {workorder_uuid} 不存在")
        
        from datetime import datetime
        workorder.status = "已完成"
        workorder.end_time = datetime.utcnow()
        workorder.execution_result = execution_result
        await workorder.save()
        
        return ServiceWorkOrderResponse.model_validate(workorder)
    
    @staticmethod
    async def delete_workorder(
        tenant_id: int,
        workorder_uuid: str
    ) -> None:
        """
        删除服务工单（软删除）
        
        Args:
            tenant_id: 租户ID
            workorder_uuid: 工单UUID
            
        Raises:
            NotFoundError: 当工单不存在时抛出
        """
        workorder = await ServiceWorkOrder.filter(
            tenant_id=tenant_id,
            uuid=workorder_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workorder:
            raise NotFoundError(f"工单 {workorder_uuid} 不存在")
        
        from datetime import datetime
        workorder.deleted_at = datetime.utcnow()
        await workorder.save()
