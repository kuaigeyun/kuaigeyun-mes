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
from apps.kuaizhizao.models.demand import Demand
from apps.kuaizhizao.schemas.document_relation import (
    DocumentRelationCreate,
    DocumentRelationResponse,
    DocumentRelationListResponse,
    DocumentTraceResponse,
    DocumentTraceNode,
    DocumentTraceReportingEntry,
)
from apps.common.audit_actor import audit_response_fields
from core.utils.timezone_utils import resolve_business_datetime, to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


# 变更影响相关类型（demand/computation/plan/work_order）的 status 字段映射
_CHANGE_IMPACT_STATUS_FIELDS = {
    "demand": "status",
    "demand_computation": "computation_status",
    "work_order": "status",
}


def _relation_key(source_type: str, source_id: int, target_type: str, target_id: int) -> Tuple:
    """关联关系去重键"""
    return (source_type, source_id, target_type, target_id)


# 与 DocumentRelationResponse 中 code/name 字段长度上限一致，防止校验失败导致整批推导关联被丢弃
_DERIVED_DOC_CODE_MAX_LEN = 50
_DERIVED_DOC_NAME_MAX_LEN = 200


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
    if doc_code is not None:
        doc_code = str(doc_code)[:_DERIVED_DOC_CODE_MAX_LEN]
    doc_name = doc.get("name") or doc.get("document_name")
    if doc_name is not None:
        doc_name = str(doc_name)[:_DERIVED_DOC_NAME_MAX_LEN]
    created = doc.get("created_at")
    if isinstance(created, str):
        try:
            created = datetime.fromisoformat(created.replace("Z", "+00:00"))
        except Exception:
            created = resolve_business_datetime()
    created = created or resolve_business_datetime()

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
        **audit_response_fields(doc),
    })


