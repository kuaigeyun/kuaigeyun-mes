"""
套餐配置模块

定义各套餐类型的配置信息，包括用户数限制、存储空间限制、应用权限等
"""

from typing import Dict, Any, Tuple, List
from soil.models.tenant import TenantPlan


# 套餐配置字典
PACKAGE_CONFIG: Dict[str, Dict[str, Any]] = {
    "trial": {
        "name": "体验套餐",
        "max_users": 10,
        "max_storage_mb": 1024,  # 1GB
        "allow_pro_apps": False,  # 不允许使用 PRO 应用
        "description": "适合快速体验系统功能，限制用户数和存储空间",
    },
    "basic": {
        "name": "基础版",
        "max_users": 50,
        "max_storage_mb": 5120,  # 5GB
        "allow_pro_apps": False,  # 不允许使用 PRO 应用
        "description": "适合小型团队使用，提供基础功能",
    },
    "professional": {
        "name": "专业版",
        "max_users": 200,
        "max_storage_mb": 20480,  # 20GB
        "allow_pro_apps": True,  # 允许使用 PRO 应用
        "description": "适合中型企业使用，提供完整功能和 PRO 应用支持",
    },
    "enterprise": {
        "name": "企业版",
        "max_users": 1000,
        "max_storage_mb": 102400,  # 100GB
        "allow_pro_apps": True,  # 允许使用 PRO 应用
        "description": "适合大型企业使用，提供最高配置和完整功能",
    },
}


def get_package_config(plan: TenantPlan) -> Dict[str, Any]:
    """
    获取套餐配置
    
    Args:
        plan: 套餐类型（TenantPlan 枚举）
        
    Returns:
        Dict[str, Any]: 套餐配置字典
        
    Raises:
        ValueError: 当套餐类型不存在时抛出
        
    Example:
        >>> config = get_package_config(TenantPlan.BASIC)
        >>> config["max_users"]
        50
    """
    plan_key = plan.value
    if plan_key not in PACKAGE_CONFIG:
        raise ValueError(f"未知的套餐类型: {plan_key}")
    
    return PACKAGE_CONFIG[plan_key].copy()


def get_all_package_configs() -> Dict[str, Dict[str, Any]]:
    """
    获取所有套餐配置
    
    Returns:
        Dict[str, Dict[str, Any]]: 所有套餐配置字典
    """
    return PACKAGE_CONFIG.copy()


def check_package_limit(
    plan: TenantPlan,
    current_users: int,
    current_storage_mb: int
) -> Tuple[bool, List[str]]:
    """
    检查套餐限制
    
    检查当前使用量是否超过套餐限制，并返回警告信息。
    
    Args:
        plan: 套餐类型
        current_users: 当前用户数
        current_storage_mb: 当前存储空间使用量（MB）
        
    Returns:
        tuple[bool, list[str]]: (是否超过限制, 警告信息列表)
        
    Example:
        >>> exceeded, warnings = check_package_limit(
        ...     TenantPlan.BASIC,
        ...     current_users=45,
        ...     current_storage_mb=4800
        ... )
        >>> exceeded
        False
        >>> len(warnings)
        0
    """
    config = get_package_config(plan)
    exceeded = False
    warnings = []
    
    # 检查用户数限制
    if current_users >= config["max_users"]:
        exceeded = True
        warnings.append(f"用户数已达到套餐限制（{config['max_users']} 人）")
    elif current_users >= config["max_users"] * 0.8:
        warnings.append(f"用户数使用量已达到 80%（{current_users}/{config['max_users']}），请考虑升级套餐")
    
    # 检查存储空间限制
    if current_storage_mb >= config["max_storage_mb"]:
        exceeded = True
        warnings.append(f"存储空间已达到套餐限制（{config['max_storage_mb']} MB）")
    elif current_storage_mb >= config["max_storage_mb"] * 0.8:
        warnings.append(f"存储空间使用量已达到 80%（{current_storage_mb}/{config['max_storage_mb']} MB），请考虑升级套餐")
    
    return exceeded, warnings


def can_use_pro_apps(plan: TenantPlan) -> bool:
    """
    检查套餐是否允许使用 PRO 应用
    
    Args:
        plan: 套餐类型
        
    Returns:
        bool: 是否允许使用 PRO 应用
        
    Example:
        >>> can_use_pro_apps(TenantPlan.BASIC)
        False
        >>> can_use_pro_apps(TenantPlan.PROFESSIONAL)
        True
    """
    config = get_package_config(plan)
    return config.get("allow_pro_apps", False)

