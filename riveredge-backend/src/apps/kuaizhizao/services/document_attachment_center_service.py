"""
单据附件中心：聚合本单 + 全链路关联单据 attachments JSON。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set, Tuple

from apps.kuaizhizao.schemas.document_relation import (
    DocumentAttachmentCenterGroup,
    DocumentAttachmentCenterItem,
    DocumentAttachmentCenterResponse,
    DocumentTraceNode,
    DocumentTraceResponse,
)
from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
from apps.kuaizhizao.utils.sales_order_attachment_carry import normalize_attachment_entry
from infra.exceptions.exceptions import NotFoundError, ValidationError


def _flatten_trace_nodes(nodes: List[DocumentTraceNode]) -> List[Dict[str, Any]]:
    collected: List[Dict[str, Any]] = []

    def walk(node: DocumentTraceNode) -> None:
        if node.document_type and node.document_id:
            collected.append(
                {
                    "document_type": node.document_type,
                    "document_id": node.document_id,
                    "document_code": node.document_code,
                }
            )
        for child in node.children or []:
            walk(child)

    for item in nodes:
        walk(item)
    return collected


def _dedupe_chain_documents(
    *,
    root_type: str,
    root_id: int,
    root_code: Optional[str],
    related: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    seen: Set[Tuple[str, int]] = set()
    ordered: List[Dict[str, Any]] = []

    def push(doc_type: str, doc_id: int, doc_code: Optional[str], is_self: bool) -> None:
        key = (doc_type, doc_id)
        if key in seen:
            return
        seen.add(key)
        ordered.append(
            {
                "document_type": doc_type,
                "document_id": doc_id,
                "document_code": doc_code,
                "is_self": is_self,
            }
        )

    push(root_type, root_id, root_code, True)
    for item in related:
        push(
            str(item["document_type"]),
            int(item["document_id"]),
            item.get("document_code"),
            False,
        )
    return ordered


def _model_has_attachments(model: Any) -> bool:
    fields_map = getattr(getattr(model, "_meta", None), "fields_map", None)
    return isinstance(fields_map, dict) and "attachments" in fields_map


def _normalize_attachments(raw: Any) -> List[DocumentAttachmentCenterItem]:
    if not raw:
        return []
    if not isinstance(raw, list):
        return []
    items: List[DocumentAttachmentCenterItem] = []
    for entry in raw:
        normalized = normalize_attachment_entry(entry)
        if not normalized:
            continue
        items.append(
            DocumentAttachmentCenterItem(
                uid=str(normalized["uid"]),
                name=str(normalized.get("name") or "附件"),
                status=str(normalized.get("status") or "done"),
            )
        )
    return items


class DocumentAttachmentCenterService:
    """全链路附件聚合"""

    async def get_attachment_center(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        *,
        max_depth: int = 10,
    ) -> DocumentAttachmentCenterResponse:
        if document_type not in DocumentRelationService.DOCUMENT_TYPES:
            raise ValidationError(f"不支持的单据类型: {document_type}")

        trace_service = DocumentRelationNewService()
        trace: DocumentTraceResponse = await trace_service.trace_document_chain(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            direction="both",
            max_depth=max_depth,
        )

        related = _flatten_trace_nodes(list(trace.upstream_chain or []))
        related.extend(_flatten_trace_nodes(list(trace.downstream_chain or [])))
        documents = _dedupe_chain_documents(
            root_type=document_type,
            root_id=document_id,
            root_code=trace.document_code,
            related=related,
        )

        by_type: Dict[str, List[int]] = {}
        for doc in documents:
            by_type.setdefault(doc["document_type"], []).append(doc["document_id"])

        attachment_map: Dict[Tuple[str, int], List[DocumentAttachmentCenterItem]] = {}
        code_map: Dict[Tuple[str, int], Optional[str]] = {
            (doc["document_type"], doc["document_id"]): doc.get("document_code")
            for doc in documents
        }

        for doc_type, doc_ids in by_type.items():
            cfg = DocumentRelationService.DOCUMENT_TYPES.get(doc_type)
            if not cfg:
                continue
            model = cfg["model"]
            if not _model_has_attachments(model):
                continue
            code_field = cfg["code_field"]
            only_fields = ["id", "attachments", code_field]
            rows = await model.filter(
                tenant_id=tenant_id,
                id__in=doc_ids,
                deleted_at__isnull=True,
            ).only(*only_fields)
            for row in rows:
                key = (doc_type, int(row.id))
                attachment_map[key] = _normalize_attachments(getattr(row, "attachments", None))
                if code_field:
                    code_val = getattr(row, code_field, None)
                    if code_val is not None and str(code_val).strip():
                        code_map[key] = str(code_val).strip()

        groups: List[DocumentAttachmentCenterGroup] = []
        for doc in documents:
            key = (doc["document_type"], doc["document_id"])
            groups.append(
                DocumentAttachmentCenterGroup(
                    document_type=doc["document_type"],
                    document_id=doc["document_id"],
                    document_code=code_map.get(key) or doc.get("document_code"),
                    is_self=bool(doc.get("is_self")),
                    attachments=attachment_map.get(key, []),
                )
            )

        if not groups:
            raise NotFoundError(f"单据不存在: {document_type}/{document_id}")

        return DocumentAttachmentCenterResponse(
            document_type=document_type,
            document_id=document_id,
            groups=groups,
        )
