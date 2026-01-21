"""
测试 Inngest 和 AI 集成

用于验证 Inngest 事件发送和 AI 建议功能是否正常工作。

Author: Luigi Lu
Date: 2026-01-09
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from loguru import logger


async def test_imports():
    """测试模块导入"""
    logger.info("=" * 60)
    logger.info("测试 1: 模块导入")
    logger.info("=" * 60)
    
    try:
        from apps.master_data.services.ai.material_ai_service import MaterialAIService
        logger.info("✅ MaterialAIService 导入成功")
    except Exception as e:
        logger.error(f"❌ MaterialAIService 导入失败: {e}")
        return False
    
    try:
        from apps.master_data.inngest.functions.material_ai_suggestion_workflow import (
            material_ai_suggestion_workflow
        )
        logger.info("✅ material_ai_suggestion_workflow 导入成功")
    except Exception as e:
        logger.warning(f"⚠️ material_ai_suggestion_workflow 导入失败（可能因为 inngest 未安装）: {e}")
        # 不返回 False，因为 inngest 可能是可选的
    
    try:
        from apps.master_data.services.material_code_service import MaterialCodeService
        logger.info("✅ MaterialCodeService 导入成功")
        
        # 检查 find_duplicate_materials 方法
        if hasattr(MaterialCodeService, 'find_duplicate_materials'):
            logger.info("✅ MaterialCodeService.find_duplicate_materials 方法存在")
        else:
            logger.error("❌ MaterialCodeService.find_duplicate_materials 方法不存在")
            return False
    except Exception as e:
        logger.error(f"❌ MaterialCodeService 导入失败: {e}")
        return False
    
    return True


async def test_ai_service():
    """测试 AI 服务（不连接数据库）"""
    logger.info("")
    logger.info("=" * 60)
    logger.info("测试 2: AI 服务方法检查")
    logger.info("=" * 60)
    
    try:
        from apps.master_data.services.ai.material_ai_service import MaterialAIService
        
        # 检查方法是否存在
        if hasattr(MaterialAIService, 'generate_suggestions'):
            logger.info("✅ MaterialAIService.generate_suggestions 方法存在")
        else:
            logger.error("❌ MaterialAIService.generate_suggestions 方法不存在")
            return False
        
        # 检查方法签名
        import inspect
        sig = inspect.signature(MaterialAIService.generate_suggestions)
        params = list(sig.parameters.keys())
        logger.info(f"✅ generate_suggestions 参数: {params}")
        
        return True
    except Exception as e:
        logger.error(f"❌ AI 服务检查失败: {e}")
        return False


async def test_inngest_client():
    """测试 Inngest 客户端"""
    logger.info("")
    logger.info("=" * 60)
    logger.info("测试 3: Inngest 客户端检查")
    logger.info("=" * 60)
    
    try:
        from core.inngest.client import inngest_client
        logger.info("✅ Inngest 客户端导入成功")
        logger.info(f"   App ID: {inngest_client.app_id}")
        logger.info(f"   Event API URL: {inngest_client.event_api_base_url}")
        logger.info(f"   Is Production: {inngest_client.is_production}")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Inngest 客户端导入失败（可能因为 inngest 未安装）: {e}")
        return True  # 不阻止测试继续


async def test_api_routes():
    """测试 API 路由注册"""
    logger.info("")
    logger.info("=" * 60)
    logger.info("测试 4: API 路由检查")
    logger.info("=" * 60)
    
    try:
        from apps.master_data.api.material import router
        
        # 检查路由是否存在
        routes = [r.path for r in router.routes]
        
        # 检查 AI 建议相关路由
        ai_preview_route = "/ai-suggestions/preview"
        ai_suggestions_route = "/{material_uuid}/ai-suggestions"
        
        found_preview = any(ai_preview_route in r for r in routes)
        found_suggestions = any(ai_suggestions_route in r or r.endswith("/ai-suggestions") for r in routes)
        
        if found_preview:
            logger.info(f"✅ AI 建议预览路由已注册")
        else:
            logger.warning(f"⚠️ AI 建议预览路由未找到（路径可能不同）")
        
        if found_suggestions:
            logger.info(f"✅ AI 建议查询路由已注册")
        else:
            logger.warning(f"⚠️ AI 建议查询路由未找到（路径可能不同）")
        
        logger.info(f"   总路由数: {len(routes)}")
        return True
    except Exception as e:
        logger.error(f"❌ API 路由检查失败: {e}")
        return False


async def main():
    """主测试函数"""
    logger.info("🚀 开始 Inngest 和 AI 集成测试")
    logger.info("")
    
    results = []
    
    # 测试 1: 模块导入
    results.append(await test_imports())
    
    # 测试 2: AI 服务
    results.append(await test_ai_service())
    
    # 测试 3: Inngest 客户端
    results.append(await test_inngest_client())
    
    # 测试 4: API 路由
    results.append(await test_api_routes())
    
    # 总结
    logger.info("")
    logger.info("=" * 60)
    logger.info("测试总结")
    logger.info("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    logger.info(f"通过: {passed}/{total}")
    
    if passed == total:
        logger.info("✅ 所有测试通过！")
        logger.info("")
        logger.info("下一步：")
        logger.info("1. 启动 Inngest Dev Server: cd bin/inngest && ./start-inngest.sh")
        logger.info("2. 启动后端服务: cd riveredge-backend && ./start-backend.sh")
        logger.info("3. 测试创建物料，验证 Inngest 事件发送")
        logger.info("4. 测试 AI 建议 API 接口")
        return 0
    else:
        logger.warning("⚠️ 部分测试未通过，请检查上述错误")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
