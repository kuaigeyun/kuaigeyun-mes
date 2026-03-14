"""
快研发 (Kuaipdm) APP - 主路由（占位）

轻产品生命周期管理，规划中。
"""

from fastapi import APIRouter

router = APIRouter(tags=["Kuaipdm"])


@router.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "app": "kuaipdm"}
