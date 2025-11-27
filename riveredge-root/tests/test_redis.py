"""
Redis 连接测试

测试 Redis 缓存连接是否正常
"""

import pytest

from core.cache import Cache


@pytest.mark.asyncio
async def test_redis_connection():
    """
    测试 Redis 连接

    验证能否成功连接到 Redis 服务器
    """
    try:
        # 连接 Redis
        await Cache.connect()

        # 测试基本操作
        test_key = "test:connection"
        test_value = "test_value_123"

        # 测试设置
        await Cache.set(test_key, test_value)
        print(f"✅ Redis SET 操作成功")

        # 测试获取
        result = await Cache.get(test_key)
        assert result == test_value
        print(f"✅ Redis GET 操作成功: {result}")

        # 测试存在检查
        exists = await Cache.exists(test_key)
        assert exists is True
        print(f"✅ Redis EXISTS 操作成功: {exists}")

        # 测试过期时间设置
        await Cache.expire(test_key, 10)
        print(f"✅ Redis EXPIRE 操作成功")

        # 清理测试数据
        await Cache.delete(test_key)
        print(f"✅ Redis DELETE 操作成功")

        # 验证删除
        exists_after_delete = await Cache.exists(test_key)
        assert exists_after_delete is False
        print(f"✅ Redis 数据删除验证成功")

    except Exception as e:
        print(f"❌ Redis 连接失败: {e}")
        raise

    finally:
        # 断开 Redis 连接
        await Cache.disconnect()


@pytest.mark.asyncio
async def test_redis_config():
    """
    测试 Redis 配置

    验证 Redis 配置是否正确
    """
    from app.config import settings

    # 验证配置项
    assert settings.REDIS_HOST is not None
    assert settings.REDIS_PORT is not None
    assert settings.REDIS_DB is not None

    print(f"✅ Redis 配置正确！")
    print(f"  主机: {settings.REDIS_HOST}")
    print(f"  端口: {settings.REDIS_PORT}")
    print(f"  数据库: {settings.REDIS_DB}")


@pytest.mark.asyncio
async def test_redis_operations():
    """
    测试 Redis 基本操作

    验证 Redis 的增删改查操作是否正常
    """
    try:
        await Cache.connect()

        # 测试数据
        test_data = {
            "test:string": "string_value",
            "test:number": "12345",
            "test:json": '{"key": "value"}',
        }

        # 批量设置
        for key, value in test_data.items():
            await Cache.set(key, value, expire=60)
            print(f"✅ 设置 {key} = {value}")

        # 批量获取
        for key, expected_value in test_data.items():
            result = await Cache.get(key)
            assert result == expected_value
            print(f"✅ 获取 {key} = {result}")

        # 批量删除
        for key in test_data.keys():
            await Cache.delete(key)
            print(f"✅ 删除 {key}")

        print(f"✅ 所有 Redis 操作测试通过！")

    except Exception as e:
        print(f"❌ Redis 操作测试失败: {e}")
        raise

    finally:
        await Cache.disconnect()


if __name__ == "__main__":
    """
    直接运行测试
    """
    import asyncio

    async def run_tests():
        """运行所有测试"""
        print("=" * 50)
        print("开始测试 Redis 连接...")
        print("=" * 50)

        # 测试配置
        await test_redis_config()
        print()

        # 测试连接
        await test_redis_connection()
        print()

        # 测试操作
        await test_redis_operations()
        print()

        print("=" * 50)
        print("✅ 所有 Redis 测试通过！")
        print("=" * 50)

    asyncio.run(run_tests())
