"""
操作日志中间件模块

自动记录 API 变更操作日志，并按节流更新在线用户活动时间。
读请求（GET/HEAD/OPTIONS）不写入操作日志，避免浏览列表时每个请求双写数据库。
"""

import re
import time
from typing import Callable, Optional, Tuple

from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.services.logging.online_user_service import OnlineUserService
from core.services.logging.operation_log_service import OperationLogService

_UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.IGNORECASE,
)

_EXCLUDED_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
    }
)

_READ_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

# 同一用户在线活动最短更新间隔（秒）
_ACTIVITY_DEBOUNCE_SECONDS = 30
_last_activity_update: dict[Tuple[int, int], float] = {}

_METHOD_TO_OPERATION = {
    "GET": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}


class OperationLogMiddleware(BaseHTTPMiddleware):
    """
    操作日志中间件

    对 `/api/` 下、非排除路径、携带合法 Bearer 的请求：
    - POST/PUT/PATCH/DELETE：写入操作日志 + 更新在线活动
    - GET/HEAD/OPTIONS：仅按节流更新在线活动，不写操作日志
    """

    def __init__(self, app):
        super().__init__(app)
        logger.info("操作日志中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        if not self._should_log(request):
            return response

        tenant_id, user_id = self._extract_identity(request)
        if tenant_id is None or user_id is None:
            logger.debug(
                "⚠️ 未能从请求中解析身份 path={} tenant_id={} user_id={}", 
                request.url.path, tenant_id, user_id
            )
            return response
        
        logger.debug(f"✅ 已提取身份: tenant_id={tenant_id}, user_id={user_id}")

        ip_address = self._get_client_ip(request)
        is_mutation = request.method not in _READ_METHODS

        await self._persist_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            ip_address=ip_address,
            force=is_mutation,
        )

        if is_mutation:
            payload = {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "operation_type": self._parse_operation_type(request.method, response.status_code),
                "operation_module": self._parse_operation_module(request.url.path),
                "operation_object_type": self._parse_operation_object_type(request.url.path),
                "operation_object_uuid": self._parse_operation_object_uuid(request.url.path),
                "operation_content": (
                    f"{request.method} {request.url.path} - "
                    f"{'成功' if response.status_code < 400 else '失败'} "
                    f"(状态码: {response.status_code})"
                ),
                "ip_address": ip_address,
                "user_agent": request.headers.get("User-Agent", ""),
                "request_method": request.method,
                "request_path": request.url.path,
            }
            await self._persist_operation_log(payload)
        return response

    @staticmethod
    def _should_update_activity(tenant_id: int, user_id: int, *, force: bool) -> bool:
        if force:
            return True
        key = (tenant_id, user_id)
        now = time.monotonic()
        last = _last_activity_update.get(key, 0.0)
        if now - last < _ACTIVITY_DEBOUNCE_SECONDS:
            return False
        _last_activity_update[key] = now
        return True

    @staticmethod
    async def _persist_activity(
        *,
        tenant_id: int,
        user_id: int,
        ip_address: Optional[str],
        force: bool,
    ) -> None:
        if not OperationLogMiddleware._should_update_activity(tenant_id, user_id, force=force):
            return
        try:
            await OnlineUserService.update_user_activity(
                tenant_id=tenant_id,
                user_id=user_id,
                login_ip=ip_address,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "在线用户活动更新失败 user_id={user_id} error={error}",
                user_id=user_id,
                error=exc,
            )

    @staticmethod
    async def _persist_operation_log(payload: dict) -> None:
        try:
            await OperationLogService.create_operation_log(**payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "操作日志写入失败 path={path} error={error}",
                path=payload.get("request_path"),
                error=exc,
            )

    @staticmethod
    async def _persist(payload: dict, ip_address: Optional[str]) -> None:
        """兼容旧调用：变更写日志 + 活动更新。"""
        await OperationLogMiddleware._persist_activity(
            tenant_id=payload["tenant_id"],
            user_id=payload["user_id"],
            ip_address=ip_address,
            force=True,
        )
        await OperationLogMiddleware._persist_operation_log(payload)

    @staticmethod
    def _should_log(request: Request) -> bool:
        path = request.url.path
        if not path.startswith("/api/"):
            return False
        if path in _EXCLUDED_PATHS:
            return False
        return True

    @staticmethod
    def _extract_identity(request: Request) -> tuple[Optional[int], Optional[int]]:
        """
        解析 tenant_id / user_id。
        优先复用 get_current_user 在 request.state 中缓存的身份，
        避免同一请求内二次解析 JWT；未命中时再回退到直接解析 Authorization 头。
        """
        # 优先从 request.state 读取（get_current_user 已校验并缓存）
        state = getattr(request, "state", None)
        if state is not None:
            cached_tenant_id = getattr(state, "tenant_id", None)
            cached_user_id = getattr(state, "user_id", None)
            if cached_user_id is not None:
                try:
                    tenant_int = (
                        int(cached_tenant_id) if cached_tenant_id is not None else None
                    )
                    user_int = int(cached_user_id)
                    return tenant_int, user_int
                except (ValueError, TypeError):
                    pass

        authorization = request.headers.get("Authorization")
        if not authorization or not authorization.startswith("Bearer "):
            return None, None

        try:
            from infra.domain.security.security import get_token_payload

            payload = get_token_payload(authorization[7:])
            if not payload:
                return None, None
            tenant_id = payload.get("tenant_id")
            sub = payload.get("sub")
            tenant_id_int = int(tenant_id) if tenant_id is not None else None
            user_id_int = int(sub) if sub is not None else None
            return tenant_id_int, user_id_int
        except (ValueError, TypeError):
            return None, None
        except Exception:  # noqa: BLE001
            return None, None

    @staticmethod
    def _parse_operation_type(method: str, status_code: int) -> str:
        if status_code >= 400:
            return "error"
        return _METHOD_TO_OPERATION.get(method, "unknown")

    @staticmethod
    def _parse_operation_module(path: str) -> Optional[str]:
        parts = path.split("/")
        if len(parts) < 4:
            return None
        module = parts[3]
        if len(parts) < 5:
            return module
        submodule = parts[4]
        if module == "apps" and len(parts) >= 6:
            return f"{module}/{submodule}/{parts[5]}"
        return f"{module}/{submodule}"

    @staticmethod
    def _parse_operation_object_type(path: str) -> Optional[str]:
        parts = path.split("/")
        if len(parts) >= 6 and parts[3] == "apps":
            object_name = parts[5]
        elif len(parts) >= 5:
            object_name = parts[4]
        else:
            return None

        if object_name.endswith("s") and len(object_name) > 1:
            object_name = object_name[:-1]

        if "-" in object_name:
            return "".join(word.capitalize() for word in object_name.split("-"))
        return object_name.capitalize()

    @staticmethod
    def _parse_operation_object_uuid(path: str) -> Optional[str]:
        match = _UUID_PATTERN.search(path)
        return match.group(0) if match else None

    @staticmethod
    def _get_client_ip(request: Request) -> Optional[str]:
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        if request.client:
            return request.client.host
        return None
