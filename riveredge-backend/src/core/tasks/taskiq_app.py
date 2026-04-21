"""
Taskiq app bootstrap.

当前采用项目内 dispatcher 兼容层统一分发异步任务，
保留该文件作为后续接入独立 Taskiq worker/broker 的唯一入口。
"""

from core.tasks.dispatcher import TaskEvent, dispatch_event


async def enqueue(event_name: str, payload: dict) -> list[str]:
    return await dispatch_event(TaskEvent(name=event_name, data=payload))
