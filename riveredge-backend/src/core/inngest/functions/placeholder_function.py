"""
占位 Inngest 函数

用于解决 Inngest 不允许空函数列表的问题。
此函数不执行任何实际逻辑，仅用于保持 Inngest 同步状态。

Author: Luigi Lu
Date: 2025-12-27
"""

from typing import Dict, Any
from inngest import Event, TriggerEvent
from core.inngest.client import inngest_client


@inngest_client.create_function(
    fn_id="placeholder",
    name="占位函数",
    trigger=TriggerEvent(event="placeholder/ping"),
)
async def placeholder_function(event: Event) -> Dict[str, Any]:
    """
    占位函数
    
    此函数不执行任何实际逻辑，仅用于保持 Inngest 同步状态。
    等待函数重构完成后，可以删除此函数。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 简单的响应
    """
    return {
        "status": "placeholder",
        "message": "这是一个占位函数，等待重构完成后将被移除",
        "event": event.name if event else None,
    }

