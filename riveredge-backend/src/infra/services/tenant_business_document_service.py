"""
组织业务单据检测服务

用于判断组织是否仍存在业务单据，以决定是否允许删除组织。
"""

from typing import Any, Dict, List, Set, Tuple, Type

from loguru import logger

# 台账/主数据类，不计入「业务单据」
_NON_TRANSACTIONAL_DOC_TYPES = frozenset(
    {
        "equipment",
        "mold",
        "tool",
        "performance_skill",
        "performance_holiday",
        "performance_summary",
        "maintenance_plan",
        "maintenance_reminder",
    }
)


class TenantBusinessDocumentService:
    """组织业务单据检测"""

    @classmethod
    def _model_has_deleted_at(cls, model: Type) -> bool:
        return "deleted_at" in model._meta.fields_map

    @classmethod
    async def _count_documents(
        cls,
        tenant_id: int,
        document_type: str,
        model: Type,
    ) -> int:
        queryset = model.filter(tenant_id=tenant_id)
        if document_type == "sales_invoice":
            queryset = queryset.filter(category="OUT")
        if cls._model_has_deleted_at(model):
            queryset = queryset.filter(deleted_at__isnull=True)
        return await queryset.count()

    @classmethod
    def _iter_document_models(cls) -> List[Tuple[str, Type]]:
        from apps.kuaizhizao.services.document_relation_service import DocumentRelationService
        from core.services.document_tracking_service import DOCUMENT_MODEL_REGISTRY

        seen_models: Set[Type] = set()
        pairs: List[Tuple[str, Type]] = []

        for doc_type, cfg in DocumentRelationService.DOCUMENT_TYPES.items():
            if doc_type in _NON_TRANSACTIONAL_DOC_TYPES:
                continue
            model = cfg["model"]
            if model in seen_models:
                continue
            seen_models.add(model)
            pairs.append((doc_type, model))

        for doc_type, (model, _) in DOCUMENT_MODEL_REGISTRY().items():
            if doc_type in _NON_TRANSACTIONAL_DOC_TYPES:
                continue
            if model in seen_models:
                continue
            seen_models.add(model)
            pairs.append((doc_type, model))

        return pairs

    @classmethod
    async def summarize_business_documents(cls, tenant_id: int) -> Dict[str, Any]:
        """
        统计组织下业务单据数量。

        Returns:
            dict: { total: int, items: [{ document_type, label, count }] }
        """
        from core.services.document_tracking_service import DOCUMENT_TYPE_LABEL_ZH

        items: List[Dict[str, Any]] = []
        total = 0

        for doc_type, model in cls._iter_document_models():
            try:
                count = await cls._count_documents(tenant_id, doc_type, model)
            except Exception as exc:
                logger.warning(
                    "统计组织 {} 业务单据 {} 失败: {}",
                    tenant_id,
                    doc_type,
                    exc,
                )
                continue
            if count <= 0:
                continue
            items.append(
                {
                    "document_type": doc_type,
                    "label": DOCUMENT_TYPE_LABEL_ZH.get(doc_type, doc_type),
                    "count": count,
                }
            )
            total += count

        items.sort(key=lambda x: (-x["count"], x["label"]))
        return {"total": total, "items": items}

    @classmethod
    async def has_business_documents(cls, tenant_id: int) -> bool:
        summary = await cls.summarize_business_documents(tenant_id)
        return summary["total"] > 0

    @classmethod
    def format_blocking_message(
        cls,
        tenant_name: str,
        summary: Dict[str, Any],
    ) -> str:
        items = summary.get("items") or []
        if not items:
            return f"组织「{tenant_name}」存在业务单据，无法删除"

        labels = [item["label"] for item in items[:5]]
        label_text = "、".join(labels)
        if len(items) > 5:
            label_text = f"{label_text} 等"
        return f"组织「{tenant_name}」存在业务单据（{label_text}），无法删除"
