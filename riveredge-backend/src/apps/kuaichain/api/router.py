"""
快协同 (Kuaichain) APP - 主路由（占位）

占位应用，仅提供健康检查接口。
"""

from fastapi import APIRouter

router = APIRouter(tags=["Kuaichain"])


@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "app": "kuaichain"}
