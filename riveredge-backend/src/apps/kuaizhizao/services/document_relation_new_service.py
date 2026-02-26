"""
单据关联服务模块（新实现）

基于DocumentRelation模型提供单据关联关系的创建和查询功能。
合并业务推导逻辑（DocumentRelationService），表驱动优先，推导结果补充。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Dict, Any, Optional, Tuple
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


# 变更影响相关类型（demand/computation/plan/work_order）的 status 字段映射
_CHANGE_IMPACT_STATUS_FIELDS = {
    "demand": "status",
    "demand_computation": "computation_status",
    "production_plan": "plan_status",  # 或 status
    "work_order": "status",
}


def _relation_key(source_type: str, source_id: int, target_type: str, target_id: int) -> Tuple:
    """关联关系去重键"""
    return (source_type, source_id, target_type, target_id)


def _derived_to_response(
    doc: Dict[str, Any],
    document_type: str,
    document_id: int,
    tenant_id: int,
    is_upstream: bool,
) -> DocumentRelationResponse:
    """将业务推导的单据引用转为 DocumentRelationResponse（derived 模式）"""
    doc_type = doc.get("document_type", "")
    doc_id = doc.get("document_id", 0)
    doc_code = doc.get("document_code")
    doc_name = doc.get("name") or doc.get("document_name")
    created = doc.get("created_at")
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except Exception:
            created = datetime.now()
    created = created or datetime.now()

    if is_upstream:
        source_type, source_id = doc_type, doc_id
        target_type, target_id = document_type, document_id
        source_code, source_name = doc_code, doc_name
        target_code, target_name = None, None
    else:
        source_type, source_id = document_type, document_id
        target_type, target_id = doc_type, doc_id
        source_code, source_name = None, None
        target_code, target_name = doc_code, doc_name

    return DocumentRelationResponse.model_validate({
        "source_type": source_type,
        "source_id": source_id,
        "source_code": source_code,
        "source_name": source_name,
        "target_type": target_type,
        "target_id": target_id,
        "target_code": target_code,
        "target_name": target_name,
        "relation_type": "source",
        "relation_mode": "derived",
        "relation_desc": f"业务推导关联（{source_type} -> {target_type}）",
        "business_mode": None,
        "demand_id": None,
        "notes": None,
        "id": 0,
        "uuid": f"derived-{source_type}-{source_id}-{target_type}-{target_id}",
        "tenant_id": tenant_id,
        "created_at": created,
        "updated_at": created,
        "created_by": None,
    })


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

        合并策略：表驱动（DocumentRelation）优先，业务推导（DocumentRelationService）补充，
        按 (source_type, source_id, target_type, target_id) 去重，表记录优先。
        
        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            
        Returns:
            DocumentRelationListResponse: 包含上游和下游单据的响应
        """
        # 1. 查询 DocumentRelation 表
        downstream_table = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type=document_type,
            source_id=document_id,
        ).all()
        upstream_table = await DocumentRelation.filter(
            tenant_id=tenant_id,
            target_type=document_type,
            target_id=document_id,
        ).all()

        upstream_responses = [DocumentRelationResponse.model_validate(r) for r in upstream_table]
        downstream_responses = [DocumentRelationResponse.model_validate(r) for r in downstream_table]
        table_upstream_keys = {_relation_key(r.source_type, r.source_id, r.target_type, r.target_id) for r in upstream_responses}
        table_downstream_keys = {_relation_key(r.source_type, r.source_id, r.target_type, r.target_id) for r in downstream_responses}

        # 2. 若单据类型在旧服务支持范围内，获取业务推导关联并合并
        try:
            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            if document_type in DocumentRelationService.DOCUMENT_TYPES:
                legacy_result = await DocumentRelationService().get_document_relations(
                    tenant_id=tenant_id,
                    document_type=document_type,
                    document_id=document_id,
                )
                for doc in legacy_result.get("upstream_documents", []):
                    key = _relation_key(
                        doc.get("document_type", ""),
                        doc.get("document_id", 0),
                        document_type,
                        document_id,
                    )
                    if key not in table_upstream_keys:
                        table_upstream_keys.add(key)
                        upstream_responses.append(_derived_to_response(
                            doc, document_type, document_id, tenant_id, is_upstream=True
                        ))
                for doc in legacy_result.get("downstream_documents", []):
                    key = _relation_key(
                        document_type,
                        document_id,
                        doc.get("document_type", ""),
                        doc.get("document_id", 0),
                    )
                    if key not in table_downstream_keys:
                        table_downstream_keys.add(key)
                        downstream_responses.append(_derived_to_response(
                            doc, document_type, document_id, tenant_id, is_upstream=False
                        ))
        except Exception as e:
            logger.warning(f"业务推导关联获取失败，仅返回表驱动结果: {e}")

        return DocumentRelationListResponse(
            upstream=upstream_responses,
            downstream=downstream_responses,
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
        )
        
        if not relation:
            raise NotFoundError(f"关联关系不存在: {relation_id}")
        
        await relation.delete()
    
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
        """递归向上追溯（使用合并后的 get_relations，含表驱动+业务推导）"""
        if level >= max_depth:
            return []
        
        key = f"{document_type}:{document_id}"
        if key in visited:
            return []
        visited.add(key)
        
        result = await self.get_relations(tenant_id, document_type, document_id)
        nodes: List[DocumentTraceNode] = []
        
        for rel in result.upstream:
            children = await self._trace_upstream_recursive(
                tenant_id=tenant_id,
                document_type=rel.source_type,
                document_id=rel.source_id,
                level=level + 1,
                max_depth=max_depth,
                visited=visited
            )
            nodes.append(DocumentTraceNode(
                document_type=rel.source_type,
                document_id=rel.source_id,
                document_code=rel.source_code,
                document_name=rel.source_name,
                level=level + 1,
                children=children
            ))
        
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
        """递归向下追溯（使用合并后的 get_relations，含表驱动+业务推导）"""
        if level >= max_depth:
            return []
        
        key = f"{document_type}:{document_id}"
        if key in visited:
            return []
        visited.add(key)
        
        result = await self.get_relations(tenant_id, document_type, document_id)
        nodes: List[DocumentTraceNode] = []
        
        for rel in result.downstream:
            children = await self._trace_downstream_recursive(
                tenant_id=tenant_id,
                document_type=rel.target_type,
                document_id=rel.target_id,
                level=level + 1,
                max_depth=max_depth,
                visited=visited
            )
            nodes.append(DocumentTraceNode(
                document_type=rel.target_type,
                document_id=rel.target_id,
                document_code=rel.target_code,
                document_name=rel.target_name,
                level=level + 1,
                children=children
            ))
        
        return nodes
    
    async def _get_document_info(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> tuple[Optional[str], Optional[str]]:
        """获取单据基本信息（编码和名称）"""
        try:
            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            if document_type not in DocumentRelationService.DOCUMENT_TYPES:
                return None, None
            cfg = DocumentRelationService.DOCUMENT_TYPES[document_type]
            model = cfg["model"]
            code_field = cfg["code_field"]
            name_field = cfg.get("name_field")
            doc = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not doc:
                return None, None
            code = getattr(doc, code_field, None)
            name = getattr(doc, name_field, None) if name_field else None
            return str(code) if code else None, str(name) if name else str(code) if code else None
        except Exception as e:
            logger.debug(f"获取单据信息失败 {document_type}#{document_id}: {e}")
            return None, None

    def _flatten_downstream_nodes(
        self,
        nodes: List[DocumentTraceNode],
        collected: Optional[Dict[Tuple[str, int], Dict[str, Any]]] = None,
    ) -> Dict[Tuple[str, int], Dict[str, Any]]:
        """扁平化下游追溯树，收集所有 (document_type, document_id) 及 code/name/status"""
        if collected is None:
            collected = {}
        for node in nodes:
            key = (node.document_type, node.document_id)
            if key not in collected:
                collected[key] = {
                    "document_type": node.document_type,
                    "document_id": node.document_id,
                    "document_code": node.document_code,
                    "document_name": node.document_name,
                }
            self._flatten_downstream_nodes(node.children, collected)
        return collected

    async def _get_document_status(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
    ) -> Optional[str]:
        """获取单据状态"""
        try:
            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            if document_type not in DocumentRelationService.DOCUMENT_TYPES:
                return None
            cfg = DocumentRelationService.DOCUMENT_TYPES[document_type]
            model = cfg["model"]
            doc = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not doc:
                return None
            status_field = _CHANGE_IMPACT_STATUS_FIELDS.get(
                document_type,
                "plan_status" if document_type == "production_plan" else "status",
            )
            if document_type == "production_plan":
                val = getattr(doc, "plan_status", None) or getattr(doc, "status", None)
            else:
                val = getattr(doc, status_field, None)
            return str(val) if val else None
        except Exception:
            return None

    async def get_change_impact_demand(
        self,
        tenant_id: int,
        demand_id: int,
    ) -> Dict[str, Any]:
        """
        获取需求变更对下游的影响范围（与 trace 使用相同数据源 get_relations）
        """
        from apps.kuaizhizao.models.demand import Demand

        demand = await Demand.get_or_none(tenant_id=tenant_id, id=demand_id, deleted_at__isnull=True)
        if not demand:
            raise NotFoundError(f"需求不存在: {demand_id}")

        upstream_change = {
            "type": "demand",
            "id": demand.id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "changed_at": demand.updated_at.isoformat() if demand.updated_at else None,
        }

        trace = await self.trace_document_chain(
            tenant_id=tenant_id,
            document_type="demand",
            document_id=demand_id,
            direction="downstream",
            max_depth=10,
        )
        collected = self._flatten_downstream_nodes(trace.downstream_chain)

        # 需求本身作为受影响项
        demand_status = await self._get_document_status(tenant_id, "demand", demand_id)
        affected_demands = [{
            "id": demand_id,
            "code": getattr(demand, "demand_code", None),
            "name": getattr(demand, "demand_name", None),
            "status": demand_status,
        }]

        affected_computations = []
        affected_plans = []
        affected_work_orders = []

        for (doc_type, doc_id), info in collected.items():
            status = await self._get_document_status(tenant_id, doc_type, doc_id)
            item = {
                "id": doc_id,
                "code": info.get("document_code"),
                "name": info.get("document_name"),
                "status": status,
            }
            if doc_type == "demand":
                if doc_id != demand_id:
                    affected_demands.append(item)
            elif doc_type == "demand_computation":
                affected_computations.append(item)
            elif doc_type == "production_plan":
                affected_plans.append(item)
            elif doc_type == "work_order":
                affected_work_orders.append(item)

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_plans or affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def get_change_impact_sales_order(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        """
        获取销售订单变更对下游的影响范围（与 trace 使用相同数据源 get_relations）
        """
        from apps.kuaizhizao.models.sales_order import SalesOrder

        order = await SalesOrder.get_or_none(tenant_id=tenant_id, id=order_id, deleted_at__isnull=True)
        if not order:
            raise NotFoundError(f"销售订单不存在: {order_id}")

        upstream_change = {
            "type": "sales_order",
            "id": order.id,
            "code": getattr(order, "order_code", None),
            "name": getattr(order, "order_name", None),
            "changed_at": order.updated_at.isoformat() if order.updated_at else None,
        }

        trace = await self.trace_document_chain(
            tenant_id=tenant_id,
            document_type="sales_order",
            document_id=order_id,
            direction="downstream",
            max_depth=10,
        )
        collected = self._flatten_downstream_nodes(trace.downstream_chain)

        affected_demands = []
        affected_computations = []
        affected_plans = []
        affected_work_orders = []

        for (doc_type, doc_id), info in collected.items():
            status = await self._get_document_status(tenant_id, doc_type, doc_id)
            item = {
                "id": doc_id,
                "code": info.get("document_code"),
                "name": info.get("document_name"),
                "status": status,
            }
            if doc_type == "demand":
                affected_demands.append(item)
            elif doc_type == "demand_computation":
                affected_computations.append(item)
            elif doc_type == "production_plan":
                affected_plans.append(item)
            elif doc_type == "work_order":
                affected_work_orders.append(item)

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_plans or affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }