"""
主数据管理 APP - 主路由

统一管理所有 API 路由。
"""

from fastapi import APIRouter

# 导入各个模块的路由
from apps.master_data.api.factory import router as factory_router
from apps.master_data.api.warehouse import router as warehouse_router
from apps.master_data.api.material import router as material_router
from apps.master_data.api.batch_serial_rules import router as batch_serial_rules_router
from apps.master_data.api.process import router as process_router
from apps.master_data.api.drawings import router as drawings_router
from apps.master_data.api.supply_chain import router as supply_chain_router
from apps.master_data.api.partner_price_book import router as partner_price_book_router
from apps.master_data.api.performance import router as performance_router
from apps.master_data.api.product import router as product_router
from apps.master_data.api.validation import router as validation_router

# 创建主路由
router = APIRouter(tags=["App - Master Data - Overview"])

# 注意：路由前缀使用 master-data（带连字符），因为这是 URL 路径
# 但目录名使用 master_data（下划线），因为 Python 模块名不能有连字符

# 注册各个模块的路由
# 注意：batch_serial_rules 与 material 均使用 prefix=/materials，必须先注册 batch_serial_rules，
# 否则 GET /materials/batch-rules、/materials/serial-rules 会被 material 的 /{material_uuid} 当成 UUID而 404。
router.include_router(factory_router)
router.include_router(warehouse_router)
router.include_router(batch_serial_rules_router)
router.include_router(material_router)
router.include_router(process_router)
router.include_router(drawings_router)
router.include_router(supply_chain_router)
router.include_router(partner_price_book_router)
router.include_router(performance_router)
router.include_router(product_router)
router.include_router(validation_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口
    
    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "master-data"}

