"""
文档版本服务模块

提供文档版本的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.document import DocumentVersion
from apps.kuaioa.schemas.document_version_schemas import (
    DocumentVersionCreate, DocumentVersionUpdate, DocumentVersionResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DocumentVersionService:
    """文档版本服务"""
    
    @staticmethod
    async def create_documentversion(
        tenant_id: int,
        data: DocumentVersionCreate
    ) -> DocumentVersionResponse:
        """
        创建文档版本
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            DocumentVersionResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await DocumentVersion.filter(
            tenant_id=tenant_id,
            version_no=data.version_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"版本编号 {data.version_no} 已存在")
        
        # 创建对象
        obj = await DocumentVersion.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DocumentVersionResponse.model_validate(obj)
    
    @staticmethod
    async def get_documentversion_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> DocumentVersionResponse:
        """
        根据UUID获取文档版本
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            DocumentVersionResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DocumentVersion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档版本 {obj_uuid} 不存在")
        
        return DocumentVersionResponse.model_validate(obj)
    
    @staticmethod
    async def list_documentversions(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[DocumentVersionResponse]:
        """
        获取文档版本列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[DocumentVersionResponse]: 对象列表
        """
        query = DocumentVersion.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [DocumentVersionResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_documentversion(
        tenant_id: int,
        obj_uuid: str,
        data: DocumentVersionUpdate
    ) -> DocumentVersionResponse:
        """
        更新文档版本
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            DocumentVersionResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DocumentVersion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档版本 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return DocumentVersionResponse.model_validate(obj)
    
    @staticmethod
    async def delete_documentversion(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除文档版本（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await DocumentVersion.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档版本 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
