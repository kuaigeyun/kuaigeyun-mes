"""
超级管理员 API 测试

测试超级管理员认证和租户管理功能
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from loguru import logger
from tortoise import Tortoise

from fastapi.testclient import TestClient
from app.main import app
from models.user import User
from models.tenant import Tenant, TenantStatus
from services.superadmin_service import SuperAdminService
from services.superadmin_auth_service import SuperAdminAuthService
from core.database import TORTOISE_ORM
from core.cache import Cache


@pytest_asyncio.fixture(scope="function")
async def setup_test_data():
    """
    测试数据准备
    
    创建测试用的超级管理员和租户
    """
    # 初始化数据库连接
    await Tortoise.init(config=TORTOISE_ORM)
    
    # 初始化 Redis 连接（用于监控服务）
    try:
        await Cache.connect()
    except Exception as e:
        logger.warning(f"Redis 连接失败（测试可能跳过需要 Redis 的功能）: {e}")
    
    # 创建测试超级管理员
    service = SuperAdminService()
    from schemas.superadmin import SuperAdminCreate
    
    try:
        admin = await service.create_superadmin(
            SuperAdminCreate(
                username="test_superadmin",
                password="test_password_123",
                email="test_superadmin@example.com",
                full_name="测试超级管理员",
                is_active=True,
            )
        )
        logger.info(f"创建测试超级管理员: {admin.username} (ID: {admin.id})")
    except Exception as e:
        # 如果已存在，则获取
        admin = await service.get_superadmin_by_username("test_superadmin")
        if not admin:
            raise e
        logger.info(f"使用现有超级管理员: {admin.username} (ID: {admin.id})")
    
    # 创建测试租户（用于审核测试）
    from services.tenant_service import TenantService
    from schemas.tenant import TenantCreate
    tenant_service = TenantService()
    try:
        tenant = await tenant_service.create_tenant(
            TenantCreate(
                name="测试租户（待审核）",
                domain="test-tenant-pending",
                status=TenantStatus.INACTIVE,
            )
        )
        logger.info(f"创建测试租户: {tenant.name} (ID: {tenant.id})")
    except Exception as e:
        # 如果已存在，则获取
        tenant = await Tenant.get_or_none(domain="test-tenant-pending")
        if not tenant:
            raise e
        logger.info(f"使用现有租户: {tenant.name} (ID: {tenant.id})")
    
    yield {
        "admin": admin,
        "tenant": tenant,
    }
    
    # 清理连接
    try:
        await Cache.disconnect()
    except Exception:
        pass
    await Tortoise.close_connections()


@pytest.mark.asyncio
async def test_superadmin_login_success(setup_test_data):
    """
    测试超级管理员登录成功
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["username"] == "test_superadmin"
        # 注意：SuperAdminResponse 不包含 is_superadmin 字段，因为这是从 Token 中获取的
        
        logger.info("✅ 超级管理员登录测试通过")


