"""
统一异常处理中间件模块

提供统一的异常处理和响应格式，确保所有 API 返回一致的错误格式。
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Callable
from datetime import datetime
import traceback
from loguru import logger

from infra.exceptions.exceptions import (
    RiverEdgeException,
    ValidationError,
    create_error_response,
)
from core.utils.error_logger import ErrorLogger


class ExceptionHandlerMiddleware(BaseHTTPMiddleware):
    """
    统一异常处理中间件
    
    捕获所有异常并转换为统一的错误响应格式。
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并捕获异常
        
        Args:
            request: 请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: 响应对象
        """
        try:
            response = await call_next(request)
            return response
        except RiverEdgeException as e:
            # RiverEdge 自定义异常，使用统一错误响应格式
            error_response = create_error_response(
                exception=e,
                request_path=str(request.url.path),
            )
            
            # 记录错误日志
            try:
                from core.api.deps.deps import get_current_tenant
                from infra.api.deps.deps import get_current_user
                tenant_id = getattr(request.state, 'tenant_id', None)
                user_id = getattr(request.state, 'user_id', None)
                ErrorLogger.log_api_error(
                    error=e,
                    request_path=str(request.url.path),
                    request_method=request.method,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    status_code=e.status_code
                )
            except Exception:
                # 如果获取上下文失败，使用基础日志
                logger.warning(
                    f"RiverEdge 异常: {e.code} - {e.message} "
                    f"(Path: {request.url.path}, Method: {request.method})"
                )
            
            return JSONResponse(
                status_code=e.status_code,
                content=error_response
            )
        except RequestValidationError as e:
            # FastAPI 请求验证错误
            error_response = {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "请求参数验证失败",
                    "details": e.errors() if hasattr(e, 'errors') else str(e),
                },
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # 记录错误日志
            try:
                tenant_id = getattr(request.state, 'tenant_id', None)
                user_id = getattr(request.state, 'user_id', None)
                ErrorLogger.log_api_error(
                    error=e,
                    request_path=str(request.url.path),
                    request_method=request.method,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
                )
            except Exception:
                logger.warning(
                    f"请求验证错误: {request.url.path} - {str(e)}"
                )
            
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=error_response
            )
        except ValidationError as e:
            # ValidationError 应该返回 400 而不是 500
            error_response = {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": str(e) if str(e) else "数据验证失败",
                    "details": {
                        "type": type(e).__name__,
                        "message": str(e),
                    },
                },
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # 记录错误日志
            try:
                tenant_id = getattr(request.state, 'tenant_id', None)
                user_id = getattr(request.state, 'user_id', None)
                ErrorLogger.log_api_error(
                    error=e,
                    request_path=str(request.url.path),
                    request_method=request.method,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    status_code=status.HTTP_400_BAD_REQUEST
                )
            except Exception:
                logger.warning(
                    f"验证错误: {request.url.path} - {str(e)}"
                )
            
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=error_response
            )
        except Exception as e:
            # 未预期的异常
            error_response = {
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "服务器内部错误",
                    "details": {
                        "type": type(e).__name__,
                        "message": str(e),
                    },
                },
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # 记录详细错误日志
            try:
                tenant_id = getattr(request.state, 'tenant_id', None)
                user_id = getattr(request.state, 'user_id', None)
                ErrorLogger.log_api_error(
                    error=e,
                    request_path=str(request.url.path),
                    request_method=request.method,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception:
                logger.error(
                    f"未预期的异常: {type(e).__name__} - {str(e)}\n"
                    f"路径: {request.url.path}\n"
                    f"方法: {request.method}\n"
                    f"堆栈跟踪:\n{traceback.format_exc()}"
                )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=error_response
            )

