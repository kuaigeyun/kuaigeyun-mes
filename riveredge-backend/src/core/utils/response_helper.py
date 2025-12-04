"""
统一响应格式工具模块

提供统一的 API 响应格式工具函数，确保所有 API 返回一致的响应格式。
"""

from typing import Any, Optional, Dict, List
from datetime import datetime
from infra.responses import StandardResponse, PaginatedResponse


def create_success_response(
    data: Any = None,
    message: Optional[str] = None,
    code: Optional[str] = None
) -> Dict[str, Any]:
    """
    创建成功响应
    
    Args:
        data: 响应数据
        message: 响应消息（可选）
        code: 响应代码（可选）
        
    Returns:
        Dict[str, Any]: 统一格式的成功响应
    """
    response = {
        "success": True,
        "data": data,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    if message:
        response["message"] = message
    
    if code:
        response["code"] = code
    
    return response


def create_paginated_response(
    items: List[Any],
    total: int,
    page: int,
    page_size: int,
    message: Optional[str] = None
) -> Dict[str, Any]:
    """
    创建分页响应
    
    Args:
        items: 数据列表
        total: 总数量
        page: 当前页码
        page_size: 每页数量
        message: 响应消息（可选）
        
    Returns:
        Dict[str, Any]: 统一格式的分页响应
    """
    response = {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
    
    if message:
        response["message"] = message
    
    return response


def create_list_response(
    items: List[Any],
    message: Optional[str] = None
) -> Dict[str, Any]:
    """
    创建列表响应（无分页）
    
    Args:
        items: 数据列表
        message: 响应消息（可选）
        
    Returns:
        Dict[str, Any]: 统一格式的列表响应
    """
    return create_success_response(
        data=items,
        message=message
    )

