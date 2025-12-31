"""
批量操作模块数据验证schema

提供批量操作相关的数据验证和序列化。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from core.schemas.base import BaseSchema


class BatchCreateRequest(BaseSchema):
    """批量创建请求"""
    items: List[Dict[str, Any]] = Field(..., description="创建数据列表", min_items=1, max_items=100)


class BatchUpdateRequest(BaseSchema):
    """批量更新请求"""
    items: List[Dict[str, Any]] = Field(..., description="更新数据列表（必须包含id字段）", min_items=1, max_items=100)


class BatchDeleteRequest(BaseSchema):
    """批量删除请求"""
    ids: List[int] = Field(..., description="要删除的记录ID列表", min_items=1, max_items=100)


class BatchOperationResult(BaseSchema):
    """批量操作结果"""
    success_count: int = Field(..., description="成功数量")
    failed_count: int = Field(..., description="失败数量")
    success_records: List[Dict[str, Any]] = Field(default_factory=list, description="成功记录列表")
    failed_records: List[Dict[str, Any]] = Field(default_factory=list, description="失败记录列表")


class BatchResponse(BaseSchema):
    """批量操作响应"""
    success: bool = Field(..., description="是否成功")
    message: str = Field(..., description="消息")
    data: BatchOperationResult = Field(..., description="操作结果")

