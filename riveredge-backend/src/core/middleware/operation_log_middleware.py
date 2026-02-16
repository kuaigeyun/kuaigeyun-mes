"""
操作日志中间件模块

自动记录所有 API 操作日志。
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi import status
import asyncio
from typing import Callable, Optional

from loguru import logger

from core.services.logging.operation_log_service import OperationLogService


class OperationLogMiddleware(BaseHTTPMiddleware):
    """
    操作日志中间件
    
    自动记录所有 API 操作日志。
    注意：异步执行，不影响业务性能。
    """
    
    # 排除的路径（不需要记录日志的路径）
    EXCLUDED_PATHS = [
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/v1/auth/login",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/api/inngest",
    ]
    
    def __init__(self, app):
        """初始化中间件"""
        super().__init__(app)
        # 使用print确保能看到（即使日志配置有问题）
        print("=" * 80)
        print("✅ 操作日志中间件已初始化")
        print("=" * 80)
        try:
            logger.info("✅ 操作日志中间件已初始化")
        except Exception as e:
            print(f"⚠️ 日志记录失败: {e}")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        处理请求并记录操作日志
        
        Args:
            request: 请求对象
            call_next: 下一个中间件或路由处理函数
            
        Returns:
            Response: 响应对象
        """
        # 在中间件入口添加日志，确保能看到中间件是否被调用
        # 使用print确保能看到（即使日志配置有问题）
        import sys
        print(f"\n{'='*80}", file=sys.stderr, flush=True)
        print(f"[操作日志中间件] 收到请求: {request.method} {request.url.path}", file=sys.stderr, flush=True)
        print(f"{'='*80}\n", file=sys.stderr, flush=True)
        try:
            logger.info(f"[操作日志中间件] 收到请求: {request.method} {request.url.path}")
        except:
            pass
        
        # 检查是否需要记录日志
        should_log = self._should_log(request)
        if not should_log:
            logger.info(f"[操作日志中间件] 跳过记录: {request.method} {request.url.path}")
            return await call_next(request)
        
        # 执行请求
        response = await call_next(request)
        
        # 直接记录操作日志（确保执行）
        # 注意：虽然会稍微影响响应时间，但能保证数据一致性
        try:
            print(f"[操作日志中间件] 开始记录操作日志: {request.method} {request.url.path}")
            await self._log_operation(request, response)
            print(f"[操作日志中间件] 操作日志记录完成: {request.method} {request.url.path}")
        except Exception as e:
            # 使用print确保能看到错误（即使日志配置有问题）
            print(f"❌ 操作日志记录失败: path={request.url.path}, method={request.method}, error={e}")
            import traceback
            print(traceback.format_exc())
            # 记录日志失败不影响业务，但需要详细记录错误信息
            try:
                logger.error(
                    f"操作日志记录失败: path={request.url.path}, method={request.method}, error={e}",
                    exc_info=True
                )
            except:
                pass
        
        return response
    
    def _should_log(self, request: Request) -> bool:
        """
        判断是否需要记录日志
        
        Args:
            request: 请求对象
            
        Returns:
            bool: 是否需要记录日志
        """
        # 排除的路径
        if request.url.path == "/api/inngest" or request.url.path == "/api/inngest/":
            logger.debug(f"跳过操作日志记录（Inngest 路径）: {request.url.path}")
            return False
            
        if request.url.path in self.EXCLUDED_PATHS:
            logger.debug(f"跳过操作日志记录（排除路径）: {request.url.path}")
            return False
        
        # 只记录 API 路径
        if not request.url.path.startswith("/api/"):
            logger.debug(f"跳过操作日志记录（非API路径）: {request.url.path}")
            return False
        
        # 只记录非 GET 请求（或者根据需求调整）
        # 这里记录所有请求，包括 GET
        logger.info(f"需要记录操作日志: {request.method} {request.url.path}")
        return True
    
    async def _log_operation(
        self,
        request: Request,
        response: Response
    ) -> None:
        """
        记录操作日志
        
        Args:
            request: 请求对象
            response: 响应对象
        """
        try:
            # 从 Token 中解析 tenant_id 和 user_id
            tenant_id = None
            user_id = None
            
            try:
                from infra.domain.security.security import get_token_payload
                from infra.models.user import User
                
                # 获取 Token
                authorization = request.headers.get("Authorization")
                if authorization and authorization.startswith("Bearer "):
                    token = authorization.replace("Bearer ", "")
                    payload = get_token_payload(token)
                    if payload:
                        # 从 Token 中获取 tenant_id
                        tenant_id = payload.get("tenant_id")
                        if tenant_id:
                            tenant_id = int(tenant_id)
                        
                        # 从 Token 中获取 user_id（sub 字段是用户ID，不是UUID）
                        user_id_str = payload.get("sub")
                        if user_id_str:
                            try:
                                # sub 字段存储的是用户ID（数字），直接转换为整数
                                user_id = int(user_id_str)
                                # 验证用户是否存在（可选，但建议验证）
                                user = await User.get_or_none(id=user_id)
                                if not user:
                                    logger.warning(
                                        f"无法找到用户: user_id={user_id}, path={request.url.path}"
                                    )
                                    user_id = None  # 用户不存在，设置为None
                            except (ValueError, TypeError) as e:
                                logger.warning(
                                    f"无法解析用户ID: sub={user_id_str}, path={request.url.path}, error={e}"
                                )
                                user_id = None
                        else:
                            logger.warning(
                                f"Token中缺少sub字段: path={request.url.path}"
                            )
                    else:
                        logger.warning(
                            f"无法解析Token payload: path={request.url.path}"
                        )
                else:
                    logger.warning(
                        f"请求中缺少Authorization头或格式不正确: path={request.url.path}"
                    )
            except Exception as e:
                # 如果无法获取，记录详细错误信息
                logger.error(
                    f"获取tenant_id或user_id失败: path={request.url.path}, error={e}",
                    exc_info=True
                )
            
            # 如果无法获取组织ID或用户ID，跳过记录
            if not tenant_id or not user_id:
                # 使用print确保能看到（即使日志配置有问题）
                print(f"⚠️ 跳过操作日志记录: tenant_id={tenant_id}, user_id={user_id}, path={request.url.path}, method={request.method}")
                logger.warning(
                    f"跳过操作日志记录: tenant_id={tenant_id}, user_id={user_id}, "
                    f"path={request.url.path}, method={request.method}"
                )
                return
            
            # 解析操作类型和模块
            operation_type = self._parse_operation_type(request.method, response.status_code)
            operation_module = self._parse_operation_module(request.url.path)
            operation_object_type = self._parse_operation_object_type(request.url.path)
            
            # 从请求路径中提取操作对象的 UUID（如果存在）
            operation_object_uuid = self._parse_operation_object_uuid(request.url.path)
            
            # 获取操作内容（包含操作结果）
            operation_result = "成功" if response.status_code < 400 else "失败"
            operation_content = f"{request.method} {request.url.path} - {operation_result} (状态码: {response.status_code})"
            
            # 记录操作日志信息（INFO级别，确保能看到）
            logger.info(
                f"记录操作日志: tenant_id={tenant_id}, user_id={user_id}, "
                f"operation_type={operation_type}, operation_module={operation_module}, "
                f"operation_object_type={operation_object_type}, operation_object_uuid={operation_object_uuid}, "
                f"path={request.url.path}"
            )
            
            # 获取 IP 地址
            ip_address = self._get_client_ip(request)
            
            # 获取用户代理
            user_agent = request.headers.get("User-Agent", "")
            
            # 创建操作日志
            print(f"[操作日志中间件] 准备创建操作日志: tenant_id={tenant_id}, user_id={user_id}, operation_type={operation_type}")
            try:
                operation_log = await OperationLogService.create_operation_log(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    operation_type=operation_type,
                    operation_module=operation_module,
                    operation_object_type=operation_object_type,
                    operation_object_uuid=operation_object_uuid,
                    operation_content=operation_content,
                    ip_address=ip_address,
                    user_agent=user_agent,
                    request_method=request.method,
                    request_path=request.url.path,
                )
                # 使用print确保能看到（即使日志配置有问题）
                print(f"✅ 操作日志创建成功: id={operation_log.id}, uuid={operation_log.uuid}, path={request.url.path}")
                try:
                    logger.info(
                        f"操作日志创建成功: id={operation_log.id}, uuid={operation_log.uuid}, "
                        f"path={request.url.path}"
                    )
                except:
                    pass
            except Exception as create_error:
                # 使用print确保能看到错误（即使日志配置有问题）
                print(f"❌ 创建操作日志失败: path={request.url.path}, method={request.method}, tenant_id={tenant_id}, user_id={user_id}")
                print(f"错误详情: {create_error}")
                import traceback
                print(traceback.format_exc())
                # 记录创建操作日志时的详细错误
                try:
                    logger.error(
                        f"创建操作日志失败: path={request.url.path}, method={request.method}, "
                        f"tenant_id={tenant_id}, user_id={user_id}, error={create_error}",
                        exc_info=True
                    )
                except:
                    pass
                # 重新抛出异常，让外层异常处理捕获
                raise
            
            # 更新用户活动时间（直接 await，确保执行）
            # 注意：这里直接 await 而不是使用 create_task，确保数据一定被写入
            # 虽然会稍微影响响应时间，但能保证数据一致性
            try:
                from core.services.logging.online_user_service import OnlineUserService
                # 直接 await 确保数据写入，避免异步任务未执行的问题
                await OnlineUserService.update_user_activity(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    login_ip=ip_address,
                )
                logger.debug(
                    f"用户活动时间已更新: tenant_id={tenant_id}, "
                    f"user_id={user_id}, path={request.url.path}"
                )
            except Exception as e:
                # 更新活动时间失败不影响业务，记录错误日志
                logger.error(
                    f"更新用户活动时间失败: tenant_id={tenant_id}, "
                    f"user_id={user_id}, error={e}",
                    exc_info=True
                )
        except Exception as e:
            # 日志记录失败不影响业务，但需要详细记录错误信息以便排查
            logger.error(
                f"记录操作日志失败: path={request.url.path}, method={request.method}, "
                f"tenant_id={tenant_id}, user_id={user_id}, error={e}",
                exc_info=True
            )
    
    def _parse_operation_type(self, method: str, status_code: int) -> str:
        """
        解析操作类型
        
        Args:
            method: HTTP 方法
            status_code: HTTP 状态码
            
        Returns:
            str: 操作类型
        """
        # 如果请求失败，返回 error
        if status_code >= 400:
            return "error"
        
        # 根据 HTTP 方法解析操作类型
        method_map = {
            "GET": "view",
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }
        return method_map.get(method, "unknown")
    
    def _parse_operation_module(self, path: str) -> Optional[str]:
        """
        解析操作模块
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作模块
        """
        # 从路径中提取模块名称
        # 例如：/api/v1/core/users -> core
        # 例如：/api/v1/personal/profile -> personal
        # 例如：/api/v1/apps/master-data/factory/plants -> apps/master-data/factory
        parts = path.split("/")
        if len(parts) >= 4:
            # /api/v1/{module}/...
            module = parts[3]
            if len(parts) >= 5:
                # /api/v1/{module}/{submodule}/...
                submodule = parts[4]
                # 如果是应用路由 (/api/v1/apps/{app_code}/...)，需要包含更多层级
                if module == "apps" and len(parts) >= 6:
                    # /api/v1/apps/{app_code}/{resource}/...
                    resource = parts[5]
                    return f"{module}/{submodule}/{resource}"
                return f"{module}/{submodule}"
            return module
        return None
    
    def _parse_operation_object_type(self, path: str) -> Optional[str]:
        """
        解析操作对象类型
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作对象类型
        """
        # 从路径中提取对象类型
        # 例如：/api/v1/core/users -> User
        # 例如：/api/v1/personal/profile -> UserProfile
        # 例如：/api/v1/apps/master-data/factory/plants -> Plant
        parts = path.split("/")
        
        # 处理应用路由路径 (/api/v1/apps/{app_code}/{resource}/{object})
        if len(parts) >= 6 and parts[3] == "apps":
            # /api/v1/apps/{app_code}/{resource}/{object}
            # 例如：/api/v1/apps/master-data/factory/plants -> Plant
            object_name = parts[5]
        elif len(parts) >= 5:
            # /api/v1/{module}/{object}/
            # 例如：/api/v1/core/users -> User
            object_name = parts[4]
        else:
            return None
        
        # 转换为类名（首字母大写，单数形式）
        # 处理复数形式：plants -> Plant, users -> User
        if object_name.endswith('s') and len(object_name) > 1:
            # 简单处理：去掉末尾的 's'
            object_name = object_name[:-1]
        
        # 处理连字符：production-lines -> ProductionLine
        if '-' in object_name:
            # 将连字符分隔的单词转换为驼峰命名
            words = object_name.split('-')
            object_name = ''.join(word.capitalize() for word in words)
        else:
            object_name = object_name.capitalize()
        
        return object_name
    
    def _parse_operation_object_uuid(self, path: str) -> Optional[str]:
        """
        从请求路径中提取操作对象的 UUID
        
        Args:
            path: 请求路径
            
        Returns:
            Optional[str]: 操作对象 UUID
        """
        # 从路径中提取 UUID（如果存在）
        # 例如：/api/v1/core/users/{uuid} -> uuid
        # 例如：/api/v1/core/users/{uuid}/roles -> uuid
        import re
        # UUID 格式：8-4-4-4-12 十六进制字符
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        match = re.search(uuid_pattern, path, re.IGNORECASE)
        if match:
            return match.group(0)
        return None
    
    def _get_client_ip(self, request: Request) -> Optional[str]:
        """
        获取客户端真实IP地址（优先获取外网IP）
        
        优先级：X-Forwarded-For > X-Real-IP > request.client.host
        
        Args:
            request: 请求对象
            
        Returns:
            Optional[str]: 客户端 IP 地址
        """
        # 1. 优先从 X-Forwarded-For 获取（代理服务器转发，第一个IP通常是客户端真实IP）
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # X-Forwarded-For 可能包含多个 IP（代理链），格式：client, proxy1, proxy2
            # 取第一个 IP（客户端真实IP）
            return forwarded_for.split(",")[0].strip()
        
        # 2. 如果 X-Forwarded-For 不存在，从 X-Real-IP 获取（Nginx 等代理服务器）
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # 3. 最后从 request.client.host 获取（直接连接，可能是内网IP）
        if request.client:
            return request.client.host
        
        return None



