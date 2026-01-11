"""
审计日志服务接口实现

实现审计日志服务接口，封装core层的LoginLogService和OperationLogService，
为infra层提供统一的接口调用方式。
"""

from typing import Dict, Any, Optional
from datetime import datetime

from ..service_interface import AuditLogServiceInterface
from ..service_registry import service_implementation
from ...logging.login_log_service import LoginLogService
from ...logging.operation_log_service import OperationLogService
from core.schemas.login_log import LoginLogCreate


@service_implementation(AuditLogServiceInterface)
class AuditLogServiceImpl(AuditLogServiceInterface):
    """
    审计日志服务实现类

    封装LoginLogService和OperationLogService，提供统一的接口调用。
    """

    def __init__(self):
        self._login_log_service = LoginLogService()
        self._operation_log_service = OperationLogService()

    async def health_check(self) -> Dict[str, Any]:
        """服务健康检查"""
        return {
            "service": self.service_name,
            "version": self.service_version,
            "status": "healthy",
            "implementation": "AuditLogServiceImpl",
        }

    async def log_login_event(
        self,
        tenant_id: int,
        user_id: int,
        username: str,
        login_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        login_location: Optional[str] = None,
        login_device: Optional[str] = None,
        login_browser: Optional[str] = None,
        success: bool = True,
        failure_reason: Optional[str] = None,
    ) -> None:
        """
        记录登录事件

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            username: 用户名
            login_ip: 登录IP
            user_agent: 用户代理
            login_location: 登录地点（IP地理位置，可选）
            login_device: 登录设备（PC、Mobile等，可选）
            login_browser: 登录浏览器（可选）
            success: 是否成功
            failure_reason: 失败原因
        """
        # ⚠️ 关键修复：将 success 布尔值转换为 login_status 字符串
        login_status = "success" if success else "failed"
        
        login_log_data = LoginLogCreate(
            tenant_id=tenant_id if tenant_id != 0 else None,  # 0 表示未提供，应该为 None
            user_id=user_id if user_id != 0 else None,  # 0 表示未提供，应该为 None
            username=username,
            login_ip=login_ip or "0.0.0.0",  # 确保有默认值
            login_location=login_location,  # IP地理位置
            login_device=login_device,  # 设备类型
            login_browser=login_browser,  # 浏览器信息
            login_status=login_status,
            failure_reason=failure_reason,
        )

        await self._login_log_service.create_login_log(login_log_data)

    async def log_operation_event(
        self,
        tenant_id: int,
        user_id: int,
        operation: str,
        resource: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
    ) -> None:
        """
        记录操作事件

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            operation: 操作类型
            resource: 资源类型
            resource_id: 资源ID
            details: 操作详情
            ip_address: IP地址
        """
        # 这里需要创建OperationLog的创建数据结构
        # 由于OperationLog模型可能还没有定义，让我先创建一个基本的实现
        from core.schemas.operation_log import OperationLogCreate

        operation_log_data = OperationLogCreate(
            tenant_id=tenant_id,
            user_id=user_id,
            operation=operation,
            resource=resource,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
        )

        await self._operation_log_service.create_operation_log(operation_log_data)
