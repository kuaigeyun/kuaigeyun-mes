"""
错误日志记录工具模块

提供统一的错误日志记录功能，包括错误分类、错误统计、错误报告等。
"""

from typing import Dict, Any, Optional
from datetime import datetime
from loguru import logger
import traceback
import json


class ErrorLogger:
    """
    错误日志记录器
    
    提供统一的错误日志记录功能。
    """
    
    @staticmethod
    def log_error(
        error: Exception,
        context: Optional[Dict[str, Any]] = None,
        level: str = "error"
    ) -> None:
        """
        记录错误日志
        
        Args:
            error: 异常对象
            context: 上下文信息（如 tenant_id、user_id、request_path 等）
            level: 日志级别（error、warning、critical）
        """
        error_info = {
            "type": type(error).__name__,
            "message": str(error),
            "traceback": traceback.format_exc(),
            "context": context or {},
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        
        log_message = f"错误: {error_info['type']} - {error_info['message']}"
        if context:
            log_message += f" | 上下文: {json.dumps(context, ensure_ascii=False)}"
        
        if level == "critical":
            logger.critical(log_message)
            logger.critical(f"堆栈跟踪:\n{error_info['traceback']}")
        elif level == "warning":
            logger.warning(log_message)
        else:
            logger.error(log_message)
            logger.error(f"堆栈跟踪:\n{error_info['traceback']}")
    
    @staticmethod
    def log_api_error(
        error: Exception,
        request_path: str,
        request_method: str,
        tenant_id: Optional[int] = None,
        user_id: Optional[int] = None,
        status_code: Optional[int] = None
    ) -> None:
        """
        记录 API 错误日志
        
        Args:
            error: 异常对象
            request_path: 请求路径
            request_method: 请求方法
            tenant_id: 组织ID（可选）
            user_id: 用户ID（可选）
            status_code: HTTP 状态码（可选）
        """
        context = {
            "request_path": request_path,
            "request_method": request_method,
            "status_code": status_code,
        }
        
        if tenant_id:
            context["tenant_id"] = tenant_id
        if user_id:
            context["user_id"] = user_id
        
        ErrorLogger.log_error(error, context=context)
    
    @staticmethod
    def log_business_error(
        error: Exception,
        business_module: str,
        business_action: str,
        tenant_id: Optional[int] = None,
        user_id: Optional[int] = None,
        business_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        记录业务错误日志
        
        Args:
            error: 异常对象
            business_module: 业务模块
            business_action: 业务操作
            tenant_id: 组织ID（可选）
            user_id: 用户ID（可选）
            business_data: 业务数据（可选）
        """
        context = {
            "business_module": business_module,
            "business_action": business_action,
        }
        
        if tenant_id:
            context["tenant_id"] = tenant_id
        if user_id:
            context["user_id"] = user_id
        if business_data:
            context["business_data"] = business_data
        
        ErrorLogger.log_error(error, context=context, level="warning")
    
    @staticmethod
    def log_database_error(
        error: Exception,
        operation: str,
        table_name: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> None:
        """
        记录数据库错误日志
        
        Args:
            error: 异常对象
            operation: 数据库操作（如 SELECT、INSERT、UPDATE、DELETE）
            table_name: 表名（可选）
            tenant_id: 组织ID（可选）
        """
        context = {
            "operation": operation,
        }
        
        if table_name:
            context["table_name"] = table_name
        if tenant_id:
            context["tenant_id"] = tenant_id
        
        ErrorLogger.log_error(error, context=context, level="critical")
    
    @staticmethod
    def log_external_service_error(
        error: Exception,
        service_name: str,
        service_url: Optional[str] = None,
        tenant_id: Optional[int] = None
    ) -> None:
        """
        记录外部服务错误日志
        
        Args:
            error: 异常对象
            service_name: 服务名称（如 kkFileView、Inngest 等）
            service_url: 服务URL（可选）
            tenant_id: 组织ID（可选）
        """
        context = {
            "service_name": service_name,
        }
        
        if service_url:
            context["service_url"] = service_url
        if tenant_id:
            context["tenant_id"] = tenant_id
        
        ErrorLogger.log_error(error, context=context, level="warning")

