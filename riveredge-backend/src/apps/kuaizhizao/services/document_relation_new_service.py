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
    
    async def trace_document_chain(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        direction: str = "both",
        max_depth: int = 10
    ) -> DocumentTraceResponse:
        """
        追溯单据关联链（完整追溯）
        
        支持向上追溯（查找所有上游单据）和向下追溯（查找所有下游单据），
        自动避免循环引用。
        
        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            direction: 追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）
            max_depth: 最大追溯深度（防止无限递归）
            
        Returns:
            DocumentTraceResponse: 完整的追溯链
        """
        # 获取根单据信息
        root_code, root_name = await self._get_document_info(tenant_id, document_type, document_id)
        
        # 初始化追溯结果
        upstream_chain: List[DocumentTraceNode] = []
        downstream_chain: List[DocumentTraceNode] = []
        
        # 用于避免循环引用的集合
        visited_upstream = set()
        visited_downstream = set()
        
        if direction in ["upstream", "both"]:
            # 向上追溯
            upstream_chain = await self._trace_upstream_recursive(
                tenant_id=tenant_id,
                document_type=document_type,
                document_id=document_id,
                level=0,
                max_depth=max_depth,
                visited=visited_upstream
            )
        
        if direction in ["downstream", "both"]:
            # 向下追溯
            downstream_chain = await self._trace_downstream_recursive(
                tenant_id=tenant_id,
                document_type=document_type,
                document_id=document_id,
                level=0,
                max_depth=max_depth,
                visited=visited_downstream
            )
        
        return DocumentTraceResponse(
            document_type=document_type,
            document_id=document_id,
            document_code=root_code,
            document_name=root_name,
            upstream_chain=upstream_chain,
            downstream_chain=downstream_chain
        )
    
    async def _trace_upstream_recursive(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        level: int,
        max_depth: int,
        visited: set
    ) -> List[DocumentTraceNode]:
        """递归向上追溯"""
        if level >= max_depth:
            return []
        
        # 检查是否已访问过（避免循环引用）
        key = f"{document_type}:{document_id}"
        if key in visited:
            return []
        visited.add(key)
        
        # 查询作为目标单据的关联（上游单据是source）
        upstream_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type=document_type,
            target_id=document_id,
            deleted_at__isnull=True
        ).all()
        
        nodes: List[DocumentTraceNode] = []
        
        for relation in upstream_relations:
            # 递归追溯上游单据的上游
            children = await self._trace_upstream_recursive(
                tenant_id=tenant_id,
                document_type=relation.source_type,
                document_id=relation.source_id,
                level=level + 1,
                max_depth=max_depth,
                visited=visited
            )
            
            node = DocumentTraceNode(
                document_type=relation.source_type,
                document_id=relation.source_id,
                document_code=relation.source_code,
                document_name=relation.source_name,
                level=level + 1,
                children=children
            )
            nodes.append(node)
        
        return nodes
    
    async def _trace_downstream_recursive(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        level: int,
        max_depth: int,
        visited: set
    ) -> List[DocumentTraceNode]:
        """递归向下追溯"""
        if level >= max_depth:
            return []
        
        # 检查是否已访问过（避免循环引用）
        key = f"{document_type}:{document_id}"
        if key in visited:
            return []
        visited.add(key)
        
        # 查询作为源单据的关联（下游单据是target）
        downstream_relations = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=document_type,
            source_id=document_id,
            deleted_at__isnull=True
        ).all()
        
        nodes: List[DocumentTraceNode] = []
        
        for relation in downstream_relations:
            # 递归追溯下游单据的下游
            children = await self._trace_downstream_recursive(
                tenant_id=tenant_id,
                document_type=relation.target_type,
                document_id=relation.target_id,
                level=level + 1,
                max_depth=max_depth,
                visited=visited
            )
            
            node = DocumentTraceNode(
                document_type=relation.target_type,
                document_id=relation.target_id,
                document_code=relation.target_code,
                document_name=relation.target_name,
                level=level + 1,
                children=children
            )
            nodes.append(node)
        
        return nodes
    
    async def _get_document_info(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> tuple[Optional[str], Optional[str]]:
        """获取单据基本信息（编码和名称）"""
        # 这里可以根据不同的单据类型查询对应的模型
        # 为了简化，暂时返回None，实际使用时可以根据需要实现
        # 或者从关联关系中获取（如果有的话）
        return None, None