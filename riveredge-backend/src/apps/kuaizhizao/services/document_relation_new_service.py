"""
单据关联服务模块（新实现）

基于DocumentRelation模型提供单据关联关系的创建和查询功能。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.document_relation import DocumentRelation
from apps.kuaizhizao.schemas.document_relation import (
    DocumentRelationCreate,
    DocumentRelationResponse,
    DocumentRelationListResponse,
    DocumentTraceResponse,
    DocumentTraceNode,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class DocumentRelationNewService:
    """单据关联服务（新实现）"""
    
    async def create_relation(
        self,
        tenant_id: int,
        relation_data: DocumentRelationCreate,
        created_by: int
    ) -> DocumentRelationResponse:
        """
        创建单据关联关系
        
        Args:
            tenant_id: 租户ID
            relation_data: 关联关系数据
            created_by: 创建人ID
            
        Returns:
            DocumentRelationResponse: 创建的关联关系响应
        """
        async with in_transaction():
            # 检查关联关系是否已存在
            existing = await DocumentRelation.get_or_none(
                tenant_id=tenant_id,
                source_type=relation_data.source_type,
                source_id=relation_data.source_id,
                target_type=relation_data.target_type,
                target_id=relation_data.target_id,
                deleted_at__isnull=True
            )
            
            if existing:
                raise BusinessLogicError("关联关系已存在")
            
            # 创建关联关系
            relation = await DocumentRelation.create(
                tenant_id=tenant_id,
                source_type=relation_data.source_type,
                source_id=relation_data.source_id,
                source_code=relation_data.source_code,
                source_name=relation_data.source_name,
                target_type=relation_data.target_type,
                target_id=relation_data.target_id,
                target_code=relation_data.target_code,
                target_name=relation_data.target_name,
                relation_type=relation_data.relation_type,
                relation_mode=relation_data.relation_mode,
                relation_desc=relation_data.relation_desc,
                business_mode=relation_data.business_mode,
                demand_id=relation_data.demand_id,
                notes=relation_data.notes,
                created_by=created_by,
            )
            
            return DocumentRelationResponse.model_validate(relation)
    
    async def get_relations(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> DocumentRelationListResponse:
        """
        获取单据的关联关系（上游和下游单据）
        
        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            
        Returns:
            DocumentRelationListResponse: 包含上游和下游单据的响应
        """
        # 查询作为源单据的关联（下游单据）
        downstream_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=document_type,
            source_id=document_id,
            deleted_at__isnull=True
        ).all()
        
        # 查询作为目标单据的关联（上游单据）
        upstream_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type=document_type,
            target_id=document_id,
            deleted_at__isnull=True
        ).all()
        
        return DocumentRelationListResponse(
            upstream=[DocumentRelationResponse.model_validate(r) for r in upstream_relations],
            downstream=[DocumentRelationResponse.model_validate(r) for r in downstream_relations]
        )
    
    async def batch_create_relations(
        self,
        tenant_id: int,
        source_type: str,
        source_id: int,
        source_code: Optional[str],
        source_name: Optional[str],
        target_documents: List[Dict[str, Any]],
        relation_mode: str = "push",
        business_mode: Optional[str] = None,
        demand_id: Optional[int] = None,
        created_by: int = None
    ) -> List[DocumentRelationResponse]:
        """
        批量创建关联关系
        
        Args:
            tenant_id: 租户ID
            source_type: 源单据类型
            source_id: 源单据ID
            source_code: 源单据编码
            source_name: 源单据名称
            target_documents: 目标单据列表（每个元素包含type、id、code、name等）
            relation_mode: 关联方式
            business_mode: 业务模式
            demand_id: 需求ID
            created_by: 创建人ID
            
        Returns:
            List[DocumentRelationResponse]: 创建的关联关系列表
        """
        async with in_transaction():
            relations = []
            
            for target in target_documents:
                try:
                    relation = await DocumentRelation.create(
                        tenant_id=tenant_id,
                        source_type=source_type,
                        source_id=source_id,
                        source_code=source_code,
                        source_name=source_name,
                        target_type=target["type"],
                        target_id=target["id"],
                        target_code=target.get("code"),
                        target_name=target.get("name"),
                        relation_type="source",
                        relation_mode=relation_mode,
                        relation_desc=target.get("desc"),
                        business_mode=business_mode,
                        demand_id=demand_id,
                        notes=target.get("notes"),
                        created_by=created_by,
                    )
                    relations.append(DocumentRelationResponse.model_validate(relation))
                except Exception as e:
                    logger.warning(f"创建关联关系失败: {e}")
                    # 继续处理下一个，不中断批量操作
            
            return relations
    
    async def delete_relation(
        self,
        tenant_id: int,
        relation_id: int
    ) -> None:
        """
        删除关联关系（软删除）
        
        Args:
            tenant_id: 租户ID
            relation_id: 关联关系ID
        """
        relation = await DocumentRelation.get_or_none(
            tenant_id=tenant_id,
            id=relation_id,
            deleted_at__isnull=True
        )
        
        if not relation:
            raise NotFoundError(f"关联关系不存在: {relation_id}")
        
        await relation.soft_delete()
    
    async def get_relation_by_id(
        self,
        tenant_id: int,
        relation_id: int
    ) -> DocumentRelationResponse:
        """
        根据ID获取关联关系
        
        Args:
            tenant_id: 租户ID
            relation_id: 关联关系ID
            
        Returns:
            DocumentRelationResponse: 关联关系响应
        """
        relation = await DocumentRelation.get_or_none(
            tenant_id=tenant_id,
            id=relation_id,
            deleted_at__isnull=True
        )
        
        if not relation:
            raise NotFoundError(f"关联关系不存在: {relation_id}")
        
        return DocumentRelationResponse.model_validate(relation)
