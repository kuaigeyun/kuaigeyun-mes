from dataclasses import dataclass
from typing import Any, Callable, Awaitable

from core.tasks.dispatcher import TaskEvent, register_event_handler, dispatch_event


@dataclass
class Event:
    name: str
    data: dict[str, Any] | None = None
    id: str | None = None


@dataclass
class TriggerEvent:
    event: str


@dataclass
class TriggerCron:
    cron: str


class Step:
    async def run(self, _name: str, fn: Callable[[], Any]) -> Any:
        if callable(fn):
            result = fn()
            if hasattr(result, "__await__"):
                return await result
            return result
        return None


@dataclass
class Context:
    event: Event
    run_id: str | None = None


class Inngest:
    def __init__(self, app_id: str, event_api_base_url: str, is_production: bool = False):
        self.app_id = app_id
        self.event_api_base_url = event_api_base_url
        self.is_production = is_production

    def create_function(self, fn_id: str, name: str, trigger: TriggerEvent | TriggerCron, retries: int = 0):
        def decorator(func: Callable[..., Awaitable[Any]]):
            if isinstance(trigger, TriggerEvent):
                register_event_handler(trigger.event, func)
            return func

        return decorator

    async def send(self, event: Event) -> list[str]:
        return await dispatch_event(TaskEvent(name=event.name, data=event.data or {}, id=event.id))
