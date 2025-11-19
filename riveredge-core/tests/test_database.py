"""
数据库连接测试

测试 PostgreSQL 数据库连接是否正常
"""

import pytest
from tortoise import Tortoise

from core.database import TORTOISE_ORM


@pytest.mark.asyncio
async def test_database_connection():
    """
    测试数据库连接

    验证能否成功连接到 PostgreSQL 数据库
    """
    try:
        # 初始化数据库连接（使用 Tortoise ORM 官方方法）
        await Tortoise.init(config=TORTOISE_ORM)

        # 测试连接：执行一个简单的查询
        result = await Tortoise.get_connection("default").execute_query(
            "SELECT version();"
        )

        # 验证查询结果
        assert result is not None
        assert len(result) > 0

        print(f"✅ 数据库连接成功！")
        print(f"PostgreSQL 版本: {result[0][0]}")

    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        raise

    finally:
        # 关闭数据库连接（使用 Tortoise ORM 官方方法）
        await Tortoise.close_connections()


@pytest.mark.asyncio
async def test_database_config():
    """
    测试数据库配置

    验证数据库配置是否正确
    """
    from app.config import settings

    # 验证配置项
    assert settings.DB_HOST is not None
    assert settings.DB_PORT is not None
    assert settings.DB_USER is not None
    assert settings.DB_PASSWORD is not None
    assert settings.DB_NAME is not None

    print(f"✅ 数据库配置正确！")
    print(f"  主机: {settings.DB_HOST}")
    print(f"  端口: {settings.DB_PORT}")
    print(f"  用户: {settings.DB_USER}")
    print(f"  数据库: {settings.DB_NAME}")


if __name__ == "__main__":
    """
    直接运行测试
    """
    import asyncio

    async def run_tests():
        """运行所有测试"""
        print("=" * 50)
        print("开始测试数据库连接...")
        print("=" * 50)

        # 测试配置
        await test_database_config()
        print()

        # 测试连接
        await test_database_connection()
        print()

        print("=" * 50)
        print("✅ 所有数据库测试通过！")
        print("=" * 50)

    asyncio.run(run_tests())
