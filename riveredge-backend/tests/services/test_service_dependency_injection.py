"""
服务依赖注入测试

测试API路由中的服务依赖注入功能。

Author: Luigi Lu
Date: 2025-12-27
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.api.deps.service_helpers import get_user_service_with_fallback


@pytest.fixture
def app():
    """创建测试应用"""
    from server.main import app
    return app


@pytest.fixture
def client(app):
    """创建测试客户端"""
    return TestClient(app)


def test_get_user_service_with_fallback():
    """测试用户服务获取（带回退）"""
    user_service = get_user_service_with_fallback()
    
    assert user_service is not None
    # 检查是否有 create_user 方法
    assert hasattr(user_service, "create_user")
    assert hasattr(user_service, "get_user_list")
    assert hasattr(user_service, "get_user_by_uuid")


@pytest.mark.asyncio
async def test_user_service_adapter():
    """测试用户服务适配器"""
    from core.api.deps.service_helpers import get_user_service_with_fallback
    
    user_service = get_user_service_with_fallback()
    
    # 测试适配器方法存在
    assert callable(user_service.create_user)
    assert callable(user_service.get_user_list)
    assert callable(user_service.get_user_by_uuid)

