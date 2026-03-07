"""
平台超级管理员认证 API 模块

提供平台超级管理员认证相关的 RESTful API 接口。

Author: Luigi Lu
Date: 2025-12-27
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from infra.schemas.infra_superadmin import (
    InfraSuperAdminLoginRequest,
    InfraSuperAdminLoginResponse
)
from infra.services.infra_superadmin_auth_service import InfraSuperAdminAuthService
from infra.api.deps.deps import get_current_infra_superadmin
from infra.models.infra_superadmin import InfraSuperAdmin
from infra.schemas.infra_superadmin import InfraSuperAdminResponse

# 创建路由
router = APIRouter(prefix="/auth", tags=["Infra Admin Auth"])


def _get_client_ip(request: Request) -> str:
    """从请求中提取客户端 IP"""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "0.0.0.0"


@router.post("/login", response_model=InfraSuperAdminLoginResponse)
async def infra_superadmin_login(data: InfraSuperAdminLoginRequest, request: Request):
    """
    平台超级管理员登录接口
    
    验证平台超级管理员凭据并返回 JWT Token（不包含 tenant_id）。
    平台超级管理员是平台唯一的，独立于租户系统。
    
    Args:
        data: 平台超级管理员登录请求数据（username, password）
        
    Returns:
        InfraSuperAdminLoginResponse: 登录成功的响应数据（包含 access_token 和用户信息）
        
    Raises:
        HTTPException: 当用户名或密码错误时抛出
        
    Example:
        ```json
        {
            "username": "infra_admin",
            "password": "password123"
        }
        ```
    """
    from loguru import logger

    # 记录接收到的登录请求（不输出密码明文，只输出长度）
    logger.info(f"收到登录请求: username={data.username}, password_length={len(data.password) if data.password else 0}")

    service = InfraSuperAdminAuthService()
    result = await service.login(data)

    # 记录平台超级管理员登录日志（用于运营看板统计）
    try:
        from core.services.interfaces.service_registry import ServiceLocator
        from core.utils.ip_parser import parse_ip_info

        login_ip = _get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "")
        ip_info = {}
        try:
            ip_info = await parse_ip_info(login_ip, user_agent)
        except Exception:
            pass

        if ServiceLocator.has_service("audit_log_service"):
            audit_log_service = ServiceLocator.get_service("audit_log_service")
            await audit_log_service.log_login_event(
                tenant_id=None,
                user_id=None,
                username=data.username,
                login_ip=login_ip,
                user_agent=user_agent,
                login_location=ip_info.get("location"),
                login_device=ip_info.get("device"),
                login_browser=ip_info.get("browser"),
                success=True,
                failure_reason=None,
            )
    except Exception as e:
        logger.warning(f"记录平台超级管理员登录日志失败: {e}")

    return InfraSuperAdminLoginResponse(**result)


@router.get("/me", response_model=InfraSuperAdminResponse)
async def get_current_infra_superadmin_info(
    current_admin: InfraSuperAdmin = Depends(get_current_infra_superadmin)
):
    """
    获取当前平台超级管理员信息
    
    返回当前登录的平台超级管理员信息。
    
    Args:
        current_admin: 当前平台超级管理员对象（通过依赖注入获取）
        
    Returns:
        InfraSuperAdminResponse: 平台超级管理员信息
    """
    return InfraSuperAdminResponse.model_validate(current_admin)

