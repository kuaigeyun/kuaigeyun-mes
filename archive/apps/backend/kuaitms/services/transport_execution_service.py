"""
运输执行服务模块

提供运输执行的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaitms.models.transport_execution import TransportExecution
from apps.kuaitms.schemas.transport_execution_schemas import (
    TransportExecutionCreate, TransportExecutionUpdate, TransportExecutionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class TransportExecutionService:
    """运输执行服务"""
    
    @staticmethod
    async def create_transport_execution(
        tenant_id: int,
        data: TransportExecutionCreate
    ) -> TransportExecutionResponse:
        """创建运输执行"""
        existing = await TransportExecution.filter(
            tenant_id=tenant_id,
            execution_no=data.execution_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"运输执行编号 {data.execution_no} 已存在")
        
        execution = await TransportExecution.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return TransportExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def get_transport_execution_by_uuid(
        tenant_id: int,
        execution_uuid: str
    ) -> TransportExecutionResponse:
        """根据UUID获取运输执行"""
        execution = await TransportExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"运输执行 {execution_uuid} 不存在")
        
        return TransportExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def list_transport_executions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        tracking_status: Optional[str] = None
    ) -> List[TransportExecutionResponse]:
        """获取运输执行列表"""
        query = TransportExecution.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if tracking_status:
            query = query.filter(tracking_status=tracking_status)
        
        executions = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [TransportExecutionResponse.model_validate(e) for e in executions]
    
    @staticmethod
    async def update_transport_execution(
        tenant_id: int,
        execution_uuid: str,
        data: TransportExecutionUpdate
    ) -> TransportExecutionResponse:
        """更新运输执行"""
        execution = await TransportExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"运输执行 {execution_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(execution, key, value)
        
        await execution.save()
        
        return TransportExecutionResponse.model_validate(execution)
    
    @staticmethod
    async def delete_transport_execution(
        tenant_id: int,
        execution_uuid: str
    ) -> None:
        """删除运输执行（软删除）"""
        execution = await TransportExecution.filter(
            tenant_id=tenant_id,
            uuid=execution_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not execution:
            raise NotFoundError(f"运输执行 {execution_uuid} 不存在")
        
        execution.deleted_at = datetime.utcnow()
        await execution.save()