@pytest.mark.asyncio
async def test_superadmin_login_failed(setup_test_data):
    """
    测试超级管理员登录失败（密码错误）
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "wrong_password",
            }
        )
        
        assert response.status_code == 401
        logger.info("✅ 超级管理员登录失败测试通过（密码错误）")


@pytest.mark.asyncio
async def test_get_current_superadmin(setup_test_data):
    """
    测试获取当前超级管理员信息
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 使用 Token 获取当前用户信息
        response = await client.get(
            "/api/v1/superadmin/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "test_superadmin"
        assert data["is_active"] is True
        
        logger.info("✅ 获取当前超级管理员信息测试通过")


@pytest.mark.asyncio
async def test_list_tenants_for_superadmin(setup_test_data):
    """
    测试超级管理员获取租户列表
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 获取租户列表
        response = await client.get(
            "/api/v1/superadmin/tenants",
            headers={"Authorization": f"Bearer {token}"},
            params={"page": 1, "page_size": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert isinstance(data["items"], list)
        
        logger.info(f"✅ 超级管理员获取租户列表测试通过（共 {data['total']} 个租户）")


@pytest.mark.asyncio
async def test_approve_tenant_registration(setup_test_data):
    """
    测试审核通过租户注册
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 获取测试租户
        test_data = setup_test_data
        tenant_id = test_data["tenant"].id
        
        # 确保租户状态为 INACTIVE
        tenant = await Tenant.get(id=tenant_id)
        tenant.status = TenantStatus.INACTIVE
        await tenant.save()
        
        # 审核通过租户注册
        response = await client.post(
            f"/api/v1/superadmin/tenants/{tenant_id}/approve",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == TenantStatus.ACTIVE.value
        
        # 验证租户状态已更新
        tenant = await Tenant.get(id=tenant_id)
        assert tenant.status == TenantStatus.ACTIVE
        
        logger.info(f"✅ 审核通过租户注册测试通过（租户 ID: {tenant_id}）")


@pytest.mark.asyncio
async def test_reject_tenant_registration(setup_test_data):
    """
    测试审核拒绝租户注册
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 创建新的测试租户用于拒绝测试
        from services.tenant_service import TenantService
        from schemas.tenant import TenantCreate
        tenant_service = TenantService()
        
        # 先删除可能存在的测试租户
        existing_tenant = await Tenant.get_or_none(domain="test-tenant-reject")
        if existing_tenant:
            await existing_tenant.delete()
        
        test_tenant = await tenant_service.create_tenant(
            TenantCreate(
                name="测试租户（待拒绝）",
                domain="test-tenant-reject",
                status=TenantStatus.INACTIVE,
            )
        )
        
        # 审核拒绝租户注册
        response = await client.post(
            f"/api/v1/superadmin/tenants/{test_tenant.id}/reject",
            headers={"Authorization": f"Bearer {token}"},
            params={"reason": "测试拒绝原因"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == TenantStatus.SUSPENDED.value
        
        # 验证租户状态已更新
        tenant = await Tenant.get(id=test_tenant.id)
        assert tenant.status == TenantStatus.SUSPENDED
        
        logger.info(f"✅ 审核拒绝租户注册测试通过（租户 ID: {test_tenant.id}）")


@pytest.mark.asyncio
async def test_get_tenant_statistics(setup_test_data):
    """
    测试获取租户统计信息
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 获取租户统计信息
        response = await client.get(
            "/api/v1/superadmin/monitoring/tenants/statistics",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "by_status" in data
        assert "by_plan" in data
        assert "updated_at" in data
        assert isinstance(data["total"], int)
        assert isinstance(data["by_status"], dict)
        assert isinstance(data["by_plan"], dict)
        
        logger.info(f"✅ 获取租户统计信息测试通过（总租户数: {data['total']}）")


@pytest.mark.asyncio
async def test_get_system_status(setup_test_data):
    """
    测试获取系统运行状态
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 获取系统运行状态
        response = await client.get(
            "/api/v1/superadmin/monitoring/system/status",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "database" in data
        assert "redis" in data
        assert "updated_at" in data
        
        logger.info(f"✅ 获取系统运行状态测试通过（状态: {data['status']}）")


@pytest.mark.asyncio
async def test_superadmin_cross_tenant_access(setup_test_data):
    """
    测试超级管理员跨租户访问能力
    
    验证超级管理员可以访问所有租户的数据，不受 tenant_id 限制
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 获取所有租户列表（应该能看到所有租户，不受 tenant_id 限制）
        response = await client.get(
            "/api/v1/superadmin/tenants",
            headers={"Authorization": f"Bearer {token}"},
            params={"page": 1, "page_size": 100}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 验证可以访问多个租户（如果有多个租户）
        assert len(data["items"]) >= 1
        
        # 验证 Token 中不包含 tenant_id（超级管理员 Token 特性）
        from jose import jwt
        from app.config import settings
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        assert "is_superadmin" in payload
        assert payload["is_superadmin"] is True
        # ⭐ 关键：超级管理员 Token 不包含 tenant_id
        assert "tenant_id" not in payload or payload.get("tenant_id") is None
        
        logger.info("✅ 超级管理员跨租户访问测试通过")


@pytest.mark.asyncio
async def test_activate_deactivate_tenant(setup_test_data):
    """
    测试激活和停用租户
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 先登录获取 Token
        login_response = await client.post(
            "/api/v1/superadmin/auth/login",
            json={
                "username": "test_superadmin",
                "password": "test_password_123",
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # 创建测试租户
        from services.tenant_service import TenantService
        from schemas.tenant import TenantCreate
        tenant_service = TenantService()
        
        # 先删除可能存在的测试租户
        existing_tenant = await Tenant.get_or_none(domain="test-tenant-activate")
        if existing_tenant:
            await existing_tenant.delete()
        
        test_tenant = await tenant_service.create_tenant(
            TenantCreate(
                name="测试租户（激活停用）",
                domain="test-tenant-activate",
                status=TenantStatus.INACTIVE,
            )
        )
        
        # 激活租户
        response = await client.post(
            f"/api/v1/superadmin/tenants/{test_tenant.id}/activate",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == TenantStatus.ACTIVE.value
        
        # 验证租户状态
        tenant = await Tenant.get(id=test_tenant.id)
        assert tenant.status == TenantStatus.ACTIVE
        
        # 停用租户
        response = await client.post(
            f"/api/v1/superadmin/tenants/{test_tenant.id}/deactivate",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == TenantStatus.INACTIVE.value
        
        # 验证租户状态
        tenant = await Tenant.get(id=test_tenant.id)
        assert tenant.status == TenantStatus.INACTIVE
        
        logger.info(f"✅ 激活和停用租户测试通过（租户 ID: {test_tenant.id}）")

