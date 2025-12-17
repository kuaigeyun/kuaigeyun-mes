"""
按照数据流动的方向排序所有APP

此脚本用于根据数据流动方向更新所有应用的 sort_order 字段。
数据流动方向：基础数据 -> 设计/客户/供应商 -> 计划 -> 执行 -> 仓储 -> 质量 -> 分析/财务

使用方法：
    python -m scripts.sort_applications_by_data_flow
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from loguru import logger
from tortoise import Tortoise
from infra.infrastructure.database.database import TORTOISE_ORM
from infra.services.tenant_service import TenantService
from core.services.application_service import ApplicationService
from infra.infrastructure.database.database import get_db_connection
from infra.domain.tenant_context import set_current_tenant_id


# 按照数据流动方向定义应用排序
# 数值越小，排序越靠前（数据流动的上游）
DATA_FLOW_ORDER = {
    # 第一层：基础数据层（数据源头）- 设置为990，排在最后
    'master-data': 990,  # 基础数据管理 - 提供工厂、仓库、物料、客户、供应商等基础数据
    
    # 第二层：设计和关系管理层
    'kuaicrm': 20,      # 快格轻CRM - 客户关系管理，提供客户数据
    'kuaipdm': 30,      # 快格轻PDM - 产品数据管理，提供产品设计数据
    'kuaisrm': 40,      # 快格轻SRM - 供应商关系管理，提供供应商数据
    
    # 第三层：计划层（依赖基础数据和关系数据）
    'kuaimrp': 50,      # 快格轻MRP - 物料需求计划，依赖基础数据、PDM、CRM、SRM
    'kuaiaps': 60,      # 快格轻APS - 高级计划排程，依赖MRP
    
    # 第四层：执行层（依赖计划数据）
    'kuaimes': 70,      # 快格轻MES - 制造执行系统，依赖MRP、基础数据
    'kuaiscm': 80,      # 快格轻SCM - 供应链管理，依赖MRP、CRM、SRM
    
    # 第五层：仓储层（依赖执行数据）
    'kuaiwms': 90,      # 快格轻WMS - 仓库管理系统，依赖MES、MRP
    
    # 第六层：质量层（依赖执行数据）
    'kuaiqms': 100,     # 快格轻QMS - 质量管理系统，依赖MES
    'kuailims': 110,    # 快格轻LIMS - 实验室信息管理系统，依赖QMS
    
    # 第七层：设备层（相对独立，但为执行层提供支持）
    'kuaieam': 120,     # 快格轻EAM - 设备资产管理，依赖基础数据
    
    # 第八层：物联网层（为执行层和设备层提供数据）
    'kuaiiot': 130,     # 快格轻IOT - 物联网，为MES、EAM提供数据
    
    # 第九层：运输层（依赖仓储和客户数据）
    'kuaitms': 140,     # 快格轻TMS - 运输管理系统，依赖WMS、CRM
    
    # 第十层：智能分析层（依赖执行层数据）
    'kuaimi': 150,      # 快格轻MI - 制造智能，依赖MES、IOT
    'kuaiems': 160,     # 快格轻EMS - 能源管理系统，依赖IOT、EAM
    
    # 第十一层：财务层（依赖所有业务系统）
    'kuaiacc': 170,     # 快格轻财务 - 财务系统，依赖所有业务系统
    
    # 第十二层：人力资源层（相对独立）
    'kuaihrm': 180,     # 快格轻HRM - 人力资源，相对独立
    
    # 第十三层：项目管理层（相对独立）
    'kuaipm': 190,      # 快格轻PM - 项目管理，相对独立
    
    # 第十四层：环境健康安全层（依赖设备和质量数据）
    'kuaiehs': 200,     # 快格轻EHS - 环境健康安全，依赖EAM、QMS
    
    # 第十五层：认证层（依赖质量和环境数据）
    'kuaicert': 210,    # 快格轻认证 - 认证管理，依赖QMS、EHS
    
    # 第十六层：企业绩效管理层（依赖所有业务系统）
    'kuaiepm': 220,     # 快格轻EPM - 企业绩效管理，依赖所有业务系统
    
    # 第十七层：办公自动化层（相对独立，但可能依赖其他系统）
    'kuaioa': 230,      # 快格轻OA - 办公自动化，相对独立
}


async def sort_applications_by_data_flow():
    """
    按照数据流动方向排序所有应用
    
    步骤：
    1. 初始化 Tortoise ORM
    2. 获取默认租户（domain="default"）
    3. 获取所有应用
    4. 根据数据流动方向更新每个应用的 sort_order
    """
    try:
        # 1. 初始化 Tortoise ORM
        logger.info("正在初始化 Tortoise ORM...")
        await Tortoise.init(config=TORTOISE_ORM)
        logger.info("✅ Tortoise ORM 初始化成功")
        
        # 2. 获取默认租户
        logger.info("正在查找默认租户...")
        tenant_service = TenantService()
        default_tenant = await tenant_service.get_tenant_by_domain(
            "default",
            skip_tenant_filter=True
        )
        
        if not default_tenant:
            logger.error("❌ 默认租户不存在，请先创建默认租户")
            return
        
        logger.info(f"✅ 找到默认租户: ID={default_tenant.id}, Name={default_tenant.name}")
        
        # 设置组织上下文
        set_current_tenant_id(default_tenant.id)
        
        # 3. 获取所有应用
        logger.info("正在获取所有应用列表...")
        applications = await ApplicationService.list_applications(
            tenant_id=default_tenant.id,
            skip=0,
            limit=1000,  # 获取所有应用
            is_installed=None,
            is_active=None
        )
        
        if not applications:
            logger.warning("⚠️ 没有找到任何应用")
            return
        
        logger.info(f"✅ 找到 {len(applications)} 个应用")
        
        # 4. 根据数据流动方向更新每个应用的 sort_order
        conn = await get_db_connection()
        updated_count = 0
        skipped_count = 0
        
        try:
            for app in applications:
                app_code = app.get('code', '')
                app_name = app.get('name', '未知应用')
                app_uuid = app.get('uuid')
                current_sort_order = app.get('sort_order', 0)
                
                # 获取新的排序值
                new_sort_order = DATA_FLOW_ORDER.get(app_code)
                
                if new_sort_order is None:
                    logger.warning(f"⚠️  应用 {app_name} ({app_code}) 未在数据流动顺序中定义，保持原排序: {current_sort_order}")
                    skipped_count += 1
                    continue
                
                if current_sort_order == new_sort_order:
                    logger.info(f"ℹ️  应用 {app_name} ({app_code}) 排序已正确: {new_sort_order}")
                    skipped_count += 1
                    continue
                
                # 更新排序
                logger.info(f"🔄 更新应用 {app_name} ({app_code}): {current_sort_order} -> {new_sort_order}")
                update_query = """
                    UPDATE core_applications
                    SET sort_order = $1, updated_at = NOW()
                    WHERE tenant_id = $2 AND uuid = $3 AND deleted_at IS NULL
                """
                await conn.execute(update_query, new_sort_order, default_tenant.id, app_uuid)
                updated_count += 1
        
        finally:
            await conn.close()
        
        # 输出统计信息
        logger.info("=" * 60)
        logger.info("📊 操作统计:")
        logger.info(f"  - 总应用数: {len(applications)}")
        logger.info(f"  - 已更新: {updated_count}")
        logger.info(f"  - 已跳过: {skipped_count}")
        logger.info("=" * 60)
        logger.info("✅ 所有应用排序更新完成！")
        
        # 5. 显示排序后的应用列表
        logger.info("=" * 60)
        logger.info("📋 按数据流动方向排序后的应用列表:")
        logger.info("=" * 60)
        
        sorted_applications = await ApplicationService.list_applications(
            tenant_id=default_tenant.id,
            skip=0,
            limit=1000,
            is_installed=None,
            is_active=None
        )
        
        # 按 sort_order 排序
        sorted_applications.sort(key=lambda x: (x.get('sort_order', 9999), x.get('id', 0)))
        
        for idx, app in enumerate(sorted_applications, 1):
            app_code = app.get('code', '')
            app_name = app.get('name', '未知应用')
            sort_order = app.get('sort_order', 0)
            is_installed = app.get('is_installed', False)
            is_active = app.get('is_active', False)
            
            status_icon = "✅" if (is_installed and is_active) else ("📦" if is_installed else "❌")
            logger.info(f"  {idx:2d}. [{sort_order:3d}] {status_icon} {app_name} ({app_code})")
        
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"❌ 脚本执行失败: {str(e)}")
        import traceback
        logger.error(f"详细错误: {traceback.format_exc()}")
        raise
    finally:
        # 关闭 Tortoise ORM 连接
        await Tortoise.close_connections()
        logger.info("🔌 数据库连接已关闭")


if __name__ == "__main__":
    """
    主函数入口
    """
    logger.info("=" * 60)
    logger.info("🚀 开始按照数据流动方向排序所有APP")
    logger.info("=" * 60)
    
    asyncio.run(sort_applications_by_data_flow())
    
    logger.info("=" * 60)
    logger.info("✨ 脚本执行完成")
    logger.info("=" * 60)

