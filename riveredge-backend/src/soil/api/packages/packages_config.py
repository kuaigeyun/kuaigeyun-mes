"""
套餐配置 API 模块（仅公开接口）

提供套餐配置的公开 API 接口
"""

from typing import Dict, Any
from fastapi import APIRouter

from soil.core.package_config import get_all_package_configs

# 创建路由
router = APIRouter()


@router.get("/packages/config", response_model=Dict[str, Any])
async def get_all_package_configs_endpoint():
    """
    获取所有套餐配置（公开接口）

    返回所有套餐类型的配置信息，包括用户数限制、存储空间限制等。
    套餐配置是静态配置信息，不需要认证。

    Returns:
        Dict[str, Any]: 所有套餐配置字典
    """
    return get_all_package_configs()
