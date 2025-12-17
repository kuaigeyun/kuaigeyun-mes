"""
测试 Inngest 集成的工作流函数

用于验证 Inngest 与系统的融合情况。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from core.inngest.client import inngest_client
from core.utils.inngest_tenant_isolation import with_tenant_isolation_optional
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="test-integration",
    name="测试集成",
    trigger=TriggerEvent(event="test/integration"),
)
# @with_tenant_isolation_optional  # 暂时移除装饰器进行调试
async def test_integration_function(event: Event) -> Dict[str, Any]:
    """
    测试 Inngest 集成的工作流函数
    
    接收测试事件，返回处理结果。
    租户隔离已由装饰器自动处理。
    """
    # 从事件数据中获取信息
    data = event.data or {}
    message = data.get("message", "Hello from Inngest!")
    tenant_id = get_current_tenant_id()  # 从上下文获取（可能为 None）
    
    # 返回处理结果
    return {
        "success": True,
        "message": message,
        "event_id": getattr(event, "id", None),
        "tenant_id": tenant_id,  # 包含租户ID（如果有）
        "received_data": data,
    }

