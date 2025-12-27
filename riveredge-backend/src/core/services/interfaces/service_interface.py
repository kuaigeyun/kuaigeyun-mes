"""
服务接口层 - 定义各层之间的服务接口契约

提供统一的接口定义，确保层间解耦合和可替换性。
所有服务接口都继承自此基类。
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, TypeVar, Generic
from datetime import datetime

# 服务接口的返回类型
T = TypeVar('T')


class ServiceInterface(ABC):
    """
    服务接口基类

    所有服务接口都应继承此类，提供基本的服务接口定义。
    """

    @property
    @abstractmethod
    def service_name(self) -> str:
        """服务名称"""
        pass

    @property
    @abstractmethod
    def service_version(self) -> str:
        """服务版本"""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """
        服务健康检查

        Returns:
            Dict[str, Any]: 健康状态信息
        """
        pass


class UserActivityServiceInterface(ServiceInterface):
    """
    用户活动服务接口

    定义用户活动记录相关的服务接口，由core层实现，infra层使用。
    """
    service_name = "user_activity_service"
    service_version = "1.0.0"

    @abstractmethod
    async def update_user_activity(
        self,
        tenant_id: int,
        user_id: int,
        login_ip: Optional[str] = None,
        login_time: Optional[datetime] = None,
    ) -> None:
        """
        更新用户活动时间

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            login_ip: 登录IP（可选）
            login_time: 登录时间（可选）
        """
        pass

    @abstractmethod
    async def get_user_last_activity(
        self,
        tenant_id: int,
        user_id: int,
    ) -> Optional[datetime]:
        """
        获取用户最后活动时间

        Args:
            tenant_id: 组织ID
            user_id: 用户ID

        Returns:
            Optional[datetime]: 最后活动时间
        """
        pass

    @abstractmethod
    async def is_user_online(
        self,
        tenant_id: int,
        user_id: int,
        threshold_minutes: int = 30,
    ) -> bool:
        """
        检查用户是否在线

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            threshold_minutes: 在线判断阈值（分钟）

        Returns:
            bool: 是否在线
        """
        pass


class AuditLogServiceInterface(ServiceInterface):
    """
    审计日志服务接口

    定义审计日志记录相关的服务接口，由core层实现，infra层使用。
    """
    service_name = "audit_log_service"
    service_version = "1.0.0"

    @abstractmethod
    async def log_login_event(
        self,
        tenant_id: int,
        user_id: int,
        username: str,
        login_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
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
            success: 是否成功
            failure_reason: 失败原因
        """
        pass

    @abstractmethod
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
        pass


class ApplicationServiceInterface(ServiceInterface):
    """
    应用服务接口

    定义应用管理相关的服务接口，由core层实现，各层使用。
    """
    service_name = "application_service"
    service_version = "1.0.0"

    @abstractmethod
    async def get_installed_applications(
        self,
        tenant_id: int,
        is_active: Optional[bool] = None,
    ) -> list:
        """
        获取已安装的应用列表

        Args:
            tenant_id: 组织ID
            is_active: 是否启用过滤（可选）

        Returns:
            list: 应用列表
        """
        pass

    @abstractmethod
    async def is_application_active(
        self,
        tenant_id: int,
        app_code: str,
    ) -> bool:
        """
        检查应用是否启用

        Args:
            tenant_id: 组织ID
            app_code: 应用代码

        Returns:
            bool: 是否启用
        """
        pass


class NotificationServiceInterface(ServiceInterface):
    """
    通知服务接口

    定义消息通知相关的服务接口，由core层实现，各层使用。
    """
    service_name = "notification_service"
    service_version = "1.0.0"

    @abstractmethod
    async def send_notification(
        self,
        tenant_id: int,
        user_id: int,
        title: str,
        content: str,
        notification_type: str = "info",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        发送通知

        Args:
            tenant_id: 组织ID
            user_id: 用户ID
            title: 通知标题
            content: 通知内容
            notification_type: 通知类型
            metadata: 元数据
        """
        pass

    @abstractmethod
    async def broadcast_notification(
        self,
        tenant_id: int,
        title: str,
        content: str,
        notification_type: str = "info",
        target_user_ids: Optional[list] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        广播通知

        Args:
            tenant_id: 组织ID
            title: 通知标题
            content: 通知内容
            notification_type: 通知类型
            target_user_ids: 目标用户ID列表（None表示全部用户）
            metadata: 元数据
        """
        pass


class UserServiceInterface(ServiceInterface):
    """
    用户服务接口
    
    定义用户管理相关的服务接口，由core层实现，各层使用。
    ⚠️ 第二阶段改进：为高频使用的服务定义接口
    """
    service_name = "user_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def create_user(
        self,
        tenant_id: int,
        data: Any,  # UserCreate
        current_user_id: int
    ) -> Any:  # User
        """
        创建用户
        
        Args:
            tenant_id: 组织ID
            data: 用户创建数据
            current_user_id: 当前用户ID
            
        Returns:
            User: 创建的用户对象
        """
        pass
    
    @abstractmethod
    async def get_user_by_uuid(
        self,
        tenant_id: int,
        uuid: str
    ) -> Any:  # User
        """
        根据UUID获取用户
        
        Args:
            tenant_id: 组织ID
            uuid: 用户UUID
            
        Returns:
            User: 用户对象
        """
        pass
    
    @abstractmethod
    async def get_user_list(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        department_uuid: Optional[str] = None,
        position_uuid: Optional[str] = None,
        is_active: Optional[bool] = None,
        is_tenant_admin: Optional[bool] = None,
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取用户列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            department_uuid: 部门UUID筛选
            position_uuid: 职位UUID筛选
            is_active: 是否激活筛选
            is_tenant_admin: 是否组织管理员筛选
            current_user_id: 当前用户ID
            
        Returns:
            dict: 用户列表响应数据
        """
        pass


class RoleServiceInterface(ServiceInterface):
    """
    角色服务接口
    
    定义角色管理相关的服务接口，由core层实现，各层使用。
    ⚠️ 第二阶段改进：为高频使用的服务定义接口
    """
    service_name = "role_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def create_role(
        self,
        tenant_id: int,
        data: Any,  # RoleCreate
        current_user_id: int
    ) -> Any:  # Role
        """
        创建角色
        
        Args:
            tenant_id: 组织ID
            data: 角色创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Role: 创建的角色对象
        """
        pass
    
    @abstractmethod
    async def get_role_by_uuid(
        self,
        tenant_id: int,
        uuid: str
    ) -> Any:  # Role
        """
        根据UUID获取角色
        
        Args:
            tenant_id: 组织ID
            uuid: 角色UUID
            
        Returns:
            Role: 角色对象
        """
        pass
    
    @abstractmethod
    async def get_role_list(
        self,
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        keyword: Optional[str] = None,
        current_user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        获取角色列表
        
        Args:
            tenant_id: 组织ID
            page: 页码
            page_size: 每页数量
            keyword: 关键词搜索
            current_user_id: 当前用户ID
            
        Returns:
            dict: 角色列表响应数据
        """
        pass


class MessageServiceInterface(ServiceInterface):
    """
    消息服务接口
    
    定义消息发送相关的服务接口，由core层实现，各层使用。
    ⚠️ 第二阶段改进：为高频使用的服务定义接口
    """
    service_name = "message_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def send_message(
        self,
        tenant_id: int,
        request: Any  # SendMessageRequest
    ) -> Any:  # SendMessageResponse
        """
        发送消息
        
        Args:
            tenant_id: 组织ID
            request: 发送消息请求
            
        Returns:
            SendMessageResponse: 发送消息响应
        """
        pass