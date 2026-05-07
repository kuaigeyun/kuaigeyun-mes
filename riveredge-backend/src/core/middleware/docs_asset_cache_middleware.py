"""为 OpenAPI JSON 与本地 ReDoc 静态资源补充缓存头，减轻重复打开文档时的等待。"""

from starlette.middleware.base import BaseHTTPMiddleware


class DocsAssetCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if response.status_code != 200:
            return response
        path = request.url.path
        if path == "/openapi.json":
            response.headers.setdefault("Cache-Control", "private, max-age=120")
        elif path.startswith("/static/redoc/"):
            response.headers.setdefault("Cache-Control", "public, max-age=86400, immutable")
        return response
