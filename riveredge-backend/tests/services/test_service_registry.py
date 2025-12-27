"""
服务注册表测试

测试服务注册、获取和健康检查功能。

Author: Luigi Lu
Date: 2025-12-27
"""

import pytest
import asyncio
from core.services.interfaces.service_registry import ServiceLocator, service_registry
from core.services.interfaces.service_interface import (
    UserServiceInterface,
    RoleServiceInterface,
    MessageServiceInterface,
)


@pytest.fixture(scope="module")
async def setup_services():
    """设置测试环境，初始化服务"""
    from infra.infrastructure.database.database import register_db
    from fastapi import FastAPI
    from core.services.interfaces.service_initializer import ServiceInitializer
    
    # 初始化数据库
    temp_app = FastAPI()
    await register_db(temp_app)
    
    # 初始化服务
    await ServiceInitializer.initialize_services()
    
    yield
    
    # 清理（如果需要）


@pytest.mark.asyncio
async def test_service_registration(setup_services):
    """测试服务注册"""
    # 检查服务是否已注册
    assert ServiceLocator.has_service("user_service")
    assert ServiceLocator.has_service("role_service")
    assert ServiceLocator.has_service("message_service")
    assert ServiceLocator.has_service("application_service")
    assert ServiceLocator.has_service("user_activity_service")
    assert ServiceLocator.has_service("audit_log_service")


@pytest.mark.asyncio
async def test_service_retrieval(setup_services):
    """测试服务获取"""
    # 获取服务实例
    user_service = ServiceLocator.get_service("user_service")
    
    assert user_service is not None
    assert isinstance(user_service, UserServiceInterface)
    assert user_service.service_name == "user_service"
    assert user_service.service_version == "1.0.0"


@pytest.mark.asyncio
async def test_service_health_check(setup_services):
    """测试服务健康检查"""
    user_service = ServiceLocator.get_service("user_service")
    
    health = await user_service.health_check()
    
    assert health["status"] == "healthy"
    assert health["service"] == "user_service"
    assert health["version"] == "1.0.0"


@pytest.mark.asyncio
async def test_service_registry_health_check(setup_services):
    """测试服务注册表健康检查"""
    health_info = await service_registry.health_check_all()
    
    assert health_info["overall_healthy"] is True
    assert len(health_info["services"]) > 0


@pytest.mark.asyncio
async def test_service_not_found():
    """测试服务未找到的情况"""
    with pytest.raises(Exception):  # ServiceNotFoundError
        ServiceLocator.get_service("non_existent_service")


@pytest.mark.asyncio
async def test_service_list(setup_services):
    """测试列出所有服务"""
    services = service_registry.list_services()
    
    assert len(services) > 0
    assert "user_service" in services
    assert "role_service" in services

