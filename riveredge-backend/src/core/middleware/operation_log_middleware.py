"""
操作日志中间件模块

自动记录所有 API 操作日志与在线用户活动时间。
主链路 fire-and-forget，单次 asyncio.create_task 合并两张表写入，失败不回灌请求。
"""

import asyncio
import re
from typing import Callable, Optional

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
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
    }
)

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

    仅对 `/api/` 下、非排除路径、携带合法 Bearer 的请求记录一次日志。
    日志写入与在线用户活动更新合并到单一后台任务，完全不阻塞响应。
    """

    def __init__(self, app):
        super().__init__(app)
        logger.info("操作日志中间件已初始化")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        if not self._should_log(request):
            return response

        tenant_id, user_id = self._extract_identity(request)
        if not tenant_id or not user_id:
            return response

        ip_address = self._get_client_ip(request)
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

        asyncio.create_task(self._persist(payload, ip_address))
        return response

    @staticmethod
    async def _persist(payload: dict, ip_address: Optional[str]) -> None:
        """后台写入操作日志 + 更新在线用户活动。单任务内串行，失败各自吞掉。"""
        try:
            await OperationLogService.create_operation_log(**payload)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "操作日志写入失败 path={path} error={error}",
                path=payload.get("request_path"),
                error=exc,
            )

        try:
            await OnlineUserService.update_user_activity(
                tenant_id=payload["tenant_id"],
                user_id=payload["user_id"],
                login_ip=ip_address,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "在线用户活动更新失败 user_id={user_id} error={error}",
                user_id=payload.get("user_id"),
                error=exc,
            )

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