class DocumentRelationNewService:
    """单据关联服务（新实现）"""

    async def relation_exists(
        self,
        tenant_id: int,
        *,
        source_type: str,
        source_id: int,
        target_type: str,
        target_id: int | None = None,
    ) -> bool:
        """DocumentRelation 无软删除字段，禁止传 deleted_at 过滤。"""
        filters: dict[str, int | str] = {
            "tenant_id": tenant_id,
            "source_type": source_type,
            "source_id": source_id,
            "target_type": target_type,
        }
        if target_id is not None:
            filters["target_id"] = target_id
        return await DocumentRelation.filter(**filters).exists()

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
        if document_type == "reporting_timeline":
            return DocumentRelationListResponse(upstream=[], downstream=[])

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
                    if key in table_upstream_keys:
                        continue
                    try:
                        upstream_responses.append(_derived_to_response(
                            doc, document_type, document_id, tenant_id, is_upstream=True
                        ))
                        table_upstream_keys.add(key)
                    except Exception as ex:
                        logger.warning(
                            "跳过无效业务推导上游关联 {}:{} -> {}:{} — {}",
                            doc.get("document_type"),
                            doc.get("document_id"),
                            document_type,
                            document_id,
                            ex,
                        )
                for doc in legacy_result.get("downstream_documents", []):
                    key = _relation_key(
                        document_type,
                        document_id,
                        doc.get("document_type", ""),
                        doc.get("document_id", 0),
                    )
                    if key in table_downstream_keys:
                        continue
                    try:
                        downstream_responses.append(_derived_to_response(
                            doc, document_type, document_id, tenant_id, is_upstream=False
                        ))
                        table_downstream_keys.add(key)
                    except Exception as ex:
                        logger.warning(
                            "跳过无效业务推导下游关联 {}:{} -> {}:{} — {}",
                            document_type,
                            document_id,
                            doc.get("document_type"),
                            doc.get("document_id"),
                            ex,
                        )
        except Exception as e:
            logger.warning(f"业务推导关联获取失败，仅返回表驱动结果: {e}")

        # 兼容历史库：旧版曾写入 DocumentRelation(sales_order/sales_forecast→demand)；
        # 现链路以「销售订单/销售预测 -> 需求计算」为准，需隐藏中间 demand 节点。
        if document_type in {"sales_order", "sales_forecast"}:
            downstream_responses = [
                r for r in downstream_responses if r.target_type != "demand"
            ]

            # 若工单是由「需求计算」下推生成，则不应再展示为
            # sales_order/sales_forecast -> work_order 的直连边，避免链路“跨层短路”。
            computation_ids = {
                int(r.target_id)
                for r in downstream_responses
                if r.target_type == "demand_computation" and r.target_id
            }
            work_order_ids = {
                int(r.target_id)
                for r in downstream_responses
                if r.target_type == "work_order" and r.target_id
            }
            if computation_ids and work_order_ids:
                comp_to_wo_rows = await DocumentRelation.filter(
                    tenant_id=tenant_id,
                    source_type="demand_computation",
                    source_id__in=list(computation_ids),
                    target_type="work_order",
                    target_id__in=list(work_order_ids),
                ).values("target_id")
                wo_from_computation_ids = {int(row.get("target_id")) for row in comp_to_wo_rows if row.get("target_id")}
                if wo_from_computation_ids:
                    downstream_responses = [
                        r for r in downstream_responses
                        if not (
                            r.target_type == "work_order"
                            and int(r.target_id or 0) in wo_from_computation_ids
                        )
                    ]

        # 兼容历史库：旧版曾写入 DocumentRelation(demand→demand_computation)。
        # 若该 demand 实际来自销售订单/销售预测，则在全链路中隐藏 demand 节点，展示真实直连链路：
        # sales_order/sales_forecast -> demand_computation
        if document_type == "demand_computation":
            demand_upstream_ids = {
                int(r.source_id)
                for r in upstream_responses
                if r.source_type == "demand" and r.source_id
            }
            if demand_upstream_ids:
                demand_rows = await Demand.filter(
                    tenant_id=tenant_id,
                    id__in=list(demand_upstream_ids),
                ).values("id", "demand_type", "source_type")
                hide_demand_ids = set()
                for row in demand_rows:
                    dt = str(row.get("demand_type") or "").strip()
                    st = str(row.get("source_type") or "").strip()
                    if dt in {"sales_order", "sales_forecast"} or st in {"sales_order", "sales_forecast"}:
                        hide_demand_ids.add(int(row.get("id")))
                if hide_demand_ids:
                    upstream_responses = [
                        r
                        for r in upstream_responses
                        if not (r.source_type == "demand" and int(r.source_id or 0) in hide_demand_ids)
                    ]

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
        root_code, root_name, root_created_at = await self._get_document_info(tenant_id, document_type, document_id)
        
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

        if direction in ["upstream", "both"]:
            upstream_chain = await self._apply_work_order_reporting_timeline(tenant_id, upstream_chain)
        if direction in ["downstream", "both"]:
            downstream_chain = await self._apply_work_order_reporting_timeline(tenant_id, downstream_chain)

        return DocumentTraceResponse(
            document_type=document_type,
            document_id=document_id,
            document_code=root_code,
            document_name=root_name,
            created_at=root_created_at,
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
                created_at=rel.created_at,
                level=level + 1,
                is_deleted=await self._resolve_trace_node_deleted(
                    tenant_id,
                    rel.source_type,
                    rel.source_id,
                    rel.source_code,
                    rel.created_at,
                ),
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
                created_at=rel.created_at,
                level=level + 1,
                is_deleted=await self._resolve_trace_node_deleted(
                    tenant_id,
                    rel.target_type,
                    rel.target_id,
                    rel.target_code,
                    rel.created_at,
                ),
                children=children
            ))
        
        return nodes

    async def _apply_work_order_reporting_timeline(
        self,
        tenant_id: int,
        nodes: List[DocumentTraceNode],
    ) -> List[DocumentTraceNode]:
        """将工单下多条报工合并为 reporting_timeline 节点，并从 DB 补全报工列表（全链路展示）。"""
        return [await self._transform_reporting_timeline_node(tenant_id, n) for n in nodes]

    async def _transform_reporting_timeline_node(
        self,
        tenant_id: int,
        node: DocumentTraceNode,
    ) -> DocumentTraceNode:
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        from apps.kuaizhizao.services.document_relation_service import DocumentRelationService

        new_children = [await self._transform_reporting_timeline_node(tenant_id, c) for c in node.children]
        base = node.model_copy(update={"children": new_children})

        if base.document_type != "work_order":
            return base

        wo_id = base.document_id
        records = list(
            await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=wo_id,
                deleted_at__isnull=True,
            )
            .order_by("operation_id", "id")
            .limit(DocumentRelationService.REPORTING_RECORD_TRACE_LIMIT)
        )

        filtered = [c for c in base.children if c.document_type != "reporting_record"]
        filtered2: List[DocumentTraceNode] = []
        for c in filtered:
            if c.document_type == "production_picking":
                pr_children = [x for x in c.children if x.document_type != "reporting_record"]
                filtered2.append(c.model_copy(update={"children": pr_children}))
            else:
                filtered2.append(c)

        receipt_types = {"semi_finished_goods_receipt", "finished_goods_receipt"}
        has_receipt = any(c.document_type in receipt_types for c in filtered2)

        if not records and not has_receipt:
            return base.model_copy(update={"children": filtered2})

        entries = [
            DocumentTraceReportingEntry(
                document_id=r.id,
                document_code=DocumentRelationService._reporting_record_trace_dict(r)["document_code"],
                document_name=(r.operation_name or "").strip() or None,
                created_at=r.created_at,
                status=r.status if hasattr(r, "status") else None,
            )
            for r in records
        ]
        n_entries = len(entries)
        doc_code = f"{n_entries}条报工" if n_entries else "暂无报工"
        synth_created = entries[0].created_at if entries else base.created_at

        synth = DocumentTraceNode(
            document_type="reporting_timeline",
            document_id=-wo_id,
            document_code=doc_code,
            document_name=None,
            created_at=synth_created,
            level=base.level + 1,
            children=[],
            reporting_timeline=entries,
        )

        idx = next((i for i, c in enumerate(filtered2) if c.document_type in receipt_types), len(filtered2))
        merged_children = filtered2[:idx] + [synth] + filtered2[idx:]
        return base.model_copy(update={"children": merged_children})
    
    async def _resolve_trace_node_deleted(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        document_code: Optional[str] = None,
        relation_created_at: Optional[datetime] = None,
    ) -> bool:
        """追溯节点是否已删除（与单据跟踪上下游 flags 一致）。"""
        if document_type == "reporting_timeline":
            return False
        from core.services.document_tracking_service import DocumentTrackingService

        flags = await DocumentTrackingService()._resolve_relation_flags(
            tenant_id=tenant_id,
            relation_type=document_type,
            relation_id=document_id,
            relation_created_at=relation_created_at,
            relation_code=document_code,
        )
        return bool(flags.get("is_deleted"))

    async def _get_document_info(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int
    ) -> tuple[Optional[str], Optional[str], Optional[datetime]]:
        """获取单据基本信息（编码、名称、创建时间）"""
        try:
            if document_type == "reporting_timeline":
                wo_id = -int(document_id)
                if wo_id <= 0:
                    return None, None, None
                wcode, wname, _ = await self._get_document_info(tenant_id, "work_order", wo_id)
                return ("报工汇总", wname or wcode, None)

            from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
            if document_type not in DocumentRelationService.DOCUMENT_TYPES:
                return None, None, None
            cfg = DocumentRelationService.DOCUMENT_TYPES[document_type]
            model = cfg["model"]
            code_field = cfg["code_field"]
            name_field = cfg.get("name_field")
            if document_type == "sales_invoice":
                doc = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, category="OUT"
                )
            elif document_type in ("receipt", "payment", "purchase_invoice"):
                doc = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
                )
            else:
                doc = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not doc:
                return None, None, None
            code = getattr(doc, code_field, None)
            name = getattr(doc, name_field, None) if name_field else None
            created_at = getattr(doc, "created_at", None)
            return (
                str(code) if code else None,
                str(name) if name else str(code) if code else None,
                created_at,
            )
        except Exception as e:
            logger.debug(f"获取单据信息失败 {document_type}#{document_id}: {e}")
            return None, None, None

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
            if document_type == "sales_invoice":
                doc = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, category="OUT"
                )
            elif document_type in ("receipt", "payment", "purchase_invoice"):
                doc = await model.get_or_none(
                    tenant_id=tenant_id, id=document_id, deleted_at__isnull=True
                )
            else:
                doc = await model.get_or_none(tenant_id=tenant_id, id=document_id)
            if not doc:
                return None
            status_field = _CHANGE_IMPACT_STATUS_FIELDS.get(document_type, "status")
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
            "changed_at": to_api_isoformat(demand.updated_at) if demand.updated_at else None,
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
            elif doc_type == "work_order":
                affected_work_orders.append(item)

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_work_orders:
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
            "changed_at": to_api_isoformat(order.updated_at) if order.updated_at else None,
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
            elif doc_type == "work_order":
                affected_work_orders.append(item)

        recommended_actions = []
        if affected_computations:
            recommended_actions.append("重算需求计算")
        if affected_work_orders:
            recommended_actions.append("重新排程")

        return {
            "upstream_change": upstream_change,
            "affected_demands": affected_demands,
            "affected_computations": affected_computations,
            "affected_plans": affected_plans,
            "affected_work_orders": affected_work_orders,
            "recommended_actions": recommended_actions,
        }

    async def get_change_impact_purchase_order(
        self,
        tenant_id: int,
        order_id: int,
    ) -> Dict[str, Any]:
        """采购订单变更对下游的影响范围"""
        from apps.kuaizhizao.models.purchase_order import PurchaseOrder

        order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=order_id)
        if not order:
            raise NotFoundError(f"采购订单不存在: {order_id}")

        upstream_change = {
            "type": "purchase_order",
            "id": order.id,
            "code": getattr(order, "order_code", None),
            "changed_at": to_api_isoformat(order.updated_at) if order.updated_at else None,
        }

        trace = await self.trace_document_chain(
            tenant_id=tenant_id,
            document_type="purchase_order",
            document_id=order_id,
            direction="downstream",
            max_depth=10,
        )
        collected = self._flatten_downstream_nodes(trace.downstream_chain)

        affected_receipt_notices = []
        affected_inbounds = []
        for (doc_type, doc_id), info in collected.items():
            status = await self._get_document_status(tenant_id, doc_type, doc_id)
            item = {
                "id": doc_id,
                "code": info.get("document_code"),
                "name": info.get("document_name"),
                "status": status,
            }
            if doc_type == "receipt_notice":
                affected_receipt_notices.append(item)
            elif doc_type in ("purchase_receipt", "inbound"):
                affected_inbounds.append(item)

        recommended_actions = []
        if affected_receipt_notices:
            recommended_actions.append("核对收货通知数量")
        if affected_inbounds:
            recommended_actions.append("核对在途入库单")

        return {
            "upstream_change": upstream_change,
            "affected_receipt_notices": affected_receipt_notices,
            "affected_inbounds": affected_inbounds,
            "recommended_actions": recommended_actions,
        }