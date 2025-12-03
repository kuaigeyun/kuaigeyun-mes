"""
测试 Inngest 集成的工作流函数

用于验证 Inngest 与系统的融合情况。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from tree_root.inngest.client import inngest_client


@inngest_client.create_function(
    fn_id="test-integration",
    name="测试集成",
    trigger=TriggerEvent(event="test/integration"),
)
async def test_integration_function(event: Event) -> Dict[str, Any]:
    """
    测试 Inngest 集成的工作流函数
    
    接收测试事件，返回处理结果。
    """
    # 从事件数据中获取信息
    data = event.data or {}
    message = data.get("message", "Hello from Inngest!")
    
    # 返回处理结果
    return {
        "success": True,
        "message": message,
        "event_id": getattr(event, "id", None),
        "received_data": data,
    }

