"""
快格轻制造 APP - 主路由

统一管理所有 API 路由。

Author: Auto (AI Assistant)
Date: 2025-01-01
"""

from fastapi import APIRouter

# 导入子路由
from .production import router as production_router
from .purchase import router as purchase_router

# 创建主路由
router = APIRouter(tags=["Kuaige Zhizao MES"])

# 注意：路由前缀使用 kuaizhizao（不带连字符），因为这是 URL 路径
# 但目录名使用 kuaizhizao（不带下划线），保持一致性

# 注册子路由
router.include_router(production_router)
router.include_router(purchase_router)

@router.get("/health")
async def health_check():
    """
    健康检查接口

    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaizhizao"}
