"""Batch 4 document help content."""
from __future__ import annotations

from batch3_document_help_content import _detail_table_doc
from batch4_help_manifest import DOC_WIRE

BATCH4_DOC_KEYS = [item[2] for item in DOC_WIRE]

_AFTER_SALES_PUSH = ("下推派工单。", "下推维修单。", "关联备件领用。", "服务结算。")
_EXCEPTION_PUSH = ("关联工单或订单。", "记录处置结论。", "关闭异常。")


def _doc(title: str, p1: str, **kwargs) -> dict[str, str]:
    return _detail_table_doc(title, p1, **kwargs)


BATCH4_DOC_CONTENT: dict[str, dict[str, str]] = {}

for _path, _prop, slug, title, p1 in DOC_WIRE:
    extra: dict = {}
    if slug.startswith("after-sales"):
        extra = {"push_items": _AFTER_SALES_PUSH, "search_b2": "客户/状态：按客户与服务状态筛选。"}
    elif "exception" in slug or slug in ("exception-delivery-delay", "exception-material-shortage"):
        extra = {
            "audit_enabled": False,
            "push_items": _EXCEPTION_PUSH,
            "search_b2": "工单/订单：按来源单号筛选。",
            "layout_b2": "工具栏：刷新、导出、批量关闭（以权限为准）。",
        }
    elif slug in ("freight-order", "freight-bill"):
        extra = {
            "push_items": ("下推运费单。", "关联出库/发货通知。", "打印运单。"),
            "search_b2": "承运商/状态：按物流伙伴与在途状态筛选。",
        }
    elif slug == "eight-d-report":
        extra = {"push_items": ("关联不合格记录。", "提交审批。", "归档关闭。")}
    elif slug == "nonconforming-ledger":
        extra = {"audit_enabled": False, "layout_b2": "工具栏：导出、关联 8D（若提供）。"}
    BATCH4_DOC_CONTENT[slug] = _doc(title, p1, **extra)
