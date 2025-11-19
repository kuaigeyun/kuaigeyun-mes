"""
环境测试脚本

测试 PostgreSQL 和 Redis 环境配置是否正常
不依赖 pytest，可以直接运行
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))


async def test_redis():
    """
    测试 Redis 连接
    """
    print("\n" + "=" * 60)
    print("🔴 测试 Redis 缓存连接")
    print("=" * 60)

    try:
        from core.cache import Cache
        from app.config import settings

        print(f"Redis 配置:")
        print(f"  主机: {settings.REDIS_HOST}")
        print(f"  端口: {settings.REDIS_PORT}")
        print(f"  数据库: {settings.REDIS_DB}")
        print()

        # 连接 Redis
        await Cache.connect()
        print("✅ Redis 连接成功")

        # 测试基本操作
        test_key = "test:environment:check"
        test_value = "environment_test_2025"

        # SET
        await Cache.set(test_key, test_value, expire=10)
        print(f"✅ Redis SET 操作成功")

        # GET
        result = await Cache.get(test_key)
        if result == test_value:
            print(f"✅ Redis GET 操作成功: {result}")
        else:
            print(f"⚠️  Redis GET 结果不匹配: 期望 {test_value}, 实际 {result}")
            return False

        # EXISTS
        exists = await Cache.exists(test_key)
        if exists:
            print(f"✅ Redis EXISTS 操作成功: {exists}")

        # DELETE
        await Cache.delete(test_key)
        print(f"✅ Redis DELETE 操作成功")

        # 验证删除
        exists_after = await Cache.exists(test_key)
        if not exists_after:
            print(f"✅ Redis 数据删除验证成功")

        print("✅ Redis 连接测试通过！")
        return True

    except Exception as e:
        print(f"❌ Redis 连接测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        try:
            await Cache.disconnect()
        except:
            pass


async def test_database():
    """
    测试数据库连接
    """
    print("\n" + "=" * 60)
    print("📊 测试 PostgreSQL 数据库连接")
    print("=" * 60)

    # 先检查 asyncpg 是否安装
    try:
        import asyncpg
    except ImportError:
        print("⚠️  asyncpg 未安装")
        print("   提示: asyncpg 需要编译工具（Microsoft C++ Build Tools）")
        print("   参考: INSTALL.md 中的安装说明")
        raise ImportError("asyncpg 未安装，需要编译工具（Microsoft C++ Build Tools）")

    try:
        from core.database import TORTOISE_ORM
        from app.config import settings
        from tortoise import Tortoise

        print(f"数据库配置:")
        print(f"  主机: {settings.DB_HOST}")
        print(f"  端口: {settings.DB_PORT}")
        print(f"  用户: {settings.DB_USER}")
        print(f"  数据库: {settings.DB_NAME}")
        print()

        # 初始化数据库连接（使用 Tortoise ORM 官方方法）
        await Tortoise.init(config=TORTOISE_ORM)
        print("✅ 数据库连接初始化成功")

        # 测试查询
        result = await Tortoise.get_connection("default").execute_query(
            "SELECT version();"
        )

        if result:
            # Tortoise ORM 返回的结果格式可能是元组或列表
            if isinstance(result, (list, tuple)) and len(result) > 0:
                if isinstance(result[0], (list, tuple)) and len(result[0]) > 0:
                    version = result[0][0]
                else:
                    version = result[0]
                print(f"✅ PostgreSQL 版本: {version}")
            else:
                print(f"✅ PostgreSQL 版本: {result}")
        else:
            print("⚠️  无法获取 PostgreSQL 版本信息")
            return False

        # 测试数据库名称
        result = await Tortoise.get_connection("default").execute_query(
            "SELECT current_database();"
        )

        if result:
            if isinstance(result, (list, tuple)) and len(result) > 0:
                if isinstance(result[0], (list, tuple)) and len(result[0]) > 0:
                    db_name = result[0][0]
                else:
                    db_name = result[0]
                print(f"✅ 当前数据库: {db_name}")
            else:
                print(f"✅ 当前数据库: {result}")

        print("✅ 数据库连接测试通过！")
        return True

    except ImportError:
        # 重新抛出 ImportError，让主函数处理
        raise
    except Exception as e:
        print(f"❌ 数据库连接测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        try:
            # 关闭数据库连接（使用 Tortoise ORM 官方方法）
            await Tortoise.close_connections()
        except:
            pass


async def test_config():
    """
    测试配置加载
    """
    print("\n" + "=" * 60)
    print("⚙️  测试配置加载")
    print("=" * 60)

    try:
        from app.config import settings

        print(f"✅ 应用名称: {settings.APP_NAME}")
        print(f"✅ 应用版本: {settings.APP_VERSION}")
        print(f"✅ 调试模式: {settings.DEBUG}")
        print(f"✅ 运行环境: {settings.ENVIRONMENT}")

        print(f"\n📊 数据库配置:")
        print(f"  主机: {settings.DB_HOST}")
        print(f"  端口: {settings.DB_PORT}")
        print(f"  用户: {settings.DB_USER}")
        print(f"  数据库: {settings.DB_NAME}")

        print(f"\n🔴 Redis 配置:")
        print(f"  主机: {settings.REDIS_HOST}")
        print(f"  端口: {settings.REDIS_PORT}")
        print(f"  数据库: {settings.REDIS_DB}")

        print("✅ 配置加载测试通过！")
        return True

    except Exception as e:
        print(f"❌ 配置加载测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """
    主测试函数

    依次测试配置、数据库和 Redis
    """
    print("\n" + "=" * 60)
    print("🚀 RiverEdge Core - 环境测试")
    print("=" * 60)

    results = []

    # 测试配置
    config_result = await test_config()
    results.append(("配置加载", config_result))

    # 测试 Redis（不依赖编译工具）
    redis_result = await test_redis()
    results.append(("Redis 缓存", redis_result))

    # 测试数据库（需要 asyncpg，可能需要编译工具）
    try:
        db_result = await test_database()
        results.append(("PostgreSQL 数据库", db_result))
    except ImportError as e:
        print(f"\n⚠️  数据库测试跳过: {e}")
        print("   提示: asyncpg 需要编译工具（Microsoft C++ Build Tools）")
        print("   参考: INSTALL.md 中的安装说明")
        results.append(("PostgreSQL 数据库", None))
    except Exception as e:
        # 其他错误（如连接失败）
        error_msg = str(e)
        if "asyncpg" in error_msg.lower():
            print(f"\n⚠️  数据库测试跳过: {e}")
            print("   提示: asyncpg 需要编译工具（Microsoft C++ Build Tools）")
            print("   参考: INSTALL.md 中的安装说明")
            results.append(("PostgreSQL 数据库", None))
        else:
            print(f"\n❌ 数据库测试失败: {e}")
            results.append(("PostgreSQL 数据库", False))

    # 输出测试结果
    print("\n" + "=" * 60)
    print("📋 测试结果汇总")
    print("=" * 60)

    for name, result in results:
        if result is None:
            status = "⏭️  跳过（需要安装 asyncpg）"
        elif result:
            status = "✅ 通过"
        else:
            status = "❌ 失败"
        print(f"{name}: {status}")

    # 统计
    passed = sum(1 for _, result in results if result is True)
    total = sum(1 for _, result in results if result is not None)

    print("\n" + "=" * 60)
    if passed == total and total > 0:
        print(f"🎉 所有测试通过！ ({passed}/{total})")
        print("=" * 60)
        return 0
    elif total > 0:
        print(f"⚠️  部分测试失败 ({passed}/{total})")
        print("=" * 60)
        return 1
    else:
        print("⚠️  所有测试跳过")
        print("=" * 60)
        return 0


if __name__ == "__main__":
    """
    运行环境测试
    """
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
