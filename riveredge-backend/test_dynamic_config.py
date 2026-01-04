"""
测试动态配置服务是否正确加载kuaizhizao模型
"""

import asyncio
import sys
import os

# 添加src目录到Python路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

async def test_dynamic_config():
    """测试动态配置服务"""
    from infra.infrastructure.database.dynamic_config_service import DynamicDatabaseConfigService

    print("🔧 测试动态配置服务...")

    try:
        # 获取活跃应用的模型列表
        models = await DynamicDatabaseConfigService._get_active_models()
        print(f"📋 获取到 {len(models)} 个模型模块")

        # 检查是否包含kuaizhizao模型
        kuaizhizao_models = [m for m in models if 'kuaizhizao' in m]
        print(f"🔍 找到 {len(kuaizhizao_models)} 个kuaizhizao模型:")
        for model in kuaizhizao_models:
            print(f"  ✅ {model}")

        if not kuaizhizao_models:
            print("❌ 未找到任何kuaizhizao模型!")

        # 检查几个具体的kuaizhizao模型
        expected_models = [
            "apps.kuaizhizao.models.bill_of_materials",
            "apps.kuaizhizao.models.work_order",
            "apps.kuaizhizao.models.purchase_order"
        ]

        for expected_model in expected_models:
            if expected_model in models:
                print(f"✅ {expected_model} 已包含")
            else:
                print(f"❌ {expected_model} 未包含")

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_dynamic_config())













