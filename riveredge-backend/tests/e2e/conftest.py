"""
端到端测试配置

提供测试所需的fixtures和测试客户端。

优化了事件循环管理和数据库连接配置，解决Windows环境下的测试问题。

Author: Auto (AI Assistant)
Date: 2026-01-03
"""

import pytest
import asyncio
import sys
import os
from pathlib import Path
from typing import AsyncGenerator
from httpx import AsyncClient
from fastapi import FastAPI
from tortoise import Tortoise
from loguru import logger

# 添加src目录到路径
backend_root = Path(__file__).parent.parent.parent
src_path = backend_root / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))

from server.main import app
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.models.user import User
from infra.models.tenant import Tenant, TenantStatus
from core.models.code_rule import CodeRule
from core.services.application.application_registry_service import ApplicationRegistryService
from core.services.application.application_route_manager import get_route_manager, init_route_manager


# 配置事件循环策略（Windows环境优化）
if sys.platform == "win32":
    # Windows下使用ProactorEventLoopPolicy，避免事件循环问题
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())


async def create_test_code_rules(tenant_id: int):
    """
    创建测试所需的编码规则
    
    Args:
        tenant_id: 租户ID
    """
    code_rules_to_create = [
        {
            "name": "销售预测编码规则",
            "code": "SALES_FORECAST_CODE",
            "expression": "SF{YYYY}{MM}{DD}{SEQ:4}",
            "description": "销售预测编码规则，格式：SF202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "销售订单编码规则",
            "code": "SALES_ORDER_CODE",
            "expression": "SO{YYYY}{MM}{DD}{SEQ:4}",
            "description": "销售订单编码规则，格式：SO202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "采购订单编码规则",
            "code": "PURCHASE_ORDER_CODE",
            "expression": "PO{YYYY}{MM}{DD}{SEQ:4}",
            "description": "采购订单编码规则，格式：PO202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "工单编码规则",
            "code": "WORK_ORDER_CODE",
            "expression": "WO{YYYY}{MM}{DD}{SEQ:4}",
            "description": "工单编码规则，格式：WO202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "销售出库单编码规则",
            "code": "SALES_DELIVERY_CODE",
            "expression": "SD{YYYY}{MM}{DD}{SEQ:4}",
            "description": "销售出库单编码规则，格式：SD202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "成品入库单编码规则",
            "code": "FINISHED_GOODS_RECEIPT_CODE",
            "expression": "FGR{YYYY}{MM}{DD}{SEQ:4}",
            "description": "成品入库单编码规则，格式：FGR202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "采购入库单编码规则",
            "code": "PURCHASE_RECEIPT_CODE",
            "expression": "PR{YYYY}{MM}{DD}{SEQ:4}",
            "description": "采购入库单编码规则，格式：PR202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "MRP计划编码规则",
            "code": "MRP_PLAN_CODE",
            "expression": "MRP{YYYY}{MM}{DD}{SEQ:4}",
            "description": "MRP计划编码规则，格式：MRP202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        },
        {
            "name": "LRP计划编码规则",
            "code": "LRP_PLAN_CODE",
            "expression": "LRP{YYYY}{MM}{DD}{SEQ:4}",
            "description": "LRP计划编码规则，格式：LRP202601010001",
            "seq_start": 1,
            "seq_step": 1,
            "seq_reset_rule": "daily",
            "is_active": True
        }
    ]
    
    for rule_data in code_rules_to_create:
        existing_rule = await CodeRule.get_or_none(
            tenant_id=tenant_id,
            code=rule_data["code"],
            deleted_at__isnull=True
        )
        if not existing_rule:
            try:
                await CodeRule.create(
                    tenant_id=tenant_id,
                    **rule_data
                )
            except Exception:
                # 如果创建失败（可能已存在），忽略错误
                pass


@pytest.fixture(scope="function")
async def db_setup():
    """
    数据库设置
    
    为每个测试初始化数据库连接，确保测试隔离。
    """
    try:
        # 初始化数据库连接
        config = TORTOISE_ORM.copy()
        
        # 确保routers字段存在
        if "routers" not in config.get("apps", {}).get("models", {}):
            config.setdefault("apps", {}).setdefault("models", {})["routers"] = []
        
        # 优化连接池配置（测试环境）
        if "connections" in config and "default" in config["connections"]:
            credentials = config["connections"]["default"].get("credentials", {})
            # 减少连接池大小，避免资源浪费
            credentials.setdefault("min_size", 1)
            credentials.setdefault("max_size", 3)
            credentials.setdefault("max_inactive_connection_lifetime", 30.0)
        
        await Tortoise.init(config=config)
        
        # 初始化应用路由管理器（如果未初始化）
        route_manager = get_route_manager()
        if not route_manager:
            init_route_manager(app)
        
        # 重新加载应用路由（确保测试环境中有应用路由）
        try:
            await ApplicationRegistryService.reload_apps()
        except Exception as e:
            # 如果数据库中没有应用记录，尝试从文件系统扫描
            logger.warning(f"应用注册服务初始化失败，尝试从文件系统扫描: {e}")
        
        yield
        
    finally:
        # 清理：关闭所有数据库连接
        try:
            await Tortoise.close_connections()
            # 等待连接完全关闭
            await asyncio.sleep(0.05)
        except Exception as e:
            # 忽略清理错误，避免影响其他测试
            pass


@pytest.fixture(scope="function")
async def test_client(db_setup) -> AsyncGenerator[AsyncClient, None]:
    """
    测试客户端
    
    为每个测试创建独立的HTTP客户端。
    """
    async with AsyncClient(app=app, base_url="http://test", timeout=30.0) as client:
        yield client


@pytest.fixture(scope="function")
async def test_tenant(db_setup) -> AsyncGenerator[Tenant, None]:
    """
    创建测试租户
    
    为每个测试创建独立的测试租户，测试结束后清理。
    """
    # 先检查是否已存在
    existing = await Tenant.get_or_none(domain="test")
    if existing:
        # 确保编码规则存在
        await create_test_code_rules(existing.id)
        yield existing
        return
    
    # 创建新租户
    tenant = await Tenant.create(
        name="测试租户",
        code="TEST",
        domain="test",
        status=TenantStatus.ACTIVE
    )
    
    # 创建测试所需的编码规则
    await create_test_code_rules(tenant.id)
    
    try:
        yield tenant
    finally:
        # 清理：删除测试租户
        try:
            await tenant.delete()
        except Exception as e:
            print(f"清理测试租户时出错: {e}")


@pytest.fixture(scope="function")
async def test_customer(db_setup, test_tenant) -> AsyncGenerator:
    """
    创建测试客户
    
    为每个测试创建独立的测试客户，测试结束后清理。
    """
    from apps.master_data.models.customer import Customer
    import uuid as uuid_module
    from datetime import datetime
    
    # 使用filter查找，包括软删除的记录
    existing = await Customer.filter(
        tenant_id=test_tenant.id,
        code="TEST-CUSTOMER-001"
    ).first()
    
    if existing:
        # 如果存在但已软删除，恢复它
        if existing.deleted_at:
            existing.deleted_at = None
            await existing.save()
        yield existing
        return
    
    # 创建新客户，使用try-except处理并发创建
    customer = None
    try:
        customer = await Customer.create(
            tenant_id=test_tenant.id,
            uuid=str(uuid_module.uuid4()),
            code="TEST-CUSTOMER-001",
            name="测试客户",
            short_name="测试",
            contact_person="测试联系人",
            phone="13800000000",
            email="test@example.com",
            address="测试地址",
            category="测试分类",
            is_active=True
        )
    except Exception:
        # 如果创建失败（可能是并发创建），再次尝试获取
        customer = await Customer.filter(
            tenant_id=test_tenant.id,
            code="TEST-CUSTOMER-001"
        ).first()
        if customer and customer.deleted_at:
            customer.deleted_at = None
            await customer.save()
        if not customer:
            raise
    
    yield customer
    
    # 清理：软删除测试客户
    try:
        customer.deleted_at = datetime.now()
        await customer.save()
    except Exception as e:
        print(f"清理测试客户时出错: {e}")


@pytest.fixture(scope="function")
async def test_material(db_setup, test_tenant) -> AsyncGenerator:
    """
    创建测试物料
    
    为每个测试创建独立的测试物料，测试结束后清理。
    """
    from apps.master_data.models.material import Material
    import uuid as uuid_module
    from datetime import datetime
    
    # 使用filter查找，包括软删除的记录
    existing = await Material.filter(
        tenant_id=test_tenant.id,
        code="TEST-MAT-001"
    ).first()
    
    if existing:
        # 如果存在但已软删除，恢复它
        if existing.deleted_at:
            existing.deleted_at = None
            await existing.save()
        yield existing
        return
    
    # 创建新物料
    material = None
    try:
        material = await Material.create(
            tenant_id=test_tenant.id,
            uuid=str(uuid_module.uuid4()),
            code="TEST-MAT-001",
            name="测试物料",
            specification="测试规格",
            base_unit="个",
            is_active=True
        )
    except Exception:
        # 如果创建失败（可能是并发创建），再次尝试获取
        material = await Material.filter(
            tenant_id=test_tenant.id,
            code="TEST-MAT-001"
        ).first()
        if material and material.deleted_at:
            material.deleted_at = None
            await material.save()
        if not material:
            raise
    
    yield material
    
    # 清理：软删除测试物料
    try:
        material.deleted_at = datetime.now()
        await material.save()
    except Exception as e:
        print(f"清理测试物料时出错: {e}")


@pytest.fixture(scope="function")
async def test_user(db_setup, test_tenant) -> AsyncGenerator[User, None]:
    """
    创建测试用户
    
    为每个测试创建独立的测试用户，测试结束后清理。
    使用真实的密码哈希，支持真实登录。
    """
    # 先检查是否已存在
    existing = await User.get_or_none(username="test_user", tenant_id=test_tenant.id)
    if existing:
        # 确保密码已正确设置
        test_password = "test_password_123"
        if not existing.verify_password(test_password):
            existing.password_hash = User.hash_password(test_password)
            await existing.save()
        yield existing
        return
    
    # 创建新用户，使用真实的密码哈希
    test_password = "test_password_123"
    user = await User.create(
        tenant_id=test_tenant.id,
        username="test_user",
        email="test@example.com",
        password_hash=User.hash_password(test_password),
        full_name="测试用户",
        is_active=True
    )
    
    try:
        yield user
    finally:
        # 清理：删除测试用户
        try:
            await user.delete()
        except Exception as e:
            print(f"清理测试用户时出错: {e}")


@pytest.fixture(scope="function")
async def auth_headers(test_client: AsyncClient, test_user: User, test_tenant) -> dict:
    """
    获取认证头
    
    使用真实的JWT token，通过调用登录API或直接生成token。
    """
    from infra.domain.security.security import create_token_for_user
    
    # 生成真实的JWT token
    token = create_token_for_user(
        user_id=test_user.id,
        username=test_user.username,
        tenant_id=test_user.tenant_id,
        is_infra_admin=test_user.is_infra_admin if hasattr(test_user, 'is_infra_admin') else False,
        is_tenant_admin=test_user.is_tenant_admin if hasattr(test_user, 'is_tenant_admin') else False,
    )
    
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(test_user.tenant_id)
    }
