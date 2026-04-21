import asyncio
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


def register_event_handler(event_name: str, handler: Callable[..., Awaitable[Any]]) -> None:
    _handlers[event_name].append(handler)


async def dispatch_event(event: TaskEvent) -> list[str]:
    run_id = event.id or f"{event.name}:{asyncio.get_running_loop().time()}"
    handlers = _handlers.get(event.name, [])
    if not handlers:
        logger.warning("No task handler registered for event: {}", event.name)
        return []

    task_ids: list[str] = []
    for idx, handler in enumerate(handlers):
        task_id = f"{run_id}:{idx}"
        task_ids.append(task_id)
        asyncio.create_task(_run_handler(handler, event, task_id))
    return task_ids


async def _run_handler(handler: Callable[..., Awaitable[Any]], event: TaskEvent, run_id: str) -> None:
    try:
        params = list(inspect.signature(handler).parameters)
        if len(params) == 1:
            await handler(event)
        elif len(params) >= 2:
            await handler(TaskContext(event=event, run_id=run_id), TaskStep())
        else:
            await handler()
    except Exception as e:
        logger.exception("Task handler failed: {} run_id={} error={}", getattr(handler, "__name__", str(handler)), run_id, e)
