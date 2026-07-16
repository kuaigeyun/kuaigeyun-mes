"""
系统枚举 API 模块

提供业务枚举的单一数据源，供前端消费，避免前后端重复维护。
"""

from typing import Dict, List, Any
from fastapi import APIRouter

from apps.kuaizhizao.constants import (
    DocumentStatus,
    ReviewStatus,
    STATE_ALIASES,
    REVIEW_STATUS_ALIASES,
)

router = APIRouter(prefix="/enums", tags=["Core - Enums"])

# 单据状态展示配置（与后端常量一致，单一数据源）
STATUS_DISPLAY: Dict[str, Dict[str, str]] = {
    DocumentStatus.DRAFT.value: {"text": "草稿", "color": "default"},
    DocumentStatus.APPROVED.value: {"text": "已审核", "color": "processing"},
    DocumentStatus.PENDING_REVIEW.value: {"text": "待审核", "color": "processing"},
    DocumentStatus.AUDITED.value: {"text": "已审核", "color": "processing"},
    DocumentStatus.REJECTED.value: {"text": "已驳回", "color": "error"},
    DocumentStatus.CONFIRMED.value: {"text": "已确认", "color": "success"},
    DocumentStatus.CANCELLED.value: {"text": "已取消", "color": "error"},
    DocumentStatus.RELEASED.value: {"text": "已下达", "color": "processing"},
    DocumentStatus.IN_PROGRESS.value: {"text": "执行中", "color": "processing"},
    DocumentStatus.COMPLETED.value: {"text": "已完成", "color": "success"},
    DocumentStatus.PARTIAL_CONVERTED.value: {"text": "部分转单", "color": "warning"},
    DocumentStatus.FULL_CONVERTED.value: {"text": "全部转单", "color": "success"},
}

REVIEW_STATUS_DISPLAY: Dict[str, Dict[str, str]] = {
    ReviewStatus.PENDING.value: {"text": "待审核", "color": "default"},
    ReviewStatus.APPROVED.value: {"text": "审核通过", "color": "success"},
    ReviewStatus.REJECTED.value: {"text": "审核驳回", "color": "error"},
}


@router.get("/document-status", summary="Get document status enums")
async def get_document_status() -> Dict[str, Any]:
    """
    获取业务单据状态枚举及展示配置

    返回 DocumentStatus、ReviewStatus 的枚举值、别名、展示配置，
    供前端统一使用，避免前后端重复维护。
    """
    document_values = [e.value for e in DocumentStatus]
    review_values = [e.value for e in ReviewStatus]
    return {
        "documentStatus": {
            "values": document_values,
            "aliases": STATE_ALIASES,
            "display": STATUS_DISPLAY,
        },
        "reviewStatus": {
            "values": review_values,
            "aliases": REVIEW_STATUS_ALIASES,
            "display": REVIEW_STATUS_DISPLAY,
        },
    }
