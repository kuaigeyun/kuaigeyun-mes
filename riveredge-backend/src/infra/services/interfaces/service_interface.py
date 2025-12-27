"""
平台级服务接口定义

定义平台级服务的统一接口，支持依赖注入和测试替换。

Author: Luigi Lu
Date: 2025-12-27
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class InfraServiceInterface(ABC):
    """
    平台级服务接口基类
    
    所有平台级服务接口都应继承此类。
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
            Dict[str, Any]: 健康检查结果
        """
        pass


class AuthServiceInterface(InfraServiceInterface):
    """
    认证服务接口
    
    提供用户认证相关的服务接口。
    """
    
    service_name = "auth_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def login(self, data: Any, request: Any) -> Dict[str, Any]:
        """
        用户登录
        
        Args:
            data: 登录请求数据
            request: 请求对象
            
        Returns:
            Dict[str, Any]: 登录响应数据
        """
        pass
    
    @abstractmethod
    async def register(self, data: Any) -> Any:
        """
        用户注册
        
        Args:
            data: 注册请求数据
            
        Returns:
            注册的用户对象
        """
        pass
    
    @abstractmethod
    async def guest_login(self) -> Dict[str, Any]:
        """
        体验登录
        
        Returns:
            Dict[str, Any]: 登录响应数据
        """
        pass
    
    @abstractmethod
    async def register_personal(self, data: Any) -> Dict[str, Any]:
        """
        个人注册
        
        Args:
            data: 个人注册请求数据
            
        Returns:
            Dict[str, Any]: 注册响应数据
        """
        pass
    
    @abstractmethod
    async def register_organization(self, data: Any) -> Dict[str, Any]:
        """
        组织注册
        
        Args:
            data: 组织注册请求数据
            
        Returns:
            Dict[str, Any]: 注册响应数据
        """
        pass


class TenantServiceInterface(InfraServiceInterface):
    """
    组织服务接口
    
    提供组织管理相关的服务接口。
    """
    
    service_name = "tenant_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def list_tenants(
        self,
        page: int = 1,
        page_size: int = 10,
        status: Optional[Any] = None,
        plan: Optional[Any] = None,
        name: Optional[str] = None,
        domain: Optional[str] = None,
        sort: Optional[str] = None,
        order: Optional[str] = None,
        skip_tenant_filter: bool = False
    ) -> Dict[str, Any]:
        """
        获取组织列表
        
        Args:
            page: 页码
            page_size: 每页数量
            status: 组织状态筛选
            plan: 组织套餐筛选
            name: 组织名称搜索
            domain: 域名搜索
            sort: 排序字段
            order: 排序顺序
            skip_tenant_filter: 是否跳过组织过滤
            
        Returns:
            Dict[str, Any]: 组织列表响应数据
        """
        pass
    
    @abstractmethod
    async def get_tenant_by_id(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> Optional[Any]:
        """
        根据ID获取组织
        
        Args:
            tenant_id: 组织ID
            skip_tenant_filter: 是否跳过组织过滤
            
        Returns:
            组织对象，如果不存在则返回None
        """
        pass
    
    @abstractmethod
    async def create_tenant(self, data: Any) -> Any:
        """
        创建组织
        
        Args:
            data: 组织创建数据
            
        Returns:
            创建的组织对象
        """
        pass
    
    @abstractmethod
    async def update_tenant(
        self,
        tenant_id: int,
        data: Any,
        skip_tenant_filter: bool = True
    ) -> Optional[Any]:
        """
        更新组织
        
        Args:
            tenant_id: 组织ID
            data: 组织更新数据
            skip_tenant_filter: 是否跳过组织过滤
            
        Returns:
            更新后的组织对象，如果不存在则返回None
        """
        pass
    
    @abstractmethod
    async def delete_tenant(
        self,
        tenant_id: int,
        skip_tenant_filter: bool = True
    ) -> bool:
        """
        删除组织
        
        Args:
            tenant_id: 组织ID
            skip_tenant_filter: 是否跳过组织过滤
            
        Returns:
            删除成功返回True，否则返回False
        """
        pass


class PackageServiceInterface(InfraServiceInterface):
    """
    套餐服务接口
    
    提供套餐管理相关的服务接口。
    """
    
    service_name = "package_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def list_packages(
        self,
        page: int = 1,
        page_size: int = 10,
        **kwargs
    ) -> Dict[str, Any]:
        """
        获取套餐列表
        
        Args:
            page: 页码
            page_size: 每页数量
            **kwargs: 其他筛选参数
            
        Returns:
            Dict[str, Any]: 套餐列表响应数据
        """
        pass
    
    @abstractmethod
    async def get_package_by_id(self, package_id: int) -> Optional[Any]:
        """
        根据ID获取套餐
        
        Args:
            package_id: 套餐ID
            
        Returns:
            套餐对象，如果不存在则返回None
        """
        pass


class InfraSuperAdminServiceInterface(InfraServiceInterface):
    """
    平台超级管理员服务接口
    
    提供平台超级管理员管理相关的服务接口。
    """
    
    service_name = "infra_superadmin_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def get_current_admin(self) -> Optional[Any]:
        """
        获取当前平台超级管理员
        
        Returns:
            平台超级管理员对象，如果不存在则返回None
        """
        pass
    
    @abstractmethod
    async def create_admin(self, data: Any) -> Any:
        """
        创建平台超级管理员
        
        Args:
            data: 管理员创建数据
            
        Returns:
            创建的管理员对象
        """
        pass
    
    @abstractmethod
    async def update_admin(self, data: Any) -> Any:
        """
        更新平台超级管理员
        
        Args:
            data: 管理员更新数据
            
        Returns:
            更新后的管理员对象
        """
        pass


class SavedSearchServiceInterface(InfraServiceInterface):
    """
    保存搜索服务接口
    
    提供保存搜索条件相关的服务接口。
    """
    
    service_name = "saved_search_service"
    service_version = "1.0.0"
    
    @abstractmethod
    async def list_saved_searches(
        self,
        page: int = 1,
        page_size: int = 10,
        **kwargs
    ) -> Dict[str, Any]:
        """
        获取保存的搜索条件列表
        
        Args:
            page: 页码
            page_size: 每页数量
            **kwargs: 其他筛选参数
            
        Returns:
            Dict[str, Any]: 搜索条件列表响应数据
        """
        pass
    
    @abstractmethod
    async def create_saved_search(self, data: Any) -> Any:
        """
        创建保存的搜索条件
        
        Args:
            data: 搜索条件数据
            
        Returns:
            创建的搜索条件对象
        """
        pass
    
    @abstractmethod
    async def get_saved_search_by_uuid(self, uuid: str) -> Optional[Any]:
        """
        根据UUID获取保存的搜索条件
        
        Args:
            uuid: 搜索条件UUID
            
        Returns:
            搜索条件对象，如果不存在则返回None
        """
        pass
    
    @abstractmethod
    async def update_saved_search(
        self,
        uuid: str,
        data: Any
    ) -> Optional[Any]:
        """
        更新保存的搜索条件
        
        Args:
            uuid: 搜索条件UUID
            data: 更新数据
            
        Returns:
            更新后的搜索条件对象，如果不存在则返回None
        """
        pass
    
    @abstractmethod
    async def delete_saved_search(self, uuid: str) -> bool:
        """
        删除保存的搜索条件
        
        Args:
            uuid: 搜索条件UUID
            
        Returns:
            删除成功返回True，否则返回False
        """
        pass

