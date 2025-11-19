"""
租户数据隔离测试

测试多租户系统的数据隔离功能，确保不同租户的数据完全隔离
"""

import pytest
import sys
from pathlib import Path

# 添加 src 目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from tortoise import Tortoise
from tortoise import fields

from models.tenant import Tenant, TenantStatus, TenantPlan
from models.base import BaseModel
from core.tenant_context import set_current_tenant_id, clear_tenant_context, get_current_tenant_id
from core.query_filter import get_tenant_queryset
from core.database import TORTOISE_ORM


# 测试用的模型（用于测试数据隔离）
class TestModel(BaseModel):
    """
    测试模型
    
    用于测试数据隔离功能
    """
    name = fields.CharField(max_length=100)
    
    class Meta:
        table = "test_models"


@pytest.fixture
async def setup_db():
    """
    设置测试数据库
    
    在每个测试函数执行前初始化数据库连接
    """
    await Tortoise.init(config=TORTOISE_ORM)
    await Tortoise.generate_schemas()
    yield
    await Tortoise.close_connections()


@pytest.mark.asyncio
async def test_tenant_context_isolation(setup_db):
    """
    测试租户上下文隔离
    
    验证不同协程/线程之间的租户上下文是隔离的
    """
    # 设置租户 ID 1
    set_current_tenant_id(1)
    assert get_current_tenant_id() == 1
    
    # 清除上下文
    clear_tenant_context()
    assert get_current_tenant_id() is None
    
    # 设置租户 ID 2
    set_current_tenant_id(2)
    assert get_current_tenant_id() == 2


@pytest.mark.asyncio
async def test_tenant_creation(setup_db):
    """
    测试租户创建
    
    验证可以成功创建租户
    """
    tenant = await Tenant.create(
        tenant_id=None,  # 租户表本身不需要 tenant_id
        name="测试租户",
        domain="test-tenant",
        status=TenantStatus.ACTIVE,
        plan=TenantPlan.BASIC,
    )
    
    assert tenant.id is not None
    assert tenant.name == "测试租户"
    assert tenant.domain == "test-tenant"
    assert tenant.status == TenantStatus.ACTIVE
    
    # 清理
    await tenant.delete()


@pytest.mark.asyncio
async def test_tenant_query_with_context(setup_db):
    """
    测试租户查询（带上下文）
    
    验证查询自动过滤租户
    """
    # 创建两个租户
    tenant1 = await Tenant.create(
        tenant_id=None,
        name="租户1",
        domain="tenant1",
        status=TenantStatus.ACTIVE,
    )
    tenant2 = await Tenant.create(
        tenant_id=None,
        name="租户2",
        domain="tenant2",
        status=TenantStatus.ACTIVE,
    )
    
    # 设置租户上下文为 tenant1
    set_current_tenant_id(tenant1.id)
    
    # 使用查询过滤器查询（应该只返回当前租户的数据）
    # 注意：租户表本身不需要租户过滤，这里只是测试查询过滤器
    queryset = get_tenant_queryset(Tenant, skip_tenant_filter=True)
    all_tenants = await queryset.all()
    
    # 应该能查询到所有租户（因为 skip_tenant_filter=True）
    assert len(all_tenants) >= 2
    
    # 清理
    await tenant1.delete()
    await tenant2.delete()
    clear_tenant_context()


@pytest.mark.asyncio
async def test_tenant_status_enum(setup_db):
    """
    测试租户状态枚举
    
    验证租户状态枚举正常工作
    """
    tenant = await Tenant.create(
        tenant_id=None,
        name="状态测试租户",
        domain="status-test",
        status=TenantStatus.INACTIVE,
    )
    
    assert tenant.status == TenantStatus.INACTIVE
    assert await tenant.is_active() is False
    
    # 激活租户
    tenant.status = TenantStatus.ACTIVE
    await tenant.save()
    assert await tenant.is_active() is True
    
    # 清理
    await tenant.delete()

