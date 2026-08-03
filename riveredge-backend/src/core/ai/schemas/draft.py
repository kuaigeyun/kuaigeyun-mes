"""结构化草稿（OCR / NL → JSON）契约。"""

from __future__ import annotations

from typing import Any, Dict, Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class StructuredDraftRequest(BaseModel):
    schema_name: str = Field(..., description="结构化配置名，如 sales_order / purchase_order")
    source_text: Optional[str] = Field(default=None, description="自然语言或 OCR 文本")
    image_base64: Optional[str] = Field(default=None, description="Base64 图片（与 source_text 二选一）")
    image_mime: Optional[str] = Field(default=None, description="图片 MIME")
    context: Optional[Dict[str, Any]] = Field(default=None, description="已有草稿 JSON，用于对话合并")


class StructuredDraftResult(BaseModel, Generic[T]):
    schema_name: str
    data: Dict[str, Any]
    raw_text: Optional[str] = None
