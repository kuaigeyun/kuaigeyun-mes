import inspect
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from loguru import logger


@dataclass
class TaskEvent:
    name: str
    data: dict[str, Any]
    id: str | None = None


@dataclass
class TaskContext:
    event: TaskEvent
    run_id: str | None


class TaskStep:
    async def run(self, _name: str, fn: Callable[[], Any]) -> Any:
        if inspect.iscoroutinefunction(fn):
            return await fn()
        return fn()


_handlers: dict[str, list[Callable[..., Awaitable[Any]]]] = defaultdict(list)
_handlers_bootstrapped = False


def register_event_handler(event_name: str, handler: Callable[..., Awaitable[Any]]) -> None:
    _handlers[event_name].append(handler)


def _ensure_default_handlers_registered() -> None:
    global _handlers_bootstrapped
    if _handlers_bootstrapped:
        return
    from core.tasks.data_backup_handlers import register_data_backup_handlers

    register_data_backup_handlers()
    _handlers_bootstrapped = True


async def execute_event_handlers(
    event_name: str,
    data: dict[str, Any],
    event_id: str | None,
    run_id: str,
) -> Any:
    """
    在 Taskiq worker 内执行某事件已注册的全部处理器（顺序执行）。
    """
    _ensure_default_handlers_registered()
    handlers = _handlers.get(event_name, [])
    if not handlers:
        logger.warning("No task handler registered for event: {}", event_name)
        return None
    last: Any = None
    for handler in handlers:
        event = TaskEvent(name=event_name, data=data, id=event_id)
        last = await _run_handler(handler, event, run_id)
    return last


async def dispatch_event(event: TaskEvent) -> list[str]:
    """
    将事件投递到 Taskiq（PostgreSQL broker）。返回 task_id 列表（通常 1 个）。
    """
    _ensure_default_handlers_registered()
    handlers = _handlers.get(event.name, [])
    if not handlers:
        logger.warning("No task handler registered for event: {}", event.name)
        return []

    from core.tasks.taskiq_app import broker, run_event_pipeline

    if not getattr(broker, "_write_pool", None):
        msg = "Taskiq broker 未 startup，请在 FastAPI lifespan 中调用 await broker.startup()"
        logger.error(msg)
        raise RuntimeError(msg)

    task_ids: list[str] = []
    st = await run_event_pipeline.kiq(
        event_name=event.name,
        data=event.data or {},
        event_id=event.id,
    )
    task_ids.append(st.task_id)
    logger.info(
        "已投递 Taskiq: task_name={} event={} task_id={}",
        run_event_pipeline.task_name,
        event.name,
        st.task_id,
    )
    return task_ids


async def _run_handler(handler: Callable[..., Awaitable[Any]], event: TaskEvent, run_id: str) -> None:
    params = list(inspect.signature(handler).parameters)
    if len(params) == 1:
        await handler(event)
    elif len(params) >= 2:
        await handler(TaskContext(event=event, run_id=run_id), TaskStep())
    else:
        await handler()
