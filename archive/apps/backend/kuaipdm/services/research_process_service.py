"""
研发流程服务模块

提供研发流程的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaipdm.models.research_process import ResearchProcess
from apps.kuaipdm.schemas.research_process_schemas import (
    ResearchProcessCreate, ResearchProcessUpdate, ResearchProcessResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ResearchProcessService:
    """研发流程服务"""
    
    @staticmethod
    async def create_research_process(
        tenant_id: int,
        data: ResearchProcessCreate
    ) -> ResearchProcessResponse:
        """
        创建研发流程
        
        Args:
            tenant_id: 租户ID
            data: 流程创建数据
            
        Returns:
            ResearchProcessResponse: 创建的流程对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ResearchProcess.filter(
            tenant_id=tenant_id,
            process_no=data.process_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"流程编号 {data.process_no} 已存在")
        
        # 创建流程
        process = await ResearchProcess.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ResearchProcessResponse.model_validate(process)
    
    @staticmethod
    async def get_research_process_by_uuid(
        tenant_id: int,
        process_uuid: str
    ) -> ResearchProcessResponse:
        """
        根据UUID获取研发流程
        
        Args:
            tenant_id: 租户ID
            process_uuid: 流程UUID
            
        Returns:
            ResearchProcessResponse: 流程对象
            
        Raises:
            NotFoundError: 当流程不存在时抛出
        """
        process = await ResearchProcess.filter(
            tenant_id=tenant_id,
            uuid=process_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process:
            raise NotFoundError(f"研发流程 {process_uuid} 不存在")
        
        return ResearchProcessResponse.model_validate(process)
    
    @staticmethod
    async def list_research_processes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        process_type: Optional[str] = None
    ) -> List[ResearchProcessResponse]:
        """
        获取研发流程列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 流程状态（过滤）
            process_type: 流程类型（过滤）
            
        Returns:
            List[ResearchProcessResponse]: 流程列表
        """
        query = ResearchProcess.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if process_type:
            query = query.filter(process_type=process_type)
        
        processes = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ResearchProcessResponse.model_validate(process) for process in processes]
    
    @staticmethod
    async def update_research_process(
        tenant_id: int,
        process_uuid: str,
        data: ResearchProcessUpdate
    ) -> ResearchProcessResponse:
        """
        更新研发流程
        
        Args:
            tenant_id: 租户ID
            process_uuid: 流程UUID
            data: 流程更新数据
            
        Returns:
            ResearchProcessResponse: 更新后的流程对象
            
        Raises:
            NotFoundError: 当流程不存在时抛出
        """
        process = await ResearchProcess.filter(
            tenant_id=tenant_id,
            uuid=process_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process:
            raise NotFoundError(f"研发流程 {process_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(process, key, value)
        
        await process.save()
        
        return ResearchProcessResponse.model_validate(process)
    
    @staticmethod
    async def delete_research_process(
        tenant_id: int,
        process_uuid: str
    ) -> None:
        """
        删除研发流程（软删除）
        
        Args:
            tenant_id: 租户ID
            process_uuid: 流程UUID
            
        Raises:
            NotFoundError: 当流程不存在时抛出
        """
        process = await ResearchProcess.filter(
            tenant_id=tenant_id,
            uuid=process_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process:
            raise NotFoundError(f"研发流程 {process_uuid} 不存在")
        
        process.deleted_at = datetime.utcnow()
        await process.save()
