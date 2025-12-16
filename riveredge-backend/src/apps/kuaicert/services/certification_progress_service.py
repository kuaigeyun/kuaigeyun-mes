"""
认证进度服务模块

提供认证进度的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicert.models.certification_management import CertificationProgress
from apps.kuaicert.schemas.certification_progress_schemas import (
    CertificationProgressCreate, CertificationProgressUpdate, CertificationProgressResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CertificationProgressService:
    """认证进度服务"""
    
    @staticmethod
    async def create_certificationprogress(
        tenant_id: int,
        data: CertificationProgressCreate
    ) -> CertificationProgressResponse:
        """
        创建认证进度
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            CertificationProgressResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await CertificationProgress.filter(
            tenant_id=tenant_id,
            progress_no=data.progress_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"进度编号 {data.progress_no} 已存在")
        
        # 创建对象
        obj = await CertificationProgress.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CertificationProgressResponse.model_validate(obj)
    
    @staticmethod
    async def get_certificationprogress_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> CertificationProgressResponse:
        """
        根据UUID获取认证进度
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            CertificationProgressResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证进度 {obj_uuid} 不存在")
        
        return CertificationProgressResponse.model_validate(obj)
    
    @staticmethod
    async def list_certificationprogresss(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[CertificationProgressResponse]:
        """
        获取认证进度列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[CertificationProgressResponse]: 对象列表
        """
        query = CertificationProgress.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [CertificationProgressResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_certificationprogress(
        tenant_id: int,
        obj_uuid: str,
        data: CertificationProgressUpdate
    ) -> CertificationProgressResponse:
        """
        更新认证进度
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            CertificationProgressResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证进度 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return CertificationProgressResponse.model_validate(obj)
    
    @staticmethod
    async def delete_certificationprogress(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除认证进度（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await CertificationProgress.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"认证进度 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
