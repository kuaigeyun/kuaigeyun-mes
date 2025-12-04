"""
统一交互规范工具模块

提供统一的交互规范检查工具，确保各模块遵循统一的交互规范。
"""

from typing import Dict, Any, Optional, List
from loguru import logger


class InteractionStandards:
    """
    统一交互规范工具类
    
    提供统一的交互规范检查和验证功能。
    """
    
    # 标准响应字段
    STANDARD_RESPONSE_FIELDS = ["success", "data", "message", "code", "timestamp"]
    
    # 标准错误响应字段
    STANDARD_ERROR_FIELDS = ["success", "error", "timestamp"]
    
    # 标准分页响应字段
    STANDARD_PAGINATED_FIELDS = ["items", "total", "page", "page_size"]
    
    @staticmethod
    def validate_response_format(response: Dict[str, Any], response_type: str = "standard") -> bool:
        """
        验证响应格式是否符合规范
        
        Args:
            response: 响应数据
            response_type: 响应类型（standard、error、paginated）
            
        Returns:
            bool: 是否符合规范
        """
        if not isinstance(response, dict):
            return False
        
        if response_type == "standard":
            # 标准响应必须包含 success 字段
            if "success" not in response:
                logger.warning(f"响应缺少 'success' 字段: {response}")
                return False
            return True
        
        elif response_type == "error":
            # 错误响应必须包含 success 和 error 字段
            if "success" not in response or response.get("success") is not False:
                logger.warning(f"错误响应格式不正确: {response}")
                return False
            if "error" not in response:
                logger.warning(f"错误响应缺少 'error' 字段: {response}")
                return False
            return True
        
        elif response_type == "paginated":
            # 分页响应必须包含 items、total、page、page_size 字段
            required_fields = InteractionStandards.STANDARD_PAGINATED_FIELDS
            for field in required_fields:
                if field not in response:
                    logger.warning(f"分页响应缺少 '{field}' 字段: {response}")
                    return False
            return True
        
        return False
    
    @staticmethod
    def validate_error_code(error_code: str) -> bool:
        """
        验证错误码是否符合规范
        
        Args:
            error_code: 错误码
            
        Returns:
            bool: 是否符合规范
        """
        # 错误码应该是大写字母和下划线组成
        if not isinstance(error_code, str):
            return False
        
        if not error_code.replace("_", "").isalnum() or not error_code.isupper():
            logger.warning(f"错误码格式不正确: {error_code}")
            return False
        
        return True
    
    @staticmethod
    def get_standard_error_codes() -> List[str]:
        """
        获取标准错误码列表
        
        Returns:
            List[str]: 标准错误码列表
        """
        return [
            "VALIDATION_ERROR",
            "AUTHENTICATION_ERROR",
            "AUTHORIZATION_ERROR",
            "NOT_FOUND",
            "CONFLICT",
            "BUSINESS_LOGIC_ERROR",
            "TENANT_ERROR",
            "DATABASE_ERROR",
            "CACHE_ERROR",
            "EXTERNAL_SERVICE_ERROR",
            "CONFIGURATION_ERROR",
            "RATE_LIMIT_ERROR",
        ]

