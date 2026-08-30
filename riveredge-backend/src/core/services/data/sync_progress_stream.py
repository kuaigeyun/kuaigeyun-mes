"""同步 NDJSON 流式响应：边跑边推 progress，结束推 done/error。"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Awaitable, Callable, Optional

from fastapi.responses import StreamingResponse

from core.services.data.sync_progress import (
    reset_sync_progress_callback,
    set_sync_progress_callback,
)


async def stream_sync_ndjson(
    run: Callable[[], Awaitable[Any]],
) -> StreamingResponse:
    queue: asyncio.Queue[Optional[dict]] = asyncio.Queue()

    async def on_progress(*, message: str, **extra: Any) -> None:
        payload = {"event": "progress", "message": message}
        if extra:
            payload.update(extra)
        await queue.put(payload)

    async def runner() -> None:
        token = set_sync_progress_callback(on_progress)
        try:
            await on_progress(message="已连接服务端，开始同步…")
            result = await run()
            if hasattr(result, "model_dump"):
                data = result.model_dump(mode="json")
            elif isinstance(result, dict):
                data = result
            else:
                data = {"detail": str(result)}
            await queue.put({"event": "done", "result": data})
        except Exception as exc:
            await queue.put({"event": "error", "detail": str(exc)})
        finally:
            reset_sync_progress_callback(token)
            await queue.put(None)

    async def generate():
        # 首包立刻写出，避免代理/中间件在无字节时长时间挂起
        yield (
            json.dumps(
                {"event": "progress", "message": "正在建立同步通道…"},
                ensure_ascii=False,
            )
            + "\n"
        )
        task = asyncio.create_task(runner())
        try:
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield json.dumps(item, ensure_ascii=False) + "\n"
        finally:
            await task

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )
