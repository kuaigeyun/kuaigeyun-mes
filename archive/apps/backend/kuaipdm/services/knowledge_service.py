"""
知识管理服务模块

提供知识管理的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaipdm.models.knowledge import Knowledge
from apps.kuaipdm.schemas.knowledge_schemas import (
    KnowledgeCreate, KnowledgeUpdate, KnowledgeResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class KnowledgeService:
    """知识管理服务"""
    
    @staticmethod
    async def create_knowledge(
        tenant_id: int,
        data: KnowledgeCreate,
        author_id: int
    ) -> KnowledgeResponse:
        """
        创建知识
        
        Args:
            tenant_id: 租户ID
            data: 知识创建数据
            author_id: 作者ID
            
        Returns:
            KnowledgeResponse: 创建的知识对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await Knowledge.filter(
            tenant_id=tenant_id,
            knowledge_no=data.knowledge_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"知识编号 {data.knowledge_no} 已存在")
        
        # 创建知识
        knowledge = await Knowledge.create(
            tenant_id=tenant_id,
            author_id=author_id,
            **data.dict()
        )
        
        return KnowledgeResponse.model_validate(knowledge)
    
    @staticmethod
    async def get_knowledge_by_uuid(
        tenant_id: int,
        knowledge_uuid: str
    ) -> KnowledgeResponse:
        """
        根据UUID获取知识
        
        Args:
            tenant_id: 租户ID
            knowledge_uuid: 知识UUID
            
        Returns:
            KnowledgeResponse: 知识对象
            
        Raises:
            NotFoundError: 当知识不存在时抛出
        """
        knowledge = await Knowledge.filter(
            tenant_id=tenant_id,
            uuid=knowledge_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not knowledge:
            raise NotFoundError(f"知识 {knowledge_uuid} 不存在")
        
        # 增加查看次数
        knowledge.view_count += 1
        await knowledge.save()
        
        return KnowledgeResponse.model_validate(knowledge)
    
    @staticmethod
    async def list_knowledges(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        knowledge_type: Optional[str] = None,
        category: Optional[str] = None,
        is_public: Optional[bool] = None
    ) -> List[KnowledgeResponse]:
        """
        获取知识列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            knowledge_type: 知识类型（过滤）
            category: 知识分类（过滤）
            is_public: 是否公开（过滤）
            
        Returns:
            List[KnowledgeResponse]: 知识列表
        """
        query = Knowledge.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if knowledge_type:
            query = query.filter(knowledge_type=knowledge_type)
        if category:
            query = query.filter(category=category)
        if is_public is not None:
            query = query.filter(is_public=is_public)
        
        knowledges = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [KnowledgeResponse.model_validate(knowledge) for knowledge in knowledges]
    
    @staticmethod
    async def update_knowledge(
        tenant_id: int,
        knowledge_uuid: str,
        data: KnowledgeUpdate
    ) -> KnowledgeResponse:
        """
        更新知识
        
        Args:
            tenant_id: 租户ID
            knowledge_uuid: 知识UUID
            data: 知识更新数据
            
        Returns:
            KnowledgeResponse: 更新后的知识对象
            
        Raises:
            NotFoundError: 当知识不存在时抛出
        """
        knowledge = await Knowledge.filter(
            tenant_id=tenant_id,
            uuid=knowledge_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not knowledge:
            raise NotFoundError(f"知识 {knowledge_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(knowledge, key, value)
        
        await knowledge.save()
        
        return KnowledgeResponse.model_validate(knowledge)
    
    @staticmethod
    async def delete_knowledge(
        tenant_id: int,
        knowledge_uuid: str
    ) -> None:
        """
        删除知识（软删除）
        
        Args:
            tenant_id: 租户ID
            knowledge_uuid: 知识UUID
            
        Raises:
            NotFoundError: 当知识不存在时抛出
        """
        knowledge = await Knowledge.filter(
            tenant_id=tenant_id,
            uuid=knowledge_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not knowledge:
            raise NotFoundError(f"知识 {knowledge_uuid} 不存在")
        
        knowledge.deleted_at = datetime.utcnow()
        await knowledge.save()
    
    @staticmethod
    async def like_knowledge(
        tenant_id: int,
        knowledge_uuid: str
    ) -> KnowledgeResponse:
        """
        点赞知识
        
        Args:
            tenant_id: 租户ID
            knowledge_uuid: 知识UUID
            
        Returns:
            KnowledgeResponse: 更新后的知识对象
            
        Raises:
            NotFoundError: 当知识不存在时抛出
        """
        knowledge = await Knowledge.filter(
            tenant_id=tenant_id,
            uuid=knowledge_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not knowledge:
            raise NotFoundError(f"知识 {knowledge_uuid} 不存在")
        
        knowledge.like_count += 1
        await knowledge.save()
        
        return KnowledgeResponse.model_validate(knowledge)
