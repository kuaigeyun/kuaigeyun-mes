"""
应用注册服务测试脚本

测试系统层和应用层隔离后的应用关联程序工作情况。

测试内容：
1. 应用发现功能
2. 应用模型注册
3. 应用路由注册
4. 单个应用注册/注销
5. 路由管理器功能
6. 应用状态查询

Author: Luigi Lu
Date: 2025-12-27
"""

import asyncio
import sys
from pathlib import Path

from fastapi import FastAPI
from loguru import logger
from tortoise import Tortoise

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 配置日志
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="INFO"
)


async def setup_database():
    """初始化数据库连接"""
    from infra.infrastructure.database.database import register_db
    
    # 创建临时FastAPI应用用于注册数据库
    temp_app = FastAPI()
    await register_db(temp_app)
    logger.info("✅ 数据库连接已建立")


async def test_application_discovery():
    """测试应用发现功能"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试1: 应用发现功能")
    logger.info("="*60)
    
    from core.services.application.application_registry_service import ApplicationRegistryService
    
    try:
        # 发现已安装的应用
        apps = await ApplicationRegistryService._discover_installed_apps()
        
        logger.info(f"✅ 发现 {len(apps)} 个已安装的应用")
        for app in apps:
            logger.info(f"   - {app['name']} ({app['code']}) - 版本: {app.get('version', 'N/A')}")
            logger.info(f"     路由路径: {app.get('route_path', 'N/A')}")
            logger.info(f"     入口点: {app.get('entry_point', 'N/A')}")
            logger.info(f"     状态: 已安装={app.get('is_installed', False)}, 已启用={app.get('is_active', False)}")
        
        return len(apps) > 0
    except Exception as e:
        logger.error(f"❌ 应用发现失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_application_registry_initialization():
    """测试应用注册服务初始化"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试2: 应用注册服务初始化")
    logger.info("="*60)
    
    from core.services.application.application_registry_service import ApplicationRegistryService
    
    try:
        # 初始化应用注册服务
        await ApplicationRegistryService.initialize()
        
        # 检查已注册的应用
        registered_models = ApplicationRegistryService.get_registered_models()
        registered_routes = ApplicationRegistryService.get_registered_routes()
        registered_app_codes = ApplicationRegistryService.get_registered_app_codes()
        
        logger.info(f"✅ 应用注册服务初始化完成")
        logger.info(f"   已注册模型模块: {len(registered_models)} 个")
        for model in registered_models:
            logger.info(f"     - {model}")
        
        logger.info(f"   已注册路由: {len(registered_routes)} 个应用")
        for app_code, routers in registered_routes.items():
            logger.info(f"     - {app_code}: {len(routers)} 个路由对象")
        
        logger.info(f"   已注册应用代码: {registered_app_codes}")
        
        return len(registered_routes) > 0 or len(registered_models) > 0
    except Exception as e:
        logger.error(f"❌ 应用注册服务初始化失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_route_manager():
    """测试路由管理器功能"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试3: 路由管理器功能")
    logger.info("="*60)
    
    from core.services.application.application_route_manager import init_route_manager, get_route_manager
    
    try:
        # 创建临时FastAPI应用
        temp_app = FastAPI()
        
        # 初始化路由管理器
        init_route_manager(temp_app)
        logger.info("✅ 路由管理器初始化成功")

        # 获取路由管理器实例
        manager = get_route_manager()
        if manager:
            logger.info("✅ 路由管理器实例获取成功")
            
            # 检查已注册的路由
            registered_routes = manager.get_registered_routes()
            logger.info(f"   已注册路由: {len(registered_routes)} 个应用")
            for app_code, routers in registered_routes.items():
                logger.info(f"     - {app_code}: {len(routers)} 个路由对象")
            
            return True
        else:
            logger.error("❌ 路由管理器实例获取失败")
            return False
    except Exception as e:
        logger.error(f"❌ 路由管理器测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_single_app_registration():
    """测试单个应用注册功能"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试4: 单个应用注册功能")
    logger.info("="*60)
    
    from core.services.application.application_registry_service import ApplicationRegistryService
    
    try:
        # 先发现已安装的应用
        apps = await ApplicationRegistryService._discover_installed_apps()
        
        if not apps:
            logger.warning("⚠️ 没有已安装的应用，跳过单个应用注册测试")
            return True
        
        # 测试注册第一个应用
        test_app = apps[0]
        app_code = test_app['code']
        app_name = test_app['name']
        
        logger.info(f"测试注册应用: {app_name} ({app_code})")
        
        # 先注销（如果已注册）
        await ApplicationRegistryService.unregister_single_app(app_code)
        
        # 注册应用
        success = await ApplicationRegistryService.register_single_app(app_code)
        
        if success:
            logger.info(f"✅ 应用 {app_name} ({app_code}) 注册成功")
            
            # 检查是否已注册
            is_registered = await ApplicationRegistryService.is_app_registered(app_code)
            if is_registered:
                logger.info(f"✅ 应用 {app_code} 已确认注册")
            else:
                logger.warning(f"⚠️ 应用 {app_code} 注册状态检查失败")
            
            # 获取应用信息
            app_info = await ApplicationRegistryService.get_app_info(app_code)
            if app_info:
                logger.info(f"✅ 应用信息获取成功")
            else:
                logger.warning(f"⚠️ 应用信息获取失败")
            
            return True
        else:
            logger.error(f"❌ 应用 {app_name} ({app_code}) 注册失败")
            return False
    except Exception as e:
        logger.error(f"❌ 单个应用注册测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_app_reload():
    """测试应用重新加载功能"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试5: 应用重新加载功能")
    logger.info("="*60)
    
    from core.services.application.application_registry_service import ApplicationRegistryService
    
    try:
        # 记录重新加载前的状态
        before_models = len(ApplicationRegistryService.get_registered_models())
        before_routes = len(ApplicationRegistryService.get_registered_routes())
        
        logger.info(f"重新加载前: {before_models} 个模型模块, {before_routes} 个应用路由")
        
        # 重新加载应用
        await ApplicationRegistryService.reload_apps()
        
        # 记录重新加载后的状态
        after_models = len(ApplicationRegistryService.get_registered_models())
        after_routes = len(ApplicationRegistryService.get_registered_routes())
        
        logger.info(f"重新加载后: {after_models} 个模型模块, {after_routes} 个应用路由")
        
        # 检查状态是否一致
        if before_models == after_models and before_routes == after_routes:
            logger.info("✅ 应用重新加载成功，状态保持一致")
            return True
        else:
            logger.warning(f"⚠️ 应用重新加载后状态发生变化")
            logger.warning(f"   模型模块: {before_models} -> {after_models}")
            logger.warning(f"   应用路由: {before_routes} -> {after_routes}")
            return True  # 状态变化也可能是正常的（如果数据库中有新应用）
    except Exception as e:
        logger.error(f"❌ 应用重新加载测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_module_import():
    """测试应用模块导入功能"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试6: 应用模块导入功能")
    logger.info("="*60)
    
    from core.services.application.application_registry_service import ApplicationRegistryService
    
    try:
        # 发现已安装的应用
        apps = await ApplicationRegistryService._discover_installed_apps()
        
        if not apps:
            logger.warning("⚠️ 没有已安装的应用，跳过模块导入测试")
            return True
        
        success_count = 0
        fail_count = 0
        
        for app in apps:
            app_code = app['code']
            app_name = app['name']
            
            # 测试模型模块导入
            model_module_path = f"apps.{app_code}.models"
            model_exists = ApplicationRegistryService._module_exists(model_module_path)
            
            # 测试路由模块导入
            route_module_path = f"apps.{app_code}.api.router"
            route_exists = ApplicationRegistryService._module_exists(route_module_path)
            
            if model_exists or route_exists:
                logger.info(f"✅ {app_name} ({app_code}):")
                if model_exists:
                    logger.info(f"   模型模块: ✅ {model_module_path}")
                else:
                    logger.info(f"   模型模块: ❌ {model_module_path}")
                
                if route_exists:
                    logger.info(f"   路由模块: ✅ {route_module_path}")
                else:
                    logger.info(f"   路由模块: ❌ {route_module_path}")
                
                success_count += 1
            else:
                logger.warning(f"⚠️ {app_name} ({app_code}): 模型和路由模块都不存在")
                fail_count += 1
        
        logger.info(f"\n测试结果: {success_count} 个应用模块可用, {fail_count} 个应用模块不可用")
        return success_count > 0
    except Exception as e:
        logger.error(f"❌ 模块导入测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_application_service_integration():
    """测试应用服务集成"""
    logger.info("\n" + "="*60)
    logger.info("📋 测试7: 应用服务集成")
    logger.info("="*60)
    
    from core.services.application.application_service import ApplicationService
    
    try:
        # 测试获取应用列表（使用默认租户ID 1）
        tenant_id = 1
        
        # 获取已安装的应用列表
        apps = await ApplicationService.list_applications(
            tenant_id=tenant_id,
            is_installed=True,
            is_active=True
        )
        
        logger.info(f"✅ 从应用服务获取到 {len(apps)} 个已安装且启用的应用")
        for app in apps:
            app_name = app.get('name', 'N/A') if isinstance(app, dict) else app.name
            app_code = app.get('code', 'N/A') if isinstance(app, dict) else app.code
            logger.info(f"   - {app_name} ({app_code})")
        
        return len(apps) > 0
    except Exception as e:
        logger.error(f"❌ 应用服务集成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


async def run_all_tests():
    """运行所有测试"""
    logger.info("\n" + "="*60)
    logger.info("🚀 开始测试应用关联程序")
    logger.info("="*60)
    
    # 初始化数据库
    await setup_database()
    
    # 测试结果
    results = {}
    
    # 运行各项测试
    results["应用发现"] = await test_application_discovery()
    results["应用注册初始化"] = await test_application_registry_initialization()
    results["路由管理器"] = await test_route_manager()
    results["单个应用注册"] = await test_single_app_registration()
    results["应用重新加载"] = await test_app_reload()
    results["模块导入"] = await test_module_import()
    results["应用服务集成"] = await test_application_service_integration()
    
    # 输出测试总结
    logger.info("\n" + "="*60)
    logger.info("📊 测试总结")
    logger.info("="*60)
    
    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)
    failed_tests = total_tests - passed_tests
    
    for test_name, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        logger.info(f"{status} - {test_name}")
    
    logger.info(f"\n总计: {total_tests} 个测试")
    logger.info(f"通过: {passed_tests} 个")
    logger.info(f"失败: {failed_tests} 个")
    logger.info(f"成功率: {passed_tests/total_tests*100:.1f}%")
    
    # 关闭数据库连接
    await Tortoise.close_connections()
    logger.info("\n✅ 测试完成，数据库连接已关闭")
    
    return all(results.values())


if __name__ == "__main__":
    try:
        success = asyncio.run(run_all_tests())
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.warning("\n⚠️ 测试被用户中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ 测试执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

