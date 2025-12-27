"""
文档服务模块

提供文档的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaioa.models.document import Document
from apps.kuaioa.schemas.document_schemas import (
    DocumentCreate, DocumentUpdate, DocumentResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DocumentService:
    """文档服务"""
    
    @staticmethod
    async def create_document(
        tenant_id: int,
        data: DocumentCreate
    ) -> DocumentResponse:
        """
        创建文档
        
        Args:
            tenant_id: 租户ID
            data: 创建数据
            
        Returns:
            DocumentResponse: 创建的对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Document.filter(
            tenant_id=tenant_id,
            document_no=data.document_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"文档编号 {data.document_no} 已存在")
        
        # 创建对象
        obj = await Document.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DocumentResponse.model_validate(obj)
    
    @staticmethod
    async def get_document_by_uuid(
        tenant_id: int,
        obj_uuid: str
    ) -> DocumentResponse:
        """
        根据UUID获取文档
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Returns:
            DocumentResponse: 对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Document.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档 {obj_uuid} 不存在")
        
        return DocumentResponse.model_validate(obj)
    
    @staticmethod
    async def list_documents(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None
    ) -> List[DocumentResponse]:
        """
        获取文档列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 状态（过滤）
            
        Returns:
            List[DocumentResponse]: 对象列表
        """
        query = Document.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        objs = await query.offset(skip).limit(limit).all()
        return [DocumentResponse.model_validate(obj) for obj in objs]
    
    @staticmethod
    async def update_document(
        tenant_id: int,
        obj_uuid: str,
        data: DocumentUpdate
    ) -> DocumentResponse:
        """
        更新文档
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            data: 更新数据
            
        Returns:
            DocumentResponse: 更新后的对象
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Document.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档 {obj_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(obj, key, value)
        
        await obj.save()
        return DocumentResponse.model_validate(obj)
    
    @staticmethod
    async def delete_document(
        tenant_id: int,
        obj_uuid: str
    ) -> None:
        """
        删除文档（软删除）
        
        Args:
            tenant_id: 租户ID
            obj_uuid: 对象UUID
            
        Raises:
            NotFoundError: 当对象不存在时抛出
        """
        obj = await Document.filter(
            tenant_id=tenant_id,
            uuid=obj_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not obj:
            raise NotFoundError(f"文档 {obj_uuid} 不存在")
        
        from datetime import datetime
        obj.deleted_at = datetime.now()
        await obj.save()
