"""
合规检查服务模块

提供合规检查的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaiehs.models.compliance import ComplianceCheck
from apps.kuaiehs.schemas.compliance_check_schemas import (
    ComplianceCheckCreate, ComplianceCheckUpdate, ComplianceCheckResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ComplianceCheckService:
    """合规检查服务"""
    
    @staticmethod
    async def create_compliancecheck(
        tenant_id: int,
        data: ComplianceCheckCreate
    ) -> ComplianceCheckResponse:
        """
        创建合规检查
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            ComplianceCheckResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ComplianceCheck.filter(
            tenant_id=tenant_id,
            check_no=data.check_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"检查编号 {data.check_no} 已存在")
        
        # 创建对象
        obj = await ComplianceCheck.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ComplianceCheckResponse.model_validate(obj)
    
    @staticmethod
    async def get_compliancecheck_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> ComplianceCheckResponse:
        """
        根据UUID获取合规检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            ComplianceCheckResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规检查 {obj_uuid} 不存在")
        
        return ComplianceCheckResponse.model_validate(obj)
    
    @staticmethod
    async def list_compliancechecks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[ComplianceCheckResponse]:
        """
        获取合规检查列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[ComplianceCheckResponse]: 对象列表
        """
        query = ComplianceCheck.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [ComplianceCheckResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_compliancecheck(
        tenant_id: int,
        obj_uuid: str,
        data: ComplianceCheckUpdate
    ) -> ComplianceCheckResponse:
        """
        更新合规检查
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            ComplianceCheckResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规检查 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return ComplianceCheckResponse.model_validate(obj)
    
    @staticmethod
    async def delete_compliancecheck(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除合规检查（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await ComplianceCheck.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"合规检查 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
