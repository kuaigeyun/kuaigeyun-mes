"""
快格轻制造 APP - 主路由

统一管理所有 API 路由。
"""

from fastapi import APIRouter

# 创建主路由
router = APIRouter(prefix="/apps/kuaizhizao", tags=["Kuaige Zhizao MES"])

# 注意：路由前缀使用 kuaizhizao（不带连字符），因为这是 URL 路径
# 但目录名使用 kuaizhizao（不带下划线），保持一致性

@router.get("/health")
async def health_check():
    """
    健康检查接口

    Returns:
        dict: 健康状态
    """
    return {"status": "ok", "app": "kuaizhizao"}
